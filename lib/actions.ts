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
  | { type: "brand-dna"; brandId: string }
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

const SEED_MODEL = "qwen-image-2.1-runpod"

/** " · voce entusiasta" for a talking reel, nothing for one cut to music. */
const voiceNote = (format: ReturnType<typeof ugcFormat>, voice?: string) => (speaks(format) ? ` · voce ${ugcVoice(voice).label.toLowerCase()}` : "")

function shotNames(format: ReturnType<typeof ugcFormat>, shots?: string[]): string {
  const picked = shots?.length ? format.shots.filter((s) => shots.includes(s.id)) : format.shots
  return picked.length === format.shots.length ? "tutti gli scatti" : picked.map((s) => s.label.toLowerCase()).join(", ")
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
  ctx.phase(`Preparo ${castModel(modelId).label}`)
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
      ctx.phase(`Preparo il retro di ${castModel(cast.modelId).label}`)
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
      if (!source) throw new Error(`asset non trovato: ${action.assetId}`)
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
      return startJob(id, { type: "prepare", target, label: "Preparo gli input" }, async (ctx) => {
        if (!pick(assets, "sketch")) {
          if (pick(assets, "archive")) {
            ctx.phase("Disegno il prodotto dall'archivio")
            await flatFromArchive(id, SEED_MODEL)
          } else {
            ctx.phase("Disegno il prodotto dalla nota")
            await sketchFromNote(id, SEED_MODEL)
          }
        }
        ctx.phase("Leggo il capo ed estraggo il DNA")
        await extractDna(id)
        ctx.phase("Scrivo il piano di scatti")
        await writeShootPlan(id)
      })

    case "dna":
      return startJob(id, { type: "dna", target, label: "Estraggo il DNA", phase: "Leggo archivio, flat e nota" }, async (ctx) => {
        await extractDna(id)
        ctx.phase("Scrivo il piano di scatti")
        await writeShootPlan(id)
      })

    case "brand-dna": {
      if (!BRAND_LORA_IDS.includes(action.brandId)) throw new Error("brand LoRA sconosciuto")
      const brand = brandProfile(action.brandId)
      return startJob(
        id,
        { type: "brand-dna", target: "dna", label: `Vincoli ${brand.label}`, phase: "Leggo i tag LoRA del brand" },
        async (ctx) => {
          ctx.phase("Scrivo tessuti e texture con l'AI")
          await enrichDnaFromBrand(id, action.brandId)
          const { garment: g2 } = await getGarment(id)
          if (g2.shoot) {
            ctx.phase("Aggiorno il piano di scatti")
            await writeShootPlan(id)
          }
        },
      )
    }

    case "shoot":
      return startJob(id, { type: "shoot", target, label: "Piano di scatti", phase: "Riscrivo dal DNA attuale" }, () => writeShootPlan(id))

    case "canon":
      if (runningFor(id, "viste")) throw new Error("Le viste si stanno già generando tutte insieme")
      return startJob(
        id,
        { type: "canon", target, label: viewLabel(action.kind), models: action.models, phase: `Genero con ${action.models.length} modelli` },
        () => generateCanon(id, action.kind, action.models),
      )

    case "canon-all": {
      const busy = VIEW_SLOTS.find((s) => runningFor(id, s.kind))
      if (busy) throw new Error("C'è già una vista in generazione")
      const live = (kind: AssetKind) => assets.some((a) => a.kind === kind && a.status !== "rejected")
      const slots = live("ghost-front") ? VIEW_SLOTS.map((s) => s.kind).filter((kind) => kind !== "ghost-front" && !live(kind)) : ["ghost-front"]
      if (!slots.length) throw new Error("Le viste ci sono già")
      return startJob(
        id,
        { type: "canon-all", target, label: "Tutte le viste", models: action.models, slots, phase: slots[0] === "ghost-front" ? "Genero il fronte" : "Genero le altre viste" },
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
          label: flat ? "Correzione · Flat" : `Correzione · ${viewLabel(source.kind)}`,
          models: action.models,
          phase: `“${action.instruction}”`,
        },
        async (ctx) => {
          const results = await refineAsset(action.assetId, action.instruction, action.models)
          if (flat && garment.dna && results.some((r) => r.asset)) {
            ctx.phase("Rileggo il DNA dal flat corretto")
            await extractDna(id)
            ctx.phase("Riscrivo il piano di scatti")
            await writeShootPlan(id)
          }
          return results
        },
      )
    }

    case "onmodel":
      return startJob(id, { type: "onmodel", target, label: "Indossato", models: action.models, ...(action.model ? { slots: [action.model] } : {}) }, async (ctx) => {
        const person = await basePerson(id, ctx, action.model)
        ctx.phase("Le faccio indossare il capo")
        return generateOnModel(id, person.id, action.models)
      })

    case "onmodel-all":
      return startJob(
        id,
        { type: "onmodel-all", target, label: "Indossato · tutte", models: action.models, slots: castFor(lineOf(garment)).map((m) => m.id), phase: lineOf(garment) === "uomo" ? "Preparo i modelli" : "Preparo le modelle" },
        async (ctx) => {
          const people = await Promise.all(castFor(lineOf(garment)).map(async (m) => ({ model: m, person: await basePerson(id, { phase: () => {} }, m.id) })))
          const pending = new Set(people.map((p) => p.model.id))
          ctx.slots([...pending])
          ctx.phase(`Faccio indossare il capo a ${people.map((p) => p.model.label).join(", ")}`)
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
        ctx.phase(`Scatto in studio con ${action.models.length} modelli`)
        return generateStudio(id, person.id, action.look, action.models)
      })
    }

    case "ugc-frame": {
      const format = ugcFormat(action.format)
      const shots = shotNames(format, action.shots)
      return startJob(id, { type: "ugc-frame", target, label: `Fotogrammi · ${format.label} · ${shots}`, models: action.models }, async (ctx) => {
        ctx.phase("Preparo la creator")
        const person = await ensureCreator(action.creator, SEED_MODEL)
        ctx.phase(`Genero i fotogrammi (${shots}); il primo scatto fa da riferimento agli altri`)
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
          phase: speaks(format) ? "Scrivo il copione del reel, poi animo i fotogrammi (qualche minuto)" : "Animo i fotogrammi (qualche minuto)",
        },
        () => generateUgcClips(id, action.creator, action.format, action.models, { shots: action.shots, voice: action.voice }),
      )
    }

    case "ugc-reel": {
      const format = ugcFormat(action.format)
      return startJob(
        id,
        { type: "ugc-reel", target, label: `Reel · ${format.label}`, phase: speaks(format) ? "Monto le clip approvate" : "Monto le clip a tempo di musica" },
        () => assembleReel(id, action.creator, action.format, action.music),
      )
    }

    case "ugc-auto": {
      const format = ugcFormat(action.format)
      return startJob(
        id,
        { type: "ugc-auto", target, label: `Reel automatico · ${format.label}${voiceNote(format, action.voice)}` },
        async (ctx) => {
          ctx.phase("Preparo la creator")
          const person = await ensureCreator(action.creator, SEED_MODEL)
          return autoReel(id, person.id, action.format, { frame: DEFAULT_MODELS["ugc-frame"]!, clip: DEFAULT_MODELS["ugc-clip"]! }, action.voice, ctx.phase, action.music)
        },
      )
    }

    case "pdp":
      return startJob(id, { type: "pdp", target, label: "Pagina prodotto", phase: "Scrivo dai campi del DNA e dalle immagini approvate" }, () => writePdp(id))

    case "focus":
      return startJob(id, { type: "focus", target, label: "Confronto", phase: "Trovo i dettagli da confrontare" }, () => computeFocus(id))

    case "qa": {
      const source = assets.find((a) => a.id === action.assetId)
      if (!source) throw new Error(`asset non trovato: ${action.assetId}`)
      if (!QA_KINDS.includes(source.kind)) throw new Error("Il controllo qualità si lancia sul fronte, sull'indossato, sullo studio o su un fotogramma")
      const qaLabel =
        source.kind === "on-model" ? "Indossato" : source.kind === "lookbook" ? "Studio" : source.kind === "ugc-frame" ? "Fotogramma" : "Fronte"
      return startJob(
        id,
        { type: "qa", target, label: `Controllo qualità · ${qaLabel}`, phase: "Confronto col DNA e con le misure" },
        () => qaAsset(action.assetId),
      )
    }

    case "mesh":
      return startJob(
        id,
        { type: "mesh", target, label: "Mesh 3D", models: action.models, phase: `Genero con ${action.models.length} modelli` },
        () => generateMeshes(id, action.models),
      )

    case "export":
      return startJob(id, { type: "export", target, label: "Esportazione", phase: "Imprimo le etichette e scrivo il manifest" }, async () => {
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
