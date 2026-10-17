import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { askJson, generateImage, generateMesh, generateMusic, generateVideo, type Generated } from "./generate"
import { lineOf, voice as gendered } from "./line"
import {
  CREATORS,
  allCreators,
  MUSIC_AVOID,
  SPOKEN_SYSTEM,
  captionPrompt,
  creator,
  creatorPrompt,
  scriptPrompt,
  shotDialogue,
  shotLabel,
  ugcFormat,
  ugcFramePrompt,
  ugcShot,
  ugcTrack,
  ugcVideoPrompt,
  ugcVoice,
  type Script,
  type UgcFormat,
  type UgcShot,
} from "./prompts/ugc"
import { importFile, mediaPath, saveBuffer } from "./media"
import { canonPrompt, onModelPrompt, refineOwnPrompt, refinePrompt, shotSpec, type RefRole } from "./prompts/canon"
import { QA_KINDS, VIEW_SLOTS, renderSlots, slotLabel } from "./steps"
import { CAST, CAST_VIEWS, castLabel, castModel, castParts, castPrompt, castRefinePrompt, type CastView } from "./prompts/cast"
import { brandProfile } from "./brand-lora"
import { BRAND_DNA_SYSTEM, brandDnaPrompt } from "./prompts/brand-dna"
import { identityBlock, readIdentity } from "./brand-identity"
import { DNA_SYSTEM, dnaPrompt } from "./prompts/dna"
import { QA_SYSTEM, qaPrompt, qaScore } from "./prompts/qa"
import { ARCHIVE_PROMPT, DESIGN_SPEC_SYSTEM, designSpecPrompt, flatFromSpecPrompt, productFromNotePrompt, refineFlatPrompt, sketchPrompt, type DesignSpec } from "./prompts/seed"
import { SHOOT_SYSTEM, shootPrompt } from "./prompts/shoot"
import { STUDIO_LOOKS, studioLook, studioPrompt } from "./prompts/studio"
import { CAST_ID, DATA_DIR, newId, readDb, updateDb } from "./store"
import { PDP_SYSTEM, pdpPrompt } from "./prompts/pdp"
import type { Asset, AssetKind, DnaField, Garment, GarmentDna, Media, Operator, Pdp, Qa, ShootPlan } from "./types"
import { beatGrid, crop, extractFrames, locate, montage, soundEnd } from "./vision"

/** The assets of one garment, plus the shared cast: the base bodies are references like any other. */
export async function getGarment(id?: string): Promise<{ garment: Garment; assets: Asset[] }> {
  const db = await readDb()
  const garment = id ? db.garments.find((g) => g.id === id || g.sku === id) : db.garments.at(-1)
  if (!garment) throw new Error(id ? `garment not found: ${id}` : "no garment: run `npm run seed` first")
  return { garment, assets: db.assets.filter((a) => a.garmentId === garment.id || a.garmentId === CAST_ID) }
}

/** The approved asset of a kind, or the most recent one while nothing is approved yet. */
export function pick(assets: Asset[], kind: AssetKind, label?: string): Asset | undefined {
  const ofKind = assets.filter((a) => a.kind === kind && a.status !== "rejected" && (label === undefined || a.label === label))
  return ofKind.find((a) => a.status === "approved") ?? ofKind.at(-1)
}

function approved(assets: Asset[], kind: AssetKind): Asset | undefined {
  return assets.find((a) => a.kind === kind && a.status === "approved")
}

function must(assets: Asset[], kind: AssetKind): Asset {
  const asset = pick(assets, kind)
  if (!asset) throw new Error(`missing asset "${kind}"`)
  return asset
}

function needDna(garment: Garment): GarmentDna {
  if (!garment.dna) throw new Error("DNA missing: run `npm run dna` first")
  return garment.dna
}

export async function createGarment(input: Omit<Garment, "id" | "createdAt">): Promise<Garment> {
  const garment: Garment = { ...input, id: newId("g"), createdAt: new Date().toISOString() }
  await updateDb((db) => db.garments.push(garment))
  return garment
}

/** DNA that arrived with the product, already confirmed: extraction must not overwrite it. */
export async function putDna(garmentId: string, dna: GarmentDna): Promise<void> {
  await updateDb((db) => {
    const g = db.garments.find((x) => x.id === garmentId)
    if (!g) throw new Error(`garment not found: ${garmentId}`)
    g.dna = dna
    g.dnaConfirmedAt = dna.at
    delete g.shoot
  })
}

/**
 * An image made outside the app from the approved 3D (a Blender render, a scene of the qwen-loro pipeline), stored with
 * the model it comes from as its reference. Gemini's checks on a scene arrive as its QA.
 */
export async function importMade(
  garmentId: string,
  kind: AssetKind,
  path: string,
  extra: { label: "blender" | "scene"; prompt?: string; measure?: Asset["measure"]; checks?: Qa["checks"]; approve?: boolean },
): Promise<Asset> {
  const { assets } = await getGarment(garmentId)
  const mesh = approved(assets, "mesh") ?? [...assets].reverse().find((a) => a.kind === "mesh" && a.status !== "rejected")
  if (!mesh) throw new Error("needs the approved 3D")
  const media = await importFile(path)
  const asset = await addAsset(garmentId, kind, media, [mesh.id], { label: extra.label, ...(extra.prompt ? { prompt: extra.prompt } : {}) })
  if (extra.measure || extra.checks) {
    await updateDb((db) => {
      const a = db.assets.find((x) => x.id === asset.id)!
      if (extra.measure) a.measure = extra.measure
      if (extra.checks) {
        const passed = extra.checks.filter((c) => c.pass).length
        a.qa = { score: Math.round((passed / extra.checks.length) * 100), checks: extra.checks, artifacts: [], model: "gemini · qwen-loro vlm_judge", at: new Date().toISOString() }
      }
    })
  }
  return extra.approve ? setStatus(asset.id, "approved", "creative director") : asset
}

/** A view locked upstream, stored approved so on-model and the rest can start from it. */
export async function attachView(garmentId: string, kind: AssetKind, media: Media): Promise<Asset> {
  const asset = await addAsset(garmentId, kind, media, [])
  return setStatus(asset.id, "approved", "handoff")
}

async function addAsset(
  garmentId: string,
  kind: AssetKind,
  media: Media,
  refs: string[],
  extra: Partial<Pick<Asset, "prompt" | "gen" | "label">> = {},
): Promise<Asset> {
  const asset: Asset = { id: newId("a"), garmentId, kind, media, status: "draft", refs, ...extra, createdAt: new Date().toISOString() }
  await updateDb((db) => db.assets.push(asset))
  return asset
}

function addGenerated(garmentId: string, kind: AssetKind, generated: Generated, prompt: string, refs: string[]): Promise<Asset> {
  return addAsset(garmentId, kind, generated.media, refs, { prompt, gen: generated.gen })
}

/** The creator an asset belongs to, following refs one level down (clip → frame → person). */
function creatorOf(asset: Asset, all: Asset[]): string | undefined {
  const ids = [...asset.refs, ...asset.refs.flatMap((id) => all.find((a) => a.id === id)?.refs ?? [])]
  for (const id of ids) {
    const person = all.find((a) => a.id === id && a.kind === "person")
    if (person && allCreators().some((c) => c.id === person.label)) return person.label
  }
  return undefined
}

/** The cast model an asset was shot on, following refs one level down (lookbook → on-model → base body). */
export function castOf(asset: Asset, all: Asset[]): { modelId: string; view: CastView } | undefined {
  if (asset.kind === "person") return castParts(asset.label)
  const refs = [...asset.refs, ...asset.refs.flatMap((id) => all.find((a) => a.id === id)?.refs ?? [])]
  for (const id of refs) {
    const parts = castParts(all.find((a) => a.id === id && a.kind === "person")?.label)
    if (parts) return parts
  }
  return undefined
}

/** One approved asset per slot: kind + label (a UGC shot, or the reel), and for UGC also the creator (each hook is shot by several creators). */
function slot(asset: Asset, all: Asset[]): string {
  const ugc = asset.kind === "ugc-frame" || asset.kind === "ugc-clip" || asset.kind === "ugc-video"
  return [asset.garmentId, asset.kind, (asset.label ?? "").replace(/\+lock$/, ""), ugc ? creatorOf(asset, all) : ""].join("|")
}

export async function setStatus(assetId: string, status: Asset["status"], by?: string): Promise<Asset> {
  return updateDb((db) => {
    const asset = db.assets.find((a) => a.id === assetId)
    if (!asset) throw new Error(`asset not found: ${assetId}`)
    if (status === "approved") {
      const key = slot(asset, db.assets)
      for (const other of db.assets) {
        if (other.id !== asset.id && other.status === "approved" && slot(other, db.assets) === key) {
          other.status = "draft"
          delete other.approvedBy
        }
      }
      asset.approvedBy = by ?? process.env.USER ?? "reviewer"
    } else {
      delete asset.approvedBy
    }
    asset.status = status
    return asset
  })
}

// ---------------------------------------------------------------- input

export async function seedArchive(garment: Garment, modelId: string): Promise<Asset> {
  const generated = await generateImage(modelId, { prompt: ARCHIVE_PROMPT, refs: [], aspect: "3:4" })
  return addGenerated(garment.id, "archive", generated, ARCHIVE_PROMPT, [])
}

export async function seedSketch(garment: Garment, archive: Asset, modelId: string): Promise<Asset> {
  const prompt = sketchPrompt(garment.brief)
  const generated = await generateImage(modelId, { prompt, refs: [archive.media], aspect: "4:3" })
  return addGenerated(garment.id, "sketch", generated, prompt, [archive.id])
}

/** An uploaded input (archive photo or flat), stored as-is. */
export function addInput(garmentId: string, kind: "archive" | "sketch", media: Media): Promise<Asset> {
  return addAsset(garmentId, kind, media, [])
}

/** The bozzetto of a product that exists only as a designer note. */
export async function sketchFromNote(garmentId: string, modelId: string): Promise<Asset> {
  const { garment } = await getGarment(garmentId)
  const prompt = productFromNotePrompt(garment.brief, garment.line)
  const generated = await generateImage(modelId, { prompt, refs: [], aspect: "4:3" })
  return addGenerated(garment.id, "sketch", generated, prompt, [])
}

/** The flat for a garment that arrived with an archive photo only. */
export async function flatFromArchive(garmentId: string, modelId: string): Promise<Asset> {
  const { garment, assets } = await getGarment(garmentId)
  const archive = must(assets, "archive")
  const { data: spec } = await askJson<DesignSpec>({ system: DESIGN_SPEC_SYSTEM, prompt: designSpecPrompt(garment.brief), images: [archive.media], temperature: 0.2 })
  const prompt = flatFromSpecPrompt(spec)
  const generated = await generateImage(modelId, { prompt, refs: [], aspect: "4:3" })
  return addGenerated(garment.id, "sketch", generated, prompt, [archive.id])
}

export async function extractDna(garmentId: string): Promise<GarmentDna> {
  const { garment, assets } = await getGarment(garmentId)
  const inputs = (["archive", "sketch"] as const)
    .map((kind) => ({ kind, asset: pick(assets, kind) }))
    .filter((x): x is { kind: "archive" | "sketch"; asset: Asset } => !!x.asset)
  if (!inputs.length) throw new Error("needs at least one archive photo or a flat")
  const { data, model } = await askJson<Omit<GarmentDna, "model" | "at">>({
    system: DNA_SYSTEM,
    prompt: dnaPrompt(garment, inputs.map((i) => i.kind)),
    images: inputs.map((i) => i.asset.media),
    temperature: 0.2,
  })
  const dna: GarmentDna = { ...data, model, at: new Date().toISOString() }
  await updateDb((db) => {
    const g = db.garments.find((x) => x.id === garment.id)
    if (g) {
      g.dna = dna
      delete g.dnaConfirmedAt
      delete g.shoot
    }
  })
  return dna
}

/** Rewrites material-related DNA fields using a brand LoRA tag vocabulary. */
export async function enrichDnaFromBrand(garmentId: string, brandId: string, note?: string): Promise<GarmentDna> {
  const brand = brandProfile(brandId)
  const { garment } = await getGarment(garmentId)
  if (!garment.dna) throw new Error("DNA missing: extract the constraints from the sketch first")
  const dna = garment.dna
  const identity = readIdentity()
  const { data, model } = await askJson<{
    summary: string
    fields: Array<{ key: string; value: string; source?: DnaField["source"] }>
    appliedTags?: string[]
  }>({
    system: BRAND_DNA_SYSTEM,
    prompt: brandDnaPrompt(garment, dna, brand, note, identity && identityBlock(identity)),
    temperature: 0.25,
  })
  const byKey = new Map(data.fields.map((f) => [f.key, f]))
  const tags = data.appliedTags?.length ? data.appliedTags.join(", ") : brand.id
  const next: GarmentDna = {
    summary: data.summary?.trim() || dna.summary,
    fields: dna.fields.map((f) => {
      const hit = byKey.get(f.key)
      if (!hit?.value?.trim()) return f
      return {
        ...f,
        value: hit.value.trim(),
        source: hit.source && ["sketch", "archive", "note", "invented", "measured"].includes(hit.source) ? hit.source : f.source,
      }
    }),
    model: `${model} · LoRA ${brand.label} (${tags})`,
    at: new Date().toISOString(),
  }
  await updateDb((db) => {
    const g = db.garments.find((x) => x.id === garment.id)
    if (g) {
      g.dna = next
      g.maison = brand.maison
      delete g.dnaConfirmedAt
      delete g.shoot
    }
  })
  return next
}

const PLAN_TEXTS = [
  "noun", "description", "identity", "lock", "outfit", "wear", "scale",
  "views.front", "views.back", "views.side",
  "details.detail-button.label", "details.detail-button.region", "details.detail-button.shot",
  "details.detail-fabric.label", "details.detail-fabric.region", "details.detail-fabric.shot",
  "ugc.wear", "ugc.show", "ugc.touch",
]

function missingInPlan(plan: Partial<ShootPlan>): string[] {
  const at = (path: string) => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], plan)
  const texts = [...PLAN_TEXTS, ...(plan.hardware === null ? [] : ["hardware.label", "hardware.target"])]
  const blank = texts.filter((path) => {
    const v = at(path)
    return typeof v !== "string" || !v.trim()
  })
  if (typeof plan.ugc?.over !== "boolean") blank.push("ugc.over")
  const pieces = plan.ugc?.pieces
  if (!Array.isArray(pieces) || !pieces.length || pieces.some((p) => typeof p !== "string" || !p.trim())) blank.push("ugc.pieces")
  return Array.isArray(plan.zones) && plan.zones.length ? blank : [...blank, "zones"]
}

/** The garment-specific sentences of every prompt, written from the DNA; see ShootPlan. */
export async function writeShootPlan(garmentId: string): Promise<ShootPlan> {
  const { garment } = await getGarment(garmentId)
  const dna = needDna(garment)
  const { data, model } = await askJson<Omit<ShootPlan, "model" | "at">>({
    system: SHOOT_SYSTEM,
    prompt: shootPrompt(garment, dna),
    temperature: 0.3,
  })
  const missing = missingInPlan(data)
  if (missing.length) throw new Error(`incomplete shoot plan: ${missing.join(", ")}`)
  const plan: ShootPlan = {
    ...data,
    ugc: { ...data.ugc, copy: data.ugc.copy ?? {} },
    backZones: Array.isArray(data.backZones) ? data.backZones : [],
    model,
    at: new Date().toISOString(),
  }
  await updateDb((db) => {
    const g = db.garments.find((x) => x.id === garment.id)
    if (g) g.shoot = plan
  })
  return plan
}

/** The shoot plan, written on first use for garments whose DNA predates it, or rewritten when it predates `ugc.over`, `scale` or `ugc.pieces`. */
export async function ensureShootPlan(garmentId: string): Promise<ShootPlan> {
  const { garment } = await getGarment(garmentId)
  const plan = garment.shoot
  const pieces = plan?.ugc.pieces
  const current = plan && typeof plan.ugc.over === "boolean" && !!plan.scale?.trim() && Array.isArray(pieces) && pieces.length > 0
  return current ? plan : writeShootPlan(garment.id)
}

export async function writePdp(garmentId: string): Promise<Pdp> {
  const { garment, assets } = await getGarment(garmentId)
  const dna = needDna(garment)
  const images = (["ghost-front", "ghost-back", "detail-button", "on-model"] as const)
    .map((k) => approved(assets, k)?.media)
    .filter((m): m is Media => !!m)
  const { data, model } = await askJson<Omit<Pdp, "model" | "at">>({
    system: PDP_SYSTEM,
    prompt: pdpPrompt(garment, dna),
    images,
    temperature: 0.5,
  })
  const pdp: Pdp = { ...data, model, at: new Date().toISOString() }
  await updateDb((db) => {
    const g = db.garments.find((x) => x.id === garment.id)
    if (g) g.pdp = pdp
  })
  return pdp
}

// ---------------------------------------------------------------- references

/**
 * Close-up of the plan's hardware, cropped (not generated) from the approved front packshot when there is one, else from the archive.
 * Passing a crop instead of the whole archive photo keeps its dress form and window out of the generations.
 */
export async function buttonRef(garmentId: string): Promise<Asset | undefined> {
  const { assets } = await getGarment(garmentId)
  const hardware = (await ensureShootPlan(garmentId)).hardware
  const source = approved(assets, "ghost-front") ?? pick(assets, "archive")
  if (!hardware || !source) return undefined
  const existing = assets.find((a) => a.kind === "crop" && a.label === "button" && a.refs[0] === source.id && (a.prompt ?? hardware.target) === hardware.target)
  if (existing) return existing
  const boxes = await locate(source.media, [hardware.target])
  if (!boxes[hardware.target]) throw new Error(`${hardware.label} not found in the source image`)
  const media = await crop(source.media, boxes[hardware.target], 0.8)
  return addAsset(garmentId, "crop", media, [source.id], { label: "button", prompt: hardware.target })
}

/** The area a close-up must show, cropped from the approved front so the detail cannot rearrange the garment. */
async function regionRef(garmentId: string, kind: AssetKind): Promise<Asset | undefined> {
  if (kind !== "detail-button" && kind !== "detail-fabric") return undefined
  const plan = await ensureShootPlan(garmentId)
  if (kind === "detail-button" && plan.hardware) return buttonRef(garmentId)
  const target = plan.details[kind].region
  const { assets } = await getGarment(garmentId)
  const front = approved(assets, "ghost-front")
  if (!front) return undefined
  const label = `region:${kind}`
  const existing = assets.find((a) => a.kind === "crop" && a.label === label && a.refs[0] === front.id && (a.prompt ?? target) === target)
  if (existing) return existing
  const boxes = await locate(front.media, [target])
  if (!boxes[target]) throw new Error(`detail area not found on the front: ${target}`)
  const media = await crop(front.media, boxes[target], 0.1)
  return addAsset(garmentId, "crop", media, [front.id], { label, prompt: target })
}

/**
 * Reference set for a view. A flat is the construction reference when the product has one.
 * A product that arrived with locked views uses those views instead.
 * Close-ups start from their crop of the front: the layout comes from the photo, not from the prompt.
 */
async function refsFor(garmentId: string, kind: AssetKind): Promise<Array<{ asset: Asset; role: RefRole }>> {
  const { assets } = await getGarment(garmentId)
  const front = approved(assets, "ghost-front")
  const region = front && kind.startsWith("detail-") ? await regionRef(garmentId, kind) : undefined
  if (front && region) {
    const button = kind === "detail-button" ? undefined : await buttonRef(garmentId).catch(() => undefined)
    return [
      { asset: region, role: "region" },
      { asset: front, role: "front" },
      ...(button ? [{ asset: button, role: "button" as const }] : []),
    ]
  }
  const sketch = pick(assets, "sketch")
  const side = approved(assets, "ghost-side")
  const button = await buttonRef(garmentId).catch(() => undefined)
  const refs: Array<{ asset: Asset; role: RefRole }> = []
  if (sketch) refs.push({ asset: sketch, role: "sketch" })
  else if (front) refs.push({ asset: front, role: "front" })
  else throw new Error('missing the flat or a locked view')
  if (sketch && front && kind !== "ghost-front") refs.push({ asset: front, role: "front" })
  if (!sketch && side && kind !== "ghost-side") refs.push({ asset: side, role: "side" })
  if (button) refs.push({ asset: button, role: "button" })
  return refs
}

/**
 * Front, side and button close-up of the approved packshots, the reference set for everything worn.
 * Once the 3D is approved its front render takes the concept's place: the concept is drawn, the render is to size.
 */
async function wornRefs(garmentId: string, assets: Asset[]): Promise<Array<{ asset: Asset; role: RefRole }>> {
  const model = approved(assets, "mesh-front")
  const front = model ?? approved(assets, "ghost-front")
  if (!front) throw new Error("needs an approved ghost-front")
  const side = approved(assets, "ghost-side")
  const button = await buttonRef(garmentId).catch(() => undefined)
  return [
    { asset: front, role: model ? "model" : "front" },
    ...(side ? [{ asset: side, role: "side" as const }] : []),
    ...(button ? [{ asset: button, role: "button" as const }] : []),
  ]
}

/**
 * Front, side and back of the approved packshots, sent with a clip so a turn does not invent the product.
 * The 3D front render replaces the concept once it is approved.
 */
function clipProductRefs(assets: Asset[]): Array<{ asset: Asset; role: RefRole }> {
  const model = approved(assets, "mesh-front")
  const front = model ?? approved(assets, "ghost-front")
  const side = approved(assets, "ghost-side")
  const back = approved(assets, "ghost-back")
  return [
    ...(front ? [{ asset: front, role: (model ? "model" : "front") as RefRole }] : []),
    ...(side ? [{ asset: side, role: "side" as const }] : []),
    ...(back ? [{ asset: back, role: "back" as const }] : []),
  ]
}

/** Worn shots keep the back packshot in the same slot as when they were generated. */
function withBack(worn: Array<{ asset: Asset; role: RefRole }>, back: Asset | undefined) {
  return back ? [worn[0], { asset: back, role: "back" as const }, ...worn.slice(1)] : worn
}

/**
 * What a correction gets next to the image to edit: the same reference set the image was generated from,
 * so a fix on an on-model or studio shot cannot drift towards the technical flat.
 */
async function refineRefs(source: Asset, assets: Asset[]): Promise<Array<{ asset: Asset; role: RefRole }>> {
  if (source.kind === "person") return []
  if (source.kind === "ugc-frame" && ugcShot(source.label)?.shot.garment === "own") return []
  if (source.kind === "on-model" || source.kind === "lookbook" || source.kind === "ugc-frame") {
    const look = source.kind === "lookbook" ? STUDIO_LOOKS.find((l) => l.id === source.label) : undefined
    const showsBack = source.kind === "ugc-frame" && ugcShot(source.label)?.shot.shows === "back"
    return withBack(await wornRefs(source.garmentId, assets), look?.view === "back" || showsBack ? approved(assets, "ghost-back") : undefined)
  }
  return (await refsFor(source.garmentId, source.kind)).filter((r) => r.asset.id !== source.id)
}

// ---------------------------------------------------------------- QA

/**
 * Visual QA when someone asks for it. Generation does not call this.
 * Worn shots are included so a measured size can be checked against the hand and the body.
 */
const VISUAL_QA: AssetKind[] = QA_KINDS

/** QA against the DNA. The flat is the identity reference when the product has one; otherwise the locked front. */
async function qaMedia(garmentId: string, media: Media, kind: AssetKind): Promise<Qa> {
  const { garment, assets } = await getGarment(garmentId)
  const dna = needDna(garment)
  const plan = await ensureShootPlan(garmentId)
  const sketch = pick(assets, "sketch")
  const front = approved(assets, "ghost-front")
  const identity = kind === "ghost-front" ? sketch : (front ?? sketch)
  const button = plan.hardware ? await buttonRef(garmentId).catch(() => undefined) : undefined

  const images = [media, ...(identity ? [identity.media] : []), ...(button ? [button.media] : [])]
  const imageLines = [
    `CANDIDATE (${kind})`,
    ...(identity ? [identity.kind === "sketch" ? "technical flat" : "locked product view"] : []),
    ...(button ? [`reference close-up of ${plan.hardware!.label}`] : []),
  ]
  const prompt = qaPrompt({ dna, kind, deliverable: shotSpec(kind, plan), scale: plan.scale, imageLines })
  const { data, model } = await askJson<Pick<Qa, "checks" | "artifacts">>({ system: QA_SYSTEM, prompt, images, temperature: 0.2 })
  const checks = data.checks ?? []
  const artifacts = data.artifacts ?? []
  return { score: qaScore(checks, artifacts), checks, artifacts, model, at: new Date().toISOString() }
}

/** Optional DNA and scale check, only when someone asks. Clips are not listened to. */
export async function qaAsset(assetId: string): Promise<Qa | undefined> {
  const db = await readDb()
  const asset = db.assets.find((a) => a.id === assetId)
  if (!asset) throw new Error(`asset not found: ${assetId}`)
  if (!VISUAL_QA.includes(asset.kind)) return undefined
  const qa = await qaMedia(asset.garmentId, asset.media, asset.kind)
  await updateDb((d) => {
    const a = d.assets.find((x) => x.id === assetId)
    if (a) a.qa = qa
  })
  return qa
}

// ---------------------------------------------------------------- generation

export type Candidate = { modelId: string; asset?: Asset; qa?: Qa; error?: string }

async function candidates(modelIds: string[], make: (modelId: string) => Promise<Asset>): Promise<Candidate[]> {
  return Promise.all(
    modelIds.map(async (modelId) => {
      try {
        const asset = await make(modelId)
        return { modelId, asset }
      } catch (err) {
        return { modelId, error: err instanceof Error ? err.message : String(err) }
      }
    }),
  )
}

/** One canonical view. The DNA check is a separate button on the front, not part of this. */
export async function generateCanon(garmentId: string, kind: AssetKind, modelIds: string[]): Promise<Candidate[]> {
  const { garment } = await getGarment(garmentId)
  const dna = needDna(garment)
  const plan = await ensureShootPlan(garment.id)
  const refs = await refsFor(garmentId, kind)
  const prompt = canonPrompt(kind, dna, plan, refs.map((r) => r.role))
  return candidates(modelIds, async (modelId) => {
    const generated = await generateImage(modelId, { prompt, refs: refs.map((r) => r.asset.media), aspect: "3:4" })
    return addGenerated(garment.id, kind, generated, prompt, refs.map((r) => r.asset.id))
  })
}

const hasLive = (assets: Asset[], kind: AssetKind) => assets.some((a) => a.kind === kind && a.status !== "rejected")

/**
 * Every product view that does not have one yet. The front goes first and is approved, so the others can use it
 * as their reference; those then run together. A view that already has a candidate is left as it is.
 */
export async function generateAllCanon(
  garmentId: string,
  modelIds: string[],
  mark: { phase: (text: string) => void; slots: (kinds: string[]) => void },
): Promise<Candidate[]> {
  const out: Candidate[] = []
  let { assets, garment } = await getGarment(garmentId)
  if (!approved(assets, "ghost-front")) {
    if (!hasLive(assets, "ghost-front")) {
      mark.slots(["ghost-front"])
      mark.phase("Generating the front")
      const front = await generateCanon(garmentId, "ghost-front", modelIds)
      out.push(...front)
      const chosen = best(front)
      if (!chosen) throw new Error(`Front failed: ${front.find((r) => r.error)?.error ?? "no candidate"}`)
      await setStatus(chosen.id, "approved", "auto")
    } else {
      const existing = pick(assets, "ghost-front")
      if (!existing) throw new Error("the front is missing")
      mark.phase("Approving the front already generated")
      await setStatus(existing.id, "approved", "auto")
    }
    ;({ assets, garment } = await getGarment(garmentId))
  }

  const pending = renderSlots(garment.shoot)
    .map((s) => s.kind)
    .filter((kind) => kind !== "ghost-front" && !hasLive(assets, kind))
  if (!pending.length) return out
  mark.slots(pending)
  mark.phase(`Generating ${pending.map((kind) => slotLabel(garment.shoot, kind).toLowerCase()).join(", ")}`)
  const batches = await Promise.all(
    pending.map(async (kind) => {
      try {
        return await generateCanon(garmentId, kind, modelIds)
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        return modelIds.map((modelId): Candidate => ({ modelId, error }))
      }
    }),
  )
  return [...out, ...batches.flat()]
}

/** The approved concept. Image-to-3D reads a realistic product photo far better than line art. */
function meshSource(assets: Asset[]): Asset | undefined {
  return approved(assets, "ghost-front") ?? approved(assets, "ghost-side")
}

/** A model the operator refined outside and sent back. It enters as a candidate, next to the generated ones. */
export async function addOperatorMesh(garmentId: string, media: Media, label: "operatore" | "pixal3d" = "operatore", operator?: Operator): Promise<Asset> {
  const { assets } = await getGarment(garmentId)
  const source = meshSource(assets)
  if (!source) throw new Error("needs the approved concept")
  const base = approved(assets, "mesh") ?? (operator ? assets.filter((a) => a.kind === "mesh" && a.status !== "rejected" && a.label !== "operatore").at(-1) : undefined)
  return addAsset(garmentId, "mesh", media, [source.id, ...(base ? [base.id] : [])], { label, ...(operator ? { operator } : {}) })
}

/**
 * The operator's pass prepared before the demo: the refined GLB and its operator.json (minutes, changes, tool)
 * enter as if the operator had just sent them back.
 */
/**
 * A lifestyle scene from the approved packshots, for garments without a scene from the external layout → 3D → Qwen
 * pipeline: the product alone in a real interior, the same piece as the front and the fabric close-up.
 */
export async function generateScene(garmentId: string, modelIds: string[], setting: string): Promise<Candidate[]> {
  const { garment, assets } = await getGarment(garmentId)
  const plan = await ensureShootPlan(garmentId)
  const front = approved(assets, "ghost-front")
  if (!front) throw new Error("needs the approved front")
  const refs = [front, approved(assets, "detail-fabric")].filter((a): a is Asset => !!a)
  const prompt = `Editorial lifestyle still life for a fashion e-commerce product page. ${setting} No person, no mannequin, no text, no logos.
Image 1 is the approved packshot of the ${plan.noun}${refs.length > 1 ? "; Image 2 is a close-up of its fabric" : ""}. The ${plan.noun} is identical to the packshot: ${plan.description}, with ${plan.identity}. Keep ${plan.lock} identical; do not redesign the ${plan.noun}.
Natural window light, soft shadows, true-to-life colour, shot on a 50 mm lens at eye level, photographic realism.`
  return candidates(modelIds, async (modelId) => {
    const generated = await generateImage(modelId, { prompt, refs: refs.map((r) => r.media), aspect: "4:3" })
    return addGenerated(garment.id, "scene", generated, prompt, refs.map((r) => r.id))
  })
}

/**
 * The operator pass prepared for a garment before the demo: DEMO_OPERATOR_GLB when set, else
 * demo/operator/<sku>/model.glb, else the Cabas pass in demo/operator/cabas.glb for the Cabas only.
 * Each GLB has its operator.json next to it. Undefined when this garment has none.
 */
export function operatorGlbFor(sku: string): string | undefined {
  const dir = join(process.cwd(), "demo", "operator")
  const candidates = [process.env.DEMO_OPERATOR_GLB, join(dir, sku, "model.glb"), sku === "DEMO-CABAS-01" ? join(dir, "cabas.glb") : undefined]
  return candidates.find((p): p is string => !!p && existsSync(p) && existsSync(join(dirname(p), "operator.json")))
}

export async function simulateOperator(garmentId: string, glb: string): Promise<Asset> {
  const notes = JSON.parse(await readFile(join(dirname(glb), "operator.json"), "utf8")) as Omit<Operator, "simulated">
  const media = await saveBuffer(await readFile(glb), ".glb")
  return addOperatorMesh(garmentId, media, "operatore", { ...notes, simulated: true })
}

/** Every open image-to-3D model, from a product view that already exists. */
export async function generateMeshes(garmentId: string, modelIds: string[]): Promise<Candidate[]> {
  const { garment, assets } = await getGarment(garmentId)
  const source = meshSource(assets)
  if (!source) throw new Error("needs the approved concept")
  const prompt = garment.shoot?.noun ?? "garment"
  return candidates(modelIds, async (modelId) => {
    const generated = await generateMesh(modelId, { image: source.media, prompt })
    return addGenerated(garment.id, "mesh", generated, prompt, [source.id])
  })
}

// ---------------------------------------------------------------- the cast

/** The cast view of one model, approved if one is, else the most recent candidate. */
export function castAsset(assets: Asset[], modelId: string, view: CastView): Asset | undefined {
  return pick(assets, "person", castLabel(modelId, view))
}

async function castAssets(): Promise<Asset[]> {
  return (await readDb()).assets.filter((a) => a.garmentId === CAST_ID)
}

/**
 * One base body of the cast, generated on first use and then shared by every garment.
 * The back and side views are generated from the approved front view, so the three are the same woman.
 */
export async function ensureCastView(modelId: string, view: CastView, imageModelId: string): Promise<Asset> {
  const existing = castAsset(await castAssets(), modelId, view)
  if (existing) return existing
  const front = view === "front" ? undefined : await ensureCastView(modelId, "front", imageModelId)
  const prompt = castPrompt(castModel(modelId), view, !!front)
  const generated = await generateImage(imageModelId, { prompt, refs: front ? [front.media] : [], aspect: "3:4" })
  return addAsset(CAST_ID, "person", generated.media, front ? [front.id] : [], {
    prompt,
    gen: generated.gen,
    label: castLabel(modelId, view),
  })
}

/** The whole set: every model in front, back and three-quarter view. Front first, the other views follow it. */
export async function ensureCast(imageModelId: string, modelIds: string[] = CAST.map((m) => m.id)): Promise<Asset[]> {
  const perModel = await Promise.all(
    modelIds.map(async (id) => {
      await ensureCastView(id, "front", imageModelId)
      return Promise.all(CAST_VIEWS.map((view) => ensureCastView(id, view, imageModelId)))
    }),
  )
  return perModel.flat()
}

/**
 * A correction on a base body stays in the cast, with no garment in play: it is a reference, not a shot of a garment.
 * No QA either, for the same reason: there is no DNA to check it against.
 */
async function refineCastView(source: Asset, instruction: string, modelIds: string[]): Promise<Candidate[]> {
  const prompt = castRefinePrompt(instruction)
  return Promise.all(
    modelIds.map(async (modelId): Promise<Candidate> => {
      try {
        const generated = await generateImage(modelId, { prompt, refs: [source.media], aspect: "3:4" })
        const asset = await addAsset(CAST_ID, "person", generated.media, [source.id], {
          prompt,
          gen: generated.gen,
          ...(source.label ? { label: source.label } : {}),
        })
        return { modelId, asset }
      } catch (err) {
        return { modelId, error: err instanceof Error ? err.message : String(err) }
      }
    }),
  )
}

// ---------------------------------------------------------------- worn

/** The base body dressed by an image editor fed with the whole approved reference set. */
export async function generateOnModel(garmentId: string, personId: string, modelIds: string[]): Promise<Candidate[]> {
  const { garment, assets } = await getGarment(garmentId)
  needDna(garment)
  const plan = await ensureShootPlan(garment.id)
  const person = assets.find((a) => a.id === personId && a.kind === "person")
  if (!person) throw new Error(`person not found: ${personId}`)
  const refs = await wornRefs(garmentId, assets)
  const prompt = gendered(onModelPrompt(plan, refs.map((r) => r.role)), lineOf(garment))
  return candidates(modelIds, async (modelId) => {
    const generated = await generateImage(modelId, { prompt, refs: [person.media, ...refs.map((r) => r.asset.media)], aspect: "3:4" })
    return addGenerated(garment.id, "on-model", generated, prompt, [person.id, ...refs.map((r) => r.asset.id)])
  })
}

/**
 * A studio editorial look on the PDP model; back looks also get the approved back packshot.
 * `modelRefId` is the approved on-model shot when there is one, so its styling carries into the lookbook.
 * A back look additionally gets the model's own back view from the cast, so the figure turning away is not invented.
 */
export async function generateStudio(garmentId: string, modelRefId: string, lookId: string, modelIds: string[]): Promise<Candidate[]> {
  const { garment, assets } = await getGarment(garmentId)
  needDna(garment)
  const plan = await ensureShootPlan(garment.id)
  const person = assets.find((a) => a.id === modelRefId && (a.kind === "person" || a.kind === "on-model"))
  if (!person) throw new Error(`model not found: ${modelRefId}`)
  const look = studioLook(lookId)
  const cast = castOf(person, assets)
  const backView = look.view === "back" && cast ? castAsset(assets, cast.modelId, "back") : undefined
  const people = [person, ...(backView && backView.id !== person.id ? [backView] : [])]
  const refs = withBack(await wornRefs(garmentId, assets), look.view === "back" ? approved(assets, "ghost-back") : undefined)
  const prompt = gendered(
    studioPrompt(plan, refs.map((r) => r.role), look, {
      worn: person.kind === "on-model",
      back: people.length > 1,
    }),
    lineOf(garment),
  )
  return candidates(modelIds, async (modelId) => {
    const generated = await generateImage(modelId, {
      prompt,
      refs: [...people.map((p) => p.media), ...refs.map((r) => r.asset.media)],
      aspect: "3:4",
    })
    const refIds = [...people.map((p) => p.id), ...refs.map((r) => r.asset.id)]
    return addAsset(garment.id, "lookbook", generated.media, refIds, { prompt, gen: generated.gen, label: look.id })
  })
}

/** The creator's reference photo, generated once per creator id in the cast and reused by every garment. */
export async function ensureCreator(creatorId: string, modelId: string): Promise<Asset> {
  const existing = pick(await castAssets(), "person", creatorId)
  if (existing) return existing
  const prompt = creatorPrompt(creator(creatorId))
  const generated = await generateImage(modelId, { prompt, refs: [], aspect: "9:16" })
  return addAsset(CAST_ID, "person", generated.media, [], { prompt, gen: generated.gen, label: creatorId })
}

/** The approved asset of one shot (or of the reel, with `shotId` omitted) for one creator. */
function approvedUgc(assets: Asset[], kind: AssetKind, creatorId: string, formatId: string, shotId?: string): Asset | undefined {
  const label = shotId ? shotLabel(formatId, shotId) : formatId
  return assets.find((a) => a.kind === kind && a.status === "approved" && a.label === label && creatorOf(a, assets) === creatorId)
}

function pickShots(format: UgcFormat, shotIds?: string[]) {
  const shots = shotIds?.length ? format.shots.filter((s) => shotIds.includes(s.id)) : format.shots
  if (!shots.length) throw new Error(`unknown shot for ${format.id}: ${shotIds?.join(", ")}`)
  return shots
}

/** The last frame of a clip: the state the next shot continues. */
async function clipStill(clip: Asset): Promise<Media | undefined> {
  try {
    const [still] = await extractFrames(clip.media, [1])
    return still?.media
  } catch {
    return undefined
  }
}

/**
 * First frames of the shots of a reel (all of them by default), for every template. Each shot after the first continues
 * the whole look of the previous one: clothes, shoes, accessories and props. The shot's own action is the only change,
 * so a reel that opens on the finished look can cut to a different state when that next shot says so. Continuity follows
 * the order the look is built, not the order the edit plays it back. The previous moment is the last frame of that
 * shot's clip when the clip is newer than its frame, otherwise the frame itself. The first shot's frame is also the
 * room. Shots in one batch run in that order, so each can see the one just made.
 */
export async function generateUgcFrames(
  garmentId: string,
  personId: string,
  formatId: string,
  modelIds: string[],
  shotIds?: string[],
): Promise<Candidate[]> {
  const { garment, assets } = await getGarment(garmentId)
  needDna(garment)
  const plan = await ensureShootPlan(garment.id)
  const person = assets.find((a) => a.id === personId && a.kind === "person")
  if (!person) throw new Error(`creator not found: ${personId}`)
  const c = creator(person.label ?? CREATORS[0].id)
  const format = ugcFormat(formatId)
  const shots = pickShots(format, shotIds)
  const garmentRefs = await wornRefs(garmentId, assets)
  const onModel = approved(assets, "on-model")
  const wanted = new Set(shots.map((s) => s.id))
  const fresh = new Map<string, Asset>()
  const out: Candidate[] = []

  const stillOf = async (shot: UgcShot): Promise<{ media: Media; id: string } | undefined> => {
    const made = fresh.get(shot.id)
    if (made) return { media: made.media, id: made.id }
    const clip = approvedUgc(assets, "ugc-clip", c.id, format.id, shot.id)
    const frame = approvedUgc(assets, "ugc-frame", c.id, format.id, shot.id)
    // a frame regenerated after its clip is the newer truth; the clip end wins only when it came after that frame
    const clipIsNewer = !!clip && (!frame || clip.createdAt > frame.createdAt)
    if (clip && clipIsNewer) {
      const end = await clipStill(clip)
      if (end) return { media: end, id: clip.id }
    }
    return frame ? { media: frame.media, id: frame.id } : undefined
  }

  for (const shot of format.shots) {
    if (!wanted.has(shot.id)) continue
    const index = format.shots.findIndex((s) => s.id === shot.id)
    const prev = index > 0 ? format.shots[index - 1] : undefined
    const carry = prev ? await stillOf(prev) : undefined
    // the room is the first shot's frame, even when the previous moment is the end of a later clip
    const plateFrame = index > 0 ? (fresh.get(format.shots[0].id) ?? approvedUgc(assets, "ugc-frame", c.id, format.id, format.shots[0].id)) : undefined
    const plateStill = plateFrame ? { media: plateFrame.media, id: plateFrame.id } : undefined
    const combined = !!(plateStill && carry && plateStill.id === carry.id)
    const back = shot.shows === "back" && shot.garment !== "own" ? approved(assets, "ghost-back") : undefined
    const refs = shot.garment === "own" ? [] : withBack(garmentRefs, back)
    const styling = shot.garment === "wears" && !plan.ugc.over ? onModel : undefined
    const prompt = gendered(
      ugcFramePrompt(plan, refs.map((r) => r.role), shot, c, !!styling, {
        plate: !!plateStill,
        carry: !!carry,
        combined,
      }),
      lineOf(garment),
    )
    const extra: { media: Media; id: string }[] = []
    if (plateStill && !combined) extra.push(plateStill)
    if (carry && !combined) extra.push(carry)
    if (combined && plateStill) extra.push(plateStill)
    const batch = await candidates(modelIds, async (modelId) => {
      const images = [person.media, ...(styling ? [styling.media] : []), ...refs.map((r) => r.asset.media), ...extra.map((e) => e.media)]
      const generated = await generateImage(modelId, { prompt, refs: images, aspect: "9:16" })
      const refIds = [person.id, ...(styling ? [styling.id] : []), ...refs.map((r) => r.asset.id), ...extra.map((e) => e.id)]
      return addAsset(garment.id, "ugc-frame", generated.media, refIds, { prompt, gen: generated.gen, label: shotLabel(format.id, shot.id) })
    })
    const chosen = best(batch)
    if (chosen) fresh.set(shot.id, chosen)
    out.push(...batch)
  }
  return out
}

/** One script for the whole reel, split per shot by `shotDialogue`, so the lines run across the cuts. */
export async function writeScript(garmentId: string, formatId: string, voiceId?: string): Promise<Script> {
  const plan = await ensureShootPlan(garmentId)
  return (await askJson<Script>({ system: SPOKEN_SYSTEM, prompt: scriptPrompt(plan, ugcFormat(formatId), ugcVoice(voiceId)), temperature: 0.9 })).data
}

/**
 * The clips of a reel (all shots by default), each from its approved first frame. One script is written for the whole
 * reel and split per shot, so the lines run across the cuts; `voice` is an id of UGC_VOICES.
 */
export async function generateUgcClips(
  garmentId: string,
  creatorId: string,
  formatId: string,
  modelIds: string[],
  opts: { shots?: string[]; voice?: string; script?: Script } = {},
): Promise<Candidate[]> {
  const { garment, assets } = await getGarment(garmentId)
  needDna(garment)
  const plan = await ensureShootPlan(garment.id)
  const format = ugcFormat(formatId)
  const shots = pickShots(format, opts.shots)
  const frames = shots.map((shot) => ({ shot, frame: approvedUgc(assets, "ugc-frame", creatorId, format.id, shot.id) }))
  const missing = frames.filter((f) => !f.frame).map((f) => f.shot.label)
  if (missing.length) throw new Error(`needs the approved frame of: ${missing.join(", ")}`)
  const person = pick(assets, "person", creatorId)
  if (!person) throw new Error(`creator not found: ${creatorId}`)

  const voice = ugcVoice(opts.voice)
  const speaking = format.shots.filter((s) => s.voice !== "none")
  const script = opts.script ?? (speaking.length ? await writeScript(garment.id, format.id, voice.id) : { shots: [] })

  return (
    await Promise.all(
      frames.map(({ shot, frame }) => {
        const lines = shot.voice !== "none" ? (script.shots ?? []).find((s) => s.id === shot.id)?.lines ?? [] : []
        const said = shotDialogue(lines, shot, voice, speaking[0]?.id === shot.id)
        const views = shot.garment === "own" ? [] : clipProductRefs(assets)
        const prompt = gendered(ugcVideoPrompt(plan, shot, voice, said, views.map((r) => r.role)), lineOf(garment))
        return candidates(modelIds, async (modelId) => {
          const generated = await generateVideo(modelId, {
            prompt,
            frame: frame!.media,
            durationSec: shot.seconds,
            ...(views.length ? { refs: views.map((r) => r.asset.media) } : {}),
            ...(shot.loop ? { endFrame: frame!.media } : {}),
          })
          return addAsset(garment.id, "ugc-clip", generated.media, [frame!.id, person.id, ...views.map((r) => r.asset.id)], {
            prompt,
            gen: generated.gen,
            label: shotLabel(format.id, shot.id),
          })
        })
      }),
    )
  ).flat()
}

/** The first successful candidate. A stored QA score only breaks a tie. */
function best(results: Candidate[]): Asset | undefined {
  const ok = results.filter((r) => r.asset)
  return ([...ok].sort((a, b) => (b.qa?.score ?? -1) - (a.qa?.score ?? -1))[0] ?? ok[0])?.asset
}

/**
 * The whole reel in one go: frames of the shots still without one, the best of each approved, clips of the shots still
 * without one (one script across them), the best approved, then the cut. What is already approved is kept. The reel
 * itself stays a draft: the final call is the reviewer's.
 */
export async function autoReel(
  garmentId: string,
  personId: string,
  formatId: string,
  models: { frame: string[]; clip: string[] },
  voice: string | undefined,
  phase: (text: string) => void,
  musicId?: string,
): Promise<Asset> {
  const format = ugcFormat(formatId)
  const person = (await getGarment(garmentId)).assets.find((a) => a.id === personId)
  const creatorId = person?.label ?? ""
  const approvedOf = async (kind: AssetKind, shotId: string) => {
    const { assets } = await getGarment(garmentId)
    return approvedUgc(assets, kind, creatorId, format.id, shotId)
  }
  const approveEach = async (shots: UgcFormat["shots"], results: Candidate[], what: string) => {
    for (const shot of shots) {
      const pick = best(results.filter((r) => r.asset?.label === shotLabel(format.id, shot.id)))
      if (!pick) throw new Error(`${what} of “${shot.label}” failed: ${results.find((r) => r.error)?.error ?? "no candidate"}`)
      await setStatus(pick.id, "approved", "auto")
    }
  }
  const pendingVoice = []
  for (const shot of format.shots) {
    if (shot.voice !== "none" && !(await approvedOf("ugc-clip", shot.id))) pendingVoice.push(shot)
  }
  // one script for the whole reel, written while the first shots are made
  const script = pendingVoice.length ? writeScript(garmentId, format.id, voice) : undefined
  script?.catch(() => undefined)

  // one shot at a time: the next frame has to see the end of the clip just made, not a written description of it
  for (const shot of format.shots) {
    if (!(await approvedOf("ugc-frame", shot.id))) {
      phase(`Frame: ${shot.label.toLowerCase()}`)
      await approveEach([shot], await generateUgcFrames(garmentId, personId, format.id, models.frame, [shot.id]), "Frame")
    }
    if (!(await approvedOf("ugc-clip", shot.id))) {
      phase(`Clip: ${shot.label.toLowerCase()} (a few minutes)`)
      await approveEach([shot], await generateUgcClips(garmentId, creatorId, format.id, models.clip, { voice, script: await script, shots: [shot.id] }), "Clip")
    }
  }
  phase("Editing the reel")
  return assembleReel(garmentId, creatorId, format.id, musicId)
}

const MUSIC_PATH = join(DATA_DIR, "ugc-music.json")
const MUSIC_MODEL = "lyria2"

/**
 * A shared bed, generated once for every garment and creator, like the trending sound of a format.
 * A new file only when its prompt changes or `fresh` is asked.
 */
export async function ensureMusic(track: { id: string; prompt: string }, fresh = false): Promise<Media> {
  const saved: Record<string, { media: Media; prompt: string; gen: Generated["gen"] }> = existsSync(MUSIC_PATH) ? JSON.parse(await readFile(MUSIC_PATH, "utf8")) : {}
  const current = saved[track.id]
  if (!fresh && current?.prompt === track.prompt && existsSync(mediaPath(current.media))) return current.media
  const { media, gen } = await generateMusic(MUSIC_MODEL, { prompt: track.prompt, avoid: MUSIC_AVOID })
  saved[track.id] = { media, prompt: track.prompt, gen }
  await writeFile(MUSIC_PATH, JSON.stringify(saved, null, 2))
  return media
}

/**
 * The on-screen text of a reel: fixed by the template, or written once per garment and kept in its shoot plan
 * (`ugc.copy[format].line`), where the DNA step can edit it.
 */
export async function reelCaption(garmentId: string, format: UgcFormat): Promise<string | undefined> {
  if (!format.caption) return undefined
  if (format.caption.text) return format.caption.text
  const { garment } = await getGarment(garmentId)
  const plan = await ensureShootPlan(garmentId)
  const existing = plan.ugc.copy[format.id]?.line?.trim()
  if (existing) return existing
  const { data } = await askJson<{ hook?: string; line?: string }>({ ...captionPrompt(plan, format, lineOf(garment)), temperature: 0.9 })
  const line = data.line?.trim()
  if (!line) throw new Error(`on-screen text of “${format.label}” not written`)
  await updateDb((db) => {
    const shoot = db.garments.find((g) => g.id === garmentId)?.shoot
    if (shoot) shoot.ugc.copy[format.id] = { hook: shoot.ugc.copy[format.id]?.hook || data.hook?.trim() || "", line }
  })
  return line
}

/**
 * The cuts of a reel. A beat-cut template takes its edit list, several cuts per clip, each cut resized to the same
 * number of beats of the track's real tempo (`period`, seconds per beat). A talking reel keeps each shot once for its
 * planned cut, stretched to her last word plus the shot's tail so no sentence is chopped: the end of the voice is the
 * later of what the listener heard and where the audio track goes quiet. Either way the limit is the clip's real length.
 */
async function reelCuts(
  format: UgcFormat,
  clips: Array<{ shot: UgcShot; clip: Asset }>,
  period?: number,
): Promise<Array<{ shot: UgcShot; clip: Asset; from: number; to: number }>> {
  const sounds = new Map(await Promise.all(clips.map(async (c) => [c.shot.id, await soundEnd(c.clip.media)] as const)))
  if (format.edit) {
    const planned = format.music ? 60 / format.music.bpm : undefined
    return format.edit.map((cut) => {
      const c = clips.find((x) => x.shot.id === cut.shot)!
      const length = planned && period ? Math.max(1, Math.round((cut.to - cut.from) / planned)) * period : cut.to - cut.from
      const to = Math.min(cut.from + length, sounds.get(cut.shot)!.duration)
      return { ...c, from: Math.min(cut.from, to - 0.2), to }
    })
  }
  return clips.map((c) => {
    const sound = sounds.get(c.shot.id)!
    const voiceEnd = c.shot.voice === "none" ? 0 : Math.max(c.clip.speech?.end ?? 0, sound.end)
    return { ...c, from: 0, to: Math.min(sound.duration, Math.max(c.shot.cut, voiceEnd + c.shot.tail)) }
  })
}

/** The reel: the approved clip of every shot cut together, with the template's music. On-screen text stays off for now. */
export async function assembleReel(garmentId: string, creatorId: string, formatId: string, musicId?: string): Promise<Asset> {
  const { assets } = await getGarment(garmentId)
  const format = ugcFormat(formatId)
  const found = format.shots.map((shot) => ({ shot, clip: approvedUgc(assets, "ugc-clip", creatorId, format.id, shot.id) }))
  const missing = found.filter((c) => !c.clip).map((c) => c.shot.label)
  if (missing.length) throw new Error(`needs the approved clip of: ${missing.join(", ")}`)
  const clips = found as Array<{ shot: UgcShot; clip: Asset }>
  const person = pick(assets, "person", creatorId)
  if (!person) throw new Error(`creator not found: ${creatorId}`)
  const bed = format.music ? (musicId ? ugcTrack(musicId) : { id: format.id, prompt: format.music.prompt }) : undefined
  const music = bed ? await ensureMusic(bed) : undefined
  const grid = music ? await beatGrid(music) : undefined
  const cuts = await reelCuts(format, clips, grid?.period)
  const media = await montage(cuts.map((c) => ({ media: c.clip.media, from: c.from, to: c.to })), {
    music: music && grid ? { media: music, start: grid.offset } : undefined,
  })
  const reel = await addAsset(garmentId, "ugc-video", media, [...clips.map((c) => c.clip.id), person.id], {
    label: format.id,
  })
  // an older cut still in draft is superseded: left on the bench it gets watched instead of this one
  await updateDb((db) => {
    for (const a of db.assets) {
      if (a.id !== reel.id && a.kind === "ugc-video" && a.label === format.id && a.status === "draft" && a.refs.includes(person.id)) a.status = "rejected"
    }
  })
  return reel
}

/** Edits an existing asset changing one thing only; the result is a new candidate of the same kind. */
export async function refineAsset(assetId: string, instruction: string, modelIds: string[]): Promise<Candidate[]> {
  const db = await readDb()
  const source = db.assets.find((a) => a.id === assetId)
  if (!source) throw new Error(`asset not found: ${assetId}`)
  if (source.garmentId === CAST_ID) return refineCastView(source, instruction, modelIds)
  if (source.kind === "sketch") {
    const prompt = refineFlatPrompt(instruction)
    return candidates(modelIds, async (modelId) => {
      const generated = await generateImage(modelId, { prompt, refs: [source.media], aspect: "4:3" })
      return addAsset(source.garmentId, "sketch", generated.media, [source.id], { prompt, gen: generated.gen })
    })
  }
  const { garment, assets } = await getGarment(source.garmentId)
  const dna = needDna(garment)
  const plan = await ensureShootPlan(garment.id)
  const refs = (await refineRefs(source, assets)).filter((r) => r.asset.id !== source.id)
  const own = source.kind === "ugc-frame" && ugcShot(source.label)?.shot.garment === "own"
  const worn = !own && (source.kind === "on-model" || source.kind === "lookbook" || source.kind === "ugc-frame" || source.kind === "person")
  const prompt = own ? refineOwnPrompt(instruction) : refinePrompt(instruction, dna, plan, refs.map((r) => r.role), worn)
  return candidates(modelIds, async (modelId) => {
    const aspect = source.kind === "ugc-frame" || (source.kind === "person" && allCreators().some((c) => c.id === source.label)) ? "9:16" : "3:4"
    const generated = await generateImage(modelId, { prompt, refs: [source.media, ...refs.map((r) => r.asset.media)], aspect })
    const people = source.refs.filter((id) => db.assets.find((a) => a.id === id)?.kind === "person")
    const refIds = [source.id, ...refs.map((r) => r.asset.id), ...people]
    return addAsset(garment.id, source.kind, generated.media, refIds, { prompt, gen: generated.gen, ...(source.label ? { label: source.label } : {}) })
  })
}
