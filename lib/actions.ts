import { analyzeCampaign } from "./campaign"
import { exportPack } from "./export"
import { computeFocus } from "./focus"
import {
  castAsset,
  castOf,
  ensureCastView,
  ensureCreator,
  enrichDnaFromBrand,
  extractDna,
  flatFromArchive,
  sketchFromNote,
  generateAllCanon,
  generateCanon,
  generateMeshes,
  generateOnModel,
  generateStudio,
  assembleReel,
  autoReel,
  generateUgcClips,
  generateUgcFrames,
  getGarment,
  pick,
  qaAsset,
  refineAsset,
  writePdp,
  writeShootPlan,
} from "./garment"
import { runningFor, startJob } from "./jobs"
import { lineOf } from "./line"
import { castFor, castModel } from "./prompts/cast"
import { STUDIO_LOOKS } from "./prompts/studio"
import { allCreators, speaks, ugcFormat, ugcVoice } from "./prompts/ugc"
import { BRAND_LORA_IDS, brandProfile } from "./brand-lora"
import { DEFAULT_MODELS, QA_KINDS, VIEW_SLOTS, slotLabel, studioKey, ugcKey } from "./steps"
import { readDb, updateDb } from "./store"
import type { Asset, AssetKind } from "./types"
import type { JobView } from "./workspace-types"

export type Action =
  | { type: "prepare" }
  | { type: "dna" }
  | { type: "brand-dna"; brandId: string; note?: string }
  | { type: "shoot" }
  | { type: "canon"; kind: AssetKind; models: string[] }
  /** front first, then every other product view that is still empty, together */
  | { type: "canon-all"; models: string[] }
  | { type: "refine"; assetId: string; instruction: string; models: string[] }
  /** `model` is the cast model to shoot on; the one already used for this garment by default */
  | { type: "onmodel"; models: string[]; model?: string }
  /** every cast model wears the garment, in parallel */
  | { type: "onmodel-all"; models: string[] }
  | { type: "studio"; look: string; models: string[] }
  /** `shots` are shot ids of the format, all of them when omitted */
  | { type: "ugc-frame"; creator: string; format: string; models: string[]; shots?: string[] }
  /** `voice` is an id of UGC_VOICES, the first when omitted */
  | { type: "ugc-clip"; creator: string; format: string; models: string[]; shots?: string[]; voice?: string }
  | { type: "ugc-reel"; creator: string; format: string; music?: string }
  /** frames, clips and cut in one go, auto-approving the best candidate of each shot */
  | { type: "ugc-auto"; creator: string; format: string; voice?: string; music?: string }
  | { type: "pdp" }
  | { type: "focus" }
  | { type: "export" }
  /** Optional garment check on the front packshot. Not part of generation. */
  | { type: "qa"; assetId: string }
  /** approved product view → GLB, one asset per open model */
  | { type: "mesh"; models: string[] }
  /** the text model reads the simulated market test and proposes the next actions */
  | { type: "campaign-analysis" }

const SEED_MODEL = "qwen-image-2.1-runpod"

/** " · enthusiastic voice" for a talking reel, nothing for one cut to music. */
const voiceNote = (format: ReturnType<typeof ugcFormat>, voice?: string) => (speaks(format) ? ` · ${ugcVoice(voice).label.toLowerCase()} voice` : "")

function shotNames(format: ReturnType<typeof ugcFormat>, shots?: string[]): string {
  const picked = shots?.length ? format.shots.filter((s) => shots.includes(s.id)) : format.shots
  return picked.length === format.shots.length ? "all shots" : picked.map((s) => s.label.toLowerCase()).join(", ")
}

/** The cast model this garment is being shot on: the one asked for, the one already worn here, else the first of the cast. */
async function castChoice(garmentId: string, asked?: string): Promise<string> {
  if (asked) return castModel(asked).id
  const { garment, assets } = await getGarment(garmentId)
  const worn = assets.filter((a) => a.kind === "on-model" && a.status !== "rejected").at(-1)
  const used = worn && castOf(worn, assets)
  return used?.modelId ?? castFor(lineOf(garment))[0].id
}

/** The base body of the chosen cast model, generated on first use and then shared by every garment. */
async function basePerson(garmentId: string, ctx: { phase: (text: string) => void }, asked?: string): Promise<Asset> {
  const modelId = await castChoice(garmentId, asked)
  const { assets } = await getGarment(garmentId)
  const existing = castAsset(assets, modelId, "front")
  if (existing) return existing
  ctx.phase(`Preparing ${castModel(modelId).label}`)
  return ensureCastView(modelId, "front", SEED_MODEL)
}

/**
 * The studio looks continue the on-model shot, so corrections approved there carry over; the base body is the fallback.
 * A back look also needs the model's own back view, generated here if the cast is not complete yet.
 */
async function studioModel(garmentId: string, look: string, ctx: { phase: (text: string) => void }): Promise<Asset> {
  const onModel = (await getGarment(garmentId)).assets.filter((a) => a.kind === "on-model" && a.status === "approved").at(-1)
  const person = onModel ?? (await basePerson(garmentId, ctx))
  if (STUDIO_LOOKS.find((l) => l.id === look)?.view === "back") {
    const { assets } = await getGarment(garmentId)
    const cast = castOf(person, assets)
    if (cast && !castAsset(assets, cast.modelId, "back")) {
      ctx.phase(`Preparing the back view of ${castModel(cast.modelId).label}`)
      await ensureCastView(cast.modelId, "back", SEED_MODEL)
    }
  }
  return person
}

function creatorOf(asset: Asset, all: Asset[]): string | undefined {
  const ids = [...asset.refs, ...asset.refs.flatMap((id) => all.find((a) => a.id === id)?.refs ?? [])]
  for (const id of ids) {
    const person = all.find((a) => a.id === id && a.kind === "person")
    if (person && allCreators().some((c) => c.id === person.label)) return person.label
  }
  return undefined
}

function targetOf(action: Action, assets: Asset[]): string {
  switch (action.type) {
    case "prepare":
      return "input"
    case "canon":
      return action.kind
    case "canon-all":
      return "viste"
    case "onmodel":
    case "onmodel-all":
      return "on-model"
    case "studio":
      return studioKey(action.look)
    case "ugc-frame":
    case "ugc-clip":
    case "ugc-reel":
    case "ugc-auto":
      return ugcKey(action.creator, action.format)
    case "refine": {
      const source = assets.find((a) => a.id === action.assetId)
      if (!source) throw new Error(`asset not found: ${action.assetId}`)
      if (source.kind === "sketch") return "input"
      if (source.kind === "ugc-frame") return ugcKey(creatorOf(source, assets) ?? "", (source.label ?? "").split(":")[0])
      if (source.kind === "lookbook") return studioKey(source.label ?? "")
      return source.kind
    }
    case "qa":
      return `qa:${action.assetId}`
    case "mesh":
      return "mesh"
    default:
      return action.type
  }
}

/** Starts the job for an action, or returns the one already filling the same slot. */
export async function startAction(garmentId: string, action: Action): Promise<JobView> {
  const { garment, assets } = await getGarment(garmentId)
  const target = targetOf(action, assets)
  const existing = runningFor(garment.id, target)
  if (existing) return existing
  const id = garment.id
  const viewLabel = (kind: AssetKind) => slotLabel(garment.shoot, kind)

  switch (action.type) {
    case "prepare":
      return startJob(id, { type: "prepare", target, label: "Preparing the inputs" }, async (ctx) => {
        if (!pick(assets, "sketch")) {
          if (pick(assets, "archive")) {
            ctx.phase("Drawing the product from the archive")
            await flatFromArchive(id, SEED_MODEL)
          } else {
            ctx.phase("Drawing the product from the note")
            await sketchFromNote(id, SEED_MODEL)
          }
        }
        ctx.phase("Reading the garment and extracting the DNA")
        await extractDna(id)
        ctx.phase("Writing the shoot plan")
        await writeShootPlan(id)
      })

    case "dna":
      return startJob(id, { type: "dna", target, label: "Extracting the DNA", phase: "Reading archive, flat and note" }, async (ctx) => {
        await extractDna(id)
        ctx.phase("Writing the shoot plan")
        await writeShootPlan(id)
      })

    case "brand-dna": {
      if (!BRAND_LORA_IDS.includes(action.brandId)) throw new Error("unknown brand LoRA")
      const brand = brandProfile(action.brandId)
      return startJob(
        id,
        { type: "brand-dna", target: "dna", label: `${brand.label} constraints`, phase: "Reading the brand's LoRA tags" },
        async (ctx) => {
          ctx.phase("Writing fabrics and textures with AI")
          await enrichDnaFromBrand(id, action.brandId, action.note)
          const { garment: g2 } = await getGarment(id)
          if (g2.shoot) {
            ctx.phase("Updating the shoot plan")
            await writeShootPlan(id)
          }
        },
      )
    }

    case "shoot":
      return startJob(id, { type: "shoot", target, label: "Shoot plan", phase: "Rewriting from the current DNA" }, () => writeShootPlan(id))

    case "canon":
      if (runningFor(id, "viste")) throw new Error("All the views are already being generated together")
      return startJob(
        id,
        { type: "canon", target, label: viewLabel(action.kind), models: action.models, phase: `Generating with ${action.models.length} models` },
        () => generateCanon(id, action.kind, action.models),
      )

    case "canon-all": {
      const busy = VIEW_SLOTS.find((s) => runningFor(id, s.kind))
      if (busy) throw new Error("A view is already being generated")
      const live = (kind: AssetKind) => assets.some((a) => a.kind === kind && a.status !== "rejected")
      const slots = live("ghost-front") ? VIEW_SLOTS.map((s) => s.kind).filter((kind) => kind !== "ghost-front" && !live(kind)) : ["ghost-front"]
      if (!slots.length) throw new Error("The views already exist")
      return startJob(
        id,
        { type: "canon-all", target, label: "All views", models: action.models, slots, phase: slots[0] === "ghost-front" ? "Generating the front" : "Generating the other views" },
        (ctx) => generateAllCanon(id, action.models, ctx),
      )
    }

    case "refine": {
      const source = assets.find((a) => a.id === action.assetId)!
      const flat = source.kind === "sketch"
      return startJob(
        id,
        {
          type: "refine",
          target,
          label: flat ? "Correction · Flat" : `Correction · ${viewLabel(source.kind)}`,
          models: action.models,
          phase: `“${action.instruction}”`,
        },
        async (ctx) => {
          const results = await refineAsset(action.assetId, action.instruction, action.models)
          if (flat && garment.dna && results.some((r) => r.asset)) {
            ctx.phase("Re-reading the DNA from the corrected flat")
            await extractDna(id)
            ctx.phase("Rewriting the shoot plan")
            await writeShootPlan(id)
          }
          return results
        },
      )
    }

    case "onmodel":
      return startJob(id, { type: "onmodel", target, label: "On-model", models: action.models, ...(action.model ? { slots: [action.model] } : {}) }, async (ctx) => {
        const person = await basePerson(id, ctx, action.model)
        ctx.phase("Putting the garment on the model")
        return generateOnModel(id, person.id, action.models)
      })

    case "onmodel-all":
      return startJob(
        id,
        { type: "onmodel-all", target, label: "On-model · all", models: action.models, slots: castFor(lineOf(garment)).map((m) => m.id), phase: "Preparing the models" },
        async (ctx) => {
          const people = await Promise.all(castFor(lineOf(garment)).map(async (m) => ({ model: m, person: await basePerson(id, { phase: () => {} }, m.id) })))
          const pending = new Set(people.map((p) => p.model.id))
          ctx.slots([...pending])
          ctx.phase(`Putting the garment on ${people.map((p) => p.model.label).join(", ")}`)
          const batches = await Promise.all(
            people.map(async ({ model, person }) => {
              try {
                return await generateOnModel(id, person.id, action.models)
              } catch (err) {
                const error = err instanceof Error ? err.message : String(err)
                return action.models.map((modelId) => ({ modelId, error }))
              } finally {
                pending.delete(model.id)
                ctx.slots([...pending])
              }
            }),
          )
          return batches.flat()
        },
      )

    case "studio": {
      const look = STUDIO_LOOKS.find((l) => l.id === action.look)
      return startJob(id, { type: "studio", target, label: `Studio · ${look?.label ?? action.look}`, models: action.models }, async (ctx) => {
        const person = await studioModel(id, action.look, ctx)
        ctx.phase(`Shooting in studio with ${action.models.length} models`)
        return generateStudio(id, person.id, action.look, action.models)
      })
    }

    case "ugc-frame": {
      const format = ugcFormat(action.format)
      const shots = shotNames(format, action.shots)
      return startJob(id, { type: "ugc-frame", target, label: `Frames · ${format.label} · ${shots}`, models: action.models }, async (ctx) => {
        ctx.phase("Preparing the creator")
        const person = await ensureCreator(action.creator, SEED_MODEL)
        ctx.phase(`Generating the frames (${shots}); the first shot is the reference for the others`)
        return generateUgcFrames(id, person.id, action.format, action.models, action.shots)
      })
    }

    case "ugc-clip": {
      const format = ugcFormat(action.format)
      return startJob(
        id,
        {
          type: "ugc-clip",
          target,
          label: `Clip · ${format.label} · ${shotNames(format, action.shots)}${voiceNote(format, action.voice)}`,
          models: action.models,
          phase: speaks(format) ? "Writing the reel script, then animating the frames (a few minutes)" : "Animating the frames (a few minutes)",
        },
        () => generateUgcClips(id, action.creator, action.format, action.models, { shots: action.shots, voice: action.voice }),
      )
    }

    case "ugc-reel": {
      const format = ugcFormat(action.format)
      return startJob(
        id,
        { type: "ugc-reel", target, label: `Reel · ${format.label}`, phase: speaks(format) ? "Editing the approved clips" : "Cutting the clips to the music" },
        () => assembleReel(id, action.creator, action.format, action.music),
      )
    }

    case "ugc-auto": {
      const format = ugcFormat(action.format)
      return startJob(
        id,
        { type: "ugc-auto", target, label: `Automatic reel · ${format.label}${voiceNote(format, action.voice)}` },
        async (ctx) => {
          ctx.phase("Preparing the creator")
          const person = await ensureCreator(action.creator, SEED_MODEL)
          return autoReel(id, person.id, action.format, { frame: DEFAULT_MODELS["ugc-frame"]!, clip: DEFAULT_MODELS["ugc-clip"]! }, action.voice, ctx.phase, action.music)
        },
      )
    }

    case "pdp":
      return startJob(id, { type: "pdp", target, label: "Product page", phase: "Writing from the DNA fields and the approved images" }, () => writePdp(id))

    case "focus":
      return startJob(id, { type: "focus", target, label: "Comparison", phase: "Finding the details to compare" }, () => computeFocus(id))

    case "qa": {
      const source = assets.find((a) => a.id === action.assetId)
      if (!source) throw new Error(`asset not found: ${action.assetId}`)
      if (!QA_KINDS.includes(source.kind)) throw new Error("Quality control runs on the front, the on-model shot, the studio shot or a frame")
      const qaLabel =
        source.kind === "on-model" ? "On-model" : source.kind === "lookbook" ? "Studio" : source.kind === "ugc-frame" ? "Frame" : "Front"
      return startJob(
        id,
        { type: "qa", target, label: `Quality control · ${qaLabel}`, phase: "Checking against the DNA and the measurements" },
        () => qaAsset(action.assetId),
      )
    }

    case "mesh":
      return startJob(
        id,
        { type: "mesh", target, label: "3D mesh", models: action.models, phase: `Generating with ${action.models.length} models` },
        () => generateMeshes(id, action.models),
      )

    case "campaign-analysis":
      return startJob(id, { type: "campaign-analysis", target, label: "Test analysis", phase: "Reading numbers, forecast and comments" }, () => analyzeCampaign(id))

    case "export":
      return startJob(id, { type: "export", target, label: "Export", phase: "Stamping the labels and writing the manifest" }, async () => {
        await exportPack(id)
        await updateDb((db) => {
          const g = db.garments.find((x) => x.id === id)
          if (g) g.exportedAt = new Date().toISOString()
        })
      })
  }
}

export async function assetGarment(assetId: string): Promise<string | undefined> {
  return (await readDb()).assets.find((a) => a.id === assetId)?.garmentId
}
