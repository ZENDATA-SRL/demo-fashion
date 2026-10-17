import { existsSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { join, relative } from "node:path"
import { CHANNEL_IDS, MARKET_IDS, archive, channelLabel, creativesOf, defaultPlan, economics, forecastFrom, impactOf, marketLabel, themeLabels } from "./campaign"
import { zoneKey } from "./focus"
import { castAsset, getGarment } from "./garment"
import { jobsFor } from "./jobs"
import { lineOf } from "./line"
import { CAST_VIEWS, VIEW_LABEL, allCast, castFor, castParts } from "./prompts/cast"
import { looksForStudio } from "./prompts/studio"
import { UGC_FORMATS, UGC_TRACKS, UGC_VOICES, allCreators, creatorsFor, planFor, reelSeconds, shotNote, shotSeconds, speaks, ugcShot } from "./prompts/ugc"
import { IMAGE_MODELS, MESH_MODELS, VIDEO_MODELS } from "./providers/registry"
import { stepStates } from "./steps"
import { CAST_ID, DATA_DIR, readDb } from "./store"
import type { Asset, AssetKind, CastView, QaCheck } from "./types"
import type { AssetView, CastMemberView, GarmentCard, ModelOption, Pace, Workspace } from "./workspace-types"

const KIND_LABEL: Record<string, string> = {
  "ghost-front": "Fronte",
  "ghost-back": "Retro",
  "ghost-side": "Tre quarti",
  "detail-button": "Dettaglio",
  "detail-fabric": "Tessuto",
  "on-model": "On-Model",
  lookbook: "Editorial",
  "ugc-frame": "Fotogramma",
  "ugc-clip": "Clip",
  "ugc-video": "Reel",
  sketch: "Concept Sketch",
  archive: "Archivio",
  mesh: "Mesh",
  "mesh-front": "Fronte dal 3D",
  scene: "Lifestyle",
  person: "Persona",
  crop: "Ritaglio",
}

const CHECK_LABEL: Record<string, string> = {
  deliverable: "Formato richiesto",
  scale: "Proporzioni",
  pieces: "Pezzi",
  "lip-sync": "Labiale",
  "speech-end": "Frase completa",
}

const ALL_MODELS = [
  ...IMAGE_MODELS.map((m) => ({ m, group: "image" as const })),
  ...VIDEO_MODELS.map((m) => ({ m, group: "video" as const })),
  ...MESH_MODELS.map((m) => ({ m, group: "mesh" as const })),
]

/** Models no longer offered: their past candidates stay in the workspace and keep a readable name. */
const RETIRED_LABEL: Record<string, string> = {
  "nano-banana-pro": "Nano Banana Pro",
  "gpt-image-2.5": "GPT Image 2.5 Flare",
  "flux-2-pro": "FLUX.2 Pro",
  "flux-2-dev": "FLUX.2 [dev]",
  "qwen-edit-2511": "Qwen Image Edit 2511",
  "seedream-4.5": "Seedream 4.5",
  "grok-imagine": "Grok Imagine",
  "fashn-v1.6": "FASHN v1.6",
  "kling-kolors": "Kling Kolors v1.5",
  "kling-3": "Kling 3.0 Pro",
  "seedance-2.5": "Seedance 2.5",
  "grok-imagine-video": "Grok Imagine Video",
}

const MODEL_LABEL = new Map([...Object.entries(RETIRED_LABEL), ...ALL_MODELS.map(({ m }) => [m.id, m.label] as const)])

function models(): ModelOption[] {
  return ALL_MODELS.map(({ m, group }) => ({
    id: m.id,
    label: m.label,
    note: m.note,
    provider: m.provider,
    weights: m.weights,
    hosting: m.hosting,
    usd: m.usd,
    group,
  }))
}

/** Video QA stores one check per frame (`key@5.0s`): one row per field, failing if any frame fails. */
function groupChecks(checks: QaCheck[]) {
  const byKey = new Map<string, QaCheck>()
  for (const c of checks) {
    const [raw, at] = c.key.split("@")
    const key = raw.split(":")[0]
    const note = at && !c.pass ? `${at}: ${c.note}` : c.note
    const prev = byKey.get(key)
    if (!prev || (prev.pass && !c.pass)) byKey.set(key, { key, pass: c.pass, note })
  }
  return [...byKey.values()]
}

const isCreator = (label?: string) => allCreators().some((c) => c.id === label)

function creatorOf(asset: Asset, all: Asset[]): string | undefined {
  if (asset.kind === "person") return isCreator(asset.label) ? asset.label : undefined
  // Direct refs first. A worn frame also cites the on-model photo, whose own ref is the cast body: that person
  // is earlier in the db, and taking the first person in the file would hide the frame from the creator.
  const ids = [...asset.refs, ...asset.refs.flatMap((id) => all.find((a) => a.id === id)?.refs ?? [])]
  for (const id of ids) {
    const person = all.find((a) => a.id === id && a.kind === "person")
    if (person && isCreator(person.label)) return person.label
  }
  return undefined
}

/**
 * Kept in the db, out of the workspace: portraits and clips of creators no longer in CREATORS, frames of shots no
 * longer in UGC_FORMATS, and the one-take videos from before the reels (animated straight from a frame).
 */
function retired(asset: Asset, all: Asset[]): boolean {
  if (asset.kind === "person") return !!asset.label?.startsWith("creator-")
  if (asset.kind !== "ugc-frame" && asset.kind !== "ugc-clip" && asset.kind !== "ugc-video") return false
  if (!creatorOf(asset, all)) return true
  if (asset.kind === "ugc-video") return all.find((a) => a.id === asset.refs[0])?.kind !== "ugc-clip"
  return !ugcShot(asset.label)
}

async function listFiles(dir: string, root = dir): Promise<string[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((e) => (e.isDirectory() ? listFiles(join(dir, e.name), root) : Promise.resolve([relative(root, join(dir, e.name))]))),
  )
  return nested.flat().sort()
}

/** Mean duration of every finished generation, grouped by the kind of image it produced. */
function generationPace(assets: Asset[]): Pace {
  const acc = new Map<string, { n: number; ms: number }>()
  for (const asset of assets) {
    const ms = asset.gen?.ms
    if (!ms) continue
    const row = acc.get(asset.kind) ?? { n: 0, ms: 0 }
    row.n += 1
    row.ms += ms
    acc.set(asset.kind, row)
  }
  return Object.fromEntries([...acc].map(([kind, row]) => [kind, { seconds: Math.max(1, Math.round(row.ms / row.n / 1000)), n: row.n }]))
}

export async function buildWorkspace(id: string): Promise<Workspace> {
  const { garment, assets } = await getGarment(id)
  const pace = generationPace((await readDb()).assets)
  const byId = new Map(assets.map((a) => [a.id, a]))
  const dnaLabel = new Map((garment.dna?.fields ?? []).map((f) => [f.key, f.label]))
  const label = (key: string) => CHECK_LABEL[key] ?? dnaLabel.get(key) ?? key.replace(/[-_]/g, " ")
  const src = (a: Asset) => `/api/media/${a.media.file}`
  const details = garment.shoot?.details
  const kindLabel = (kind: AssetKind) => (kind === "detail-button" || kind === "detail-fabric" ? details?.[kind].label : undefined) ?? KIND_LABEL[kind] ?? kind

  /** What a reference image is, as the inspector lists it: a cast view says which model and which angle. */
  const refLabel = (r: Asset) => {
    const cast = r.kind === "person" ? castParts(r.label) : undefined
    if (cast) return `${allCast().find((m) => m.id === cast.modelId)?.label ?? cast.modelId} · ${VIEW_LABEL[cast.view]}`
    if (r.label === "button") return "Ritaglio dettaglio"
    if (r.label?.startsWith("region:")) return "Zona dal fronte"
    return kindLabel(r.kind)
  }

  const view = (a: Asset): AssetView => {
    // a clip starts from its frame, a reel from its first clip, which starts from its frame
    const first = a.kind === "ugc-clip" || a.kind === "ugc-video" ? byId.get(a.refs[0]) : undefined
    const frame = first?.kind === "ugc-clip" ? byId.get(first.refs[0]) : first
    const plate = a.kind === "mesh" ? byId.get(a.refs[0]) : undefined
    const [format, shot] = a.kind.startsWith("ugc") ? (a.label ?? "").split(":") : []
    return {
      id: a.id,
      kind: a.kind,
      label: a.label,
      src: src(a),
      poster: frame ? src(frame) : plate ? src(plate) : undefined,
      video: a.media.file.endsWith(".mp4"),
      mesh: a.media.file.endsWith(".glb"),
      status: a.status,
      approvedBy: a.approvedBy,
      modelId: a.gen?.modelId ?? "",
      model: MODEL_LABEL.get(a.gen?.modelId ?? "") ?? (a.gen?.modelId || (a.label === "operatore" ? "Operatore" : a.label === "blender" ? "Render Blender dal 3D" : a.label === "scene" ? "Pipeline scena · qwen-loro" : a.label === "pixal3d" ? "Pixal3D · ComfyUI" : "Caricato")),
      weights: a.gen?.weights ?? "closed",
      hosting: a.gen?.hosting ?? "managed",
      seconds: Math.round((a.gen?.ms ?? 0) / 1000),
      usd: a.gen?.usd,
      qa: a.qa
        ? {
            score: a.qa.score,
            checks: groupChecks(a.qa.checks).map((c) => ({ ...c, label: label(c.key) })),
            artifacts: a.qa.artifacts,
            model: a.qa.model,
          }
        : undefined,
      prompt: a.prompt,
      refs: a.refs
        .map((rid) => byId.get(rid))
        .filter((r): r is Asset => !!r && !r.media.file.endsWith(".mp4"))
        .map((r) => ({ id: r.id, kind: r.kind, label: refLabel(r), src: src(r) })),
      refIds: a.refs,
      creator: creatorOf(a, assets),
      format,
      shot,
      focus: a.focus,
      operator: a.operator,
      measure: a.measure,
      createdAt: a.createdAt,
    }
  }

  const exportDir = join(DATA_DIR, "export", garment.sku)
  const exportFiles = garment.exportedAt ? await listFiles(exportDir) : []
  const confirmed = !!garment.dnaConfirmedAt || (!!garment.dna && assets.some((a) => a.kind === "ghost-front" && a.status === "approved"))

  return {
    garment: {
      id: garment.id,
      sku: garment.sku,
      name: garment.name,
      maison: garment.maison,
      brief: garment.brief,
      goal: garment.goal,
      line: lineOf(garment),
      createdAt: garment.createdAt,
      dna: garment.dna ? { summary: garment.dna.summary, fields: garment.dna.fields, model: garment.dna.model, at: garment.dna.at } : null,
      shoot: garment.shoot ?? null,
      dnaConfirmed: confirmed,
      pdp: garment.pdp ?? null,
      signoff: garment.signoff ?? null,
      exportedAt: garment.exportedAt ?? null,
    },
    assets: assets
      .filter((a) => !retired(a, assets) && (a.status === "approved" || !(a.gen?.modelId && a.gen.modelId in RETIRED_LABEL)))
      .map(view),
    jobs: jobsFor(garment.id),
    models: models(),
    cast: castFor(lineOf(garment)).map(
      (m): CastMemberView => ({
        id: m.id,
        label: m.label,
        note: m.note,
        views: Object.fromEntries(
          CAST_VIEWS.map((v) => [v, castAsset(assets, m.id, v)?.id] as const).filter((e): e is [CastView, string] => !!e[1]),
        ),
      }),
    ),
    creators: creatorsFor(lineOf(garment)).map((c, i) => ({ id: c.id, code: `V0${i + 1}`, name: c.name, age: String(c.age), city: c.city })),
    formats: UGC_FORMATS.map((f) => ({
      id: f.id,
      label: f.label,
      note: f.note,
      hook: garment.shoot?.ugc.copy[f.id]?.hook ?? "",
      seconds: reelSeconds(f),
      speaks: speaks(f),
      caption: f.caption?.text ?? garment.shoot?.ugc.copy[f.id]?.line ?? "",
      shots: f.shots.map((s) => ({ id: s.id, label: s.label, note: shotNote(s, garment.shoot), garment: s.garment, voice: s.voice, seconds: s.seconds, cut: shotSeconds(f, s) })),
    })),
    plan: planFor(lineOf(garment)),
    ugcVoices: UGC_VOICES.map(({ id, label, note }) => ({ id, label, note })),
    ugcTracks: UGC_TRACKS.map(({ id, label, note }) => ({ id, label, note })),
    looks: looksForStudio(garment.shoot).map((l) => ({ id: l.id, label: l.label, note: l.note, back: l.view === "back" })),
    zones: (garment.shoot?.zones ?? []).map((z) => ({ key: zoneKey(z), label: z.label })),
    exportFiles,
    // the cast is generated once and shared, so it is not part of what this garment cost
    cost: assets.filter((a) => a.garmentId !== CAST_ID).reduce((t, a) => t + (a.gen?.usd ?? 0), 0),
    pace,
    market: {
      plan: garment.campaign?.result.plan ?? defaultPlan(garment),
      creatives: creativesOf(assets),
      channels: CHANNEL_IDS.map((id) => ({ id, label: channelLabel(id) })),
      markets: MARKET_IDS.map((id) => ({ id, label: marketLabel(id) })),
      campaign: garment.campaign
        ? {
            result: garment.campaign.result,
            analysis: garment.campaign.analyses?.[garment.campaign.result.seed],
            forecast: forecastFrom(garment.campaign.result),
            impact: impactOf(assets, garment.campaign.result),
          }
        : null,
      archive: archive(),
      economics: economics(),
      themes: themeLabels(),
    },
  }
}

export async function listGarments(): Promise<GarmentCard[]> {
  const db = await readDb()
  const cards = await Promise.all(
    db.garments.map(async (g) => {
      const ws = await buildWorkspace(g.id)
      const thumb = ws.assets.find((a) => a.kind === "ghost-front" && a.status === "approved") ?? ws.assets.find((a) => a.kind === "sketch") ?? ws.assets.find((a) => a.kind === "archive")
      return {
        id: g.id,
        sku: g.sku,
        name: g.name,
        maison: g.maison,
        line: lineOf(g),
        thumb: thumb?.src,
        createdAt: g.createdAt,
        steps: stepStates(ws).map((s) => ({ id: s.id, status: s.status })),
        running: ws.jobs.filter((j) => j.status === "running").length,
      }
    }),
  )
  return cards.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
