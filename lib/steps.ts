import type { AssetKind, AssetView, JobType, ShootPlan, StepStatus, Workspace } from "./workspace-types"

/** The pipeline as the UI sees it: pure functions over a Workspace, shared by server (library) and client. */

export const STEPS = [
  { id: "input", phase: "creativo", label: "Design Brief", title: "Design Brief · Concept Sketch", lede: "The starting point and the constraints to respect." },
  { id: "concept", phase: "creativo", label: "Concept Visualization", title: "Concept Visualization", lede: "The sketch becomes a real product." },
  { id: "3d", phase: "tecnico", label: "Digital Prototype", title: "Image-to-3D · Digital Prototype", lede: "The measurements, checked on the model." },
  { id: "viste", phase: "contenuti", label: "Packshot", title: "Product Rendering · Packshot", lede: "Front, side and back of the approved product." },
  { id: "scena", phase: "contenuti", label: "Lifestyle", title: "Lifestyle Rendering · Scene Integration", lede: "The approved model in a real scene, with the choices of the sketch." },
  { id: "indossato", phase: "contenuti", label: "On-Model", title: "On-Model Rendering", lede: "The product worn by a model." },
  { id: "studio", phase: "contenuti", label: "Editorial", title: "Campaign Editorial", lede: "Editorial shots." },
  { id: "ugc", phase: "contenuti", label: "UGC", title: "UGC · Campaign Video", lede: "Videos with creators." },
  { id: "testi", phase: "delivery", label: "PDP", title: "Product Detail Page", lede: "The product page." },
  { id: "pubblica", phase: "delivery", label: "Sign-off", title: "Sign-off · Asset Delivery", lede: "Review, sign, export." },
  { id: "prova", phase: "delivery", label: "Virtual Try-On", title: "Virtual Try-On", lede: "The product on you, live." },
  { id: "campagna", phase: "mercato", label: "Market Test", title: "Market Test · Social campaign", lede: "The approved content in a paid campaign, before the physical sample." },
  { id: "validazione", phase: "mercato", label: "Go / No-Go", title: "Validation · Production decision", lede: "What the market said, how much to make and what to change." },
] as const

export const PHASES = [
  { id: "creativo", label: "Creative development" },
  { id: "tecnico", label: "Technical development" },
  { id: "contenuti", label: "Commercial content" },
  { id: "delivery", label: "Delivery" },
  { id: "mercato", label: "Market validation" },
] as const

export type StepId = (typeof STEPS)[number]["id"]

/** Shots a person can ask QA to score. Worn shots carry the measured-size check. */
export const QA_KINDS: AssetKind[] = ["ghost-front", "on-model", "lookbook", "ugc-frame"]

export const VIEW_SLOTS: Array<{ kind: AssetKind; label: string }> = [
  { kind: "ghost-front", label: "Front" },
  { kind: "ghost-side", label: "Side" },
  { kind: "ghost-back", label: "Back" },
  { kind: "detail-button", label: "Detail" },
  { kind: "detail-fabric", label: "Fabric" },
]

/** Cabas-style packshots: front, strict side and back (same refs as the concept trilogy). */
export const PACKSHOT_RENDER_SLOTS = VIEW_SLOTS.filter((s) =>
  (["ghost-front", "ghost-side", "ghost-back"] as const).includes(s.kind as "ghost-front" | "ghost-side" | "ghost-back"),
)

/** Coats and similar: back, side and macro details; the front stays on the concept step. */
export const DETAIL_RENDER_SLOTS = VIEW_SLOTS.filter((s) => s.kind !== "ghost-front")

export function renderSlots(shoot: ShootPlan | null | undefined) {
  if (!shoot?.details) return PACKSHOT_RENDER_SLOTS
  const hasDetails = !!(shoot.details["detail-button"] || shoot.details["detail-fabric"])
  return hasDetails ? DETAIL_RENDER_SLOTS : PACKSHOT_RENDER_SLOTS
}

/** @deprecated use renderSlots(shoot) */
export const RENDER_SLOTS = DETAIL_RENDER_SLOTS

/** The 3D model in play: approved if set, else operator refine, else the latest mesh. */
export const meshOf = (ws: Workspace) => currentOf(ws.assets, "mesh")

/** Width, height and depth in cm, read from the DNA measurements when they name them. */
export function quotesOf(ws: Workspace): { w: number; h: number; d: number; text: string } | undefined {
  const field = ws.garment.dna?.fields.find((f) => f.key === "measurements")
  if (!field) return undefined
  const num = (re: RegExp) => {
    const m = field.value.match(re)
    return m ? Number(m[1].replace(",", ".")) : undefined
  }
  const w = num(/(?:width|larghezza|larg\.?|\bL)\s*:?\s*(\d+(?:[.,]\d+)?)\s*cm/i)
  const h = num(/(?:height|altezza|alt\.?|\bA|\bH)\s*:?\s*(\d+(?:[.,]\d+)?)\s*cm/i)
  const d = num(/(?:depth|profondit[àa]|spessore|\bP|\bD)\s*:?\s*(\d+(?:[.,]\d+)?)\s*cm/i)
  return w && h && d ? { w, h, d, text: field.value } : undefined
}

/** Detail slots are named by the garment's shoot plan ("Bottone" for a coat, "Scollo" for a bodysuit). */
export function slotLabel(shoot: ShootPlan | null | undefined, kind: AssetKind): string {
  const detail = kind === "detail-button" || kind === "detail-fabric" ? shoot?.details[kind].label : undefined
  return detail ?? VIEW_SLOTS.find((s) => s.kind === kind)?.label ?? kind
}

export const DEFAULT_MODELS: Partial<Record<JobType, string[]>> = {
  canon: ["qwen-image-2.1-runpod"],
  refine: ["qwen-image-2.1-runpod"],
  onmodel: ["qwen-image-2.1-runpod"],
  studio: ["qwen-image-2.1-runpod"],
  "ugc-frame": ["qwen-image-2.1-runpod"],
  "ugc-clip": ["h3-max"],
  mesh: ["trellis-2"],
}

export const ugcKey = (creator: string, format: string) => `ugc:${creator}:${format}`
export const studioKey = (look: string) => `studio:${look}`

export const approvedOf = (ws: Workspace, kind: AssetKind, match: (a: AssetView) => boolean = () => true) => {
  const ok = ws.assets.filter((a) => a.kind === kind && a.status === "approved" && match(a))
  return ok.at(-1)
}

/** The approved asset of a kind, or the latest one still in play. */
export function currentOf(assets: AssetView[], kind: AssetKind): AssetView | undefined {
  const live = assets.filter((a) => a.kind === kind && a.status !== "rejected")
  return live.find((a) => a.status === "approved") ?? live.at(-1)
}

export const running = (ws: Workspace, target?: string) => ws.jobs.filter((j) => j.status === "running" && (target === undefined || j.target === target))

/** One reel of the plan: per shot its frames and clips with the approved ones, then the edited reels. */
export function ugcCell(ws: Workspace, creator: string, format: string) {
  const mine = (a: AssetView) => a.creator === creator && a.format === format
  const shots = (ws.formats.find((f) => f.id === format)?.shots ?? []).map((s) => {
    const own = (a: AssetView) => mine(a) && a.shot === s.id
    return {
      ...s,
      frames: ws.assets.filter((a) => a.kind === "ugc-frame" && own(a)),
      clips: ws.assets.filter((a) => a.kind === "ugc-clip" && own(a)),
      frame: approvedOf(ws, "ugc-frame", own),
      clip: approvedOf(ws, "ugc-clip", own),
    }
  })
  return {
    shots,
    framesDone: shots.filter((s) => s.frame).length,
    clipsDone: shots.filter((s) => s.clip).length,
    reels: ws.assets.filter((a) => a.kind === "ugc-video" && mine(a)),
    video: approvedOf(ws, "ugc-video", mine),
    jobs: running(ws, ugcKey(creator, format)),
  }
}

/** A template is done once one creator has an approved reel of it. */
export const ugcDone = (ws: Workspace, format: string) => ws.creators.some((c) => ugcCell(ws, c.id, format).video)

export function studioCell(ws: Workspace, look: string) {
  const mine = (a: AssetView) => a.label === look
  return {
    shots: ws.assets.filter((a) => a.kind === "lookbook" && mine(a)),
    shot: approvedOf(ws, "lookbook", mine),
    jobs: running(ws, studioKey(look)),
  }
}

export type StepState = { id: StepId; status: StepStatus; detail: string }

export function stepStates(ws: Workspace): StepState[] {
  const has = (kind: AssetKind) => ws.assets.some((a) => a.kind === kind)
  const busy = (...targets: string[]) => ws.jobs.some((j) => j.status === "running" && targets.some((t) => j.target === t || j.target.startsWith(t)))
  const front = !!approvedOf(ws, "ghost-front")
  const g = ws.garment

  const inputJob = ws.jobs.find((j) => j.status === "running" && j.target === "input")
  const critical = g.dna?.fields.filter((f) => f.critical).length ?? 0
  const input: StepState = inputJob || busy("dna")
    ? { id: "input", status: "running", detail: inputJob?.type === "refine" ? "Correcting the sketch" : inputJob ? "Creating the product" : "Reading the constraints" }
    : !has("sketch") && !g.dna
      ? { id: "input", status: "todo", detail: "Upload a sketch or have one made" }
      : !g.dna
        ? { id: "input", status: "todo", detail: "Constraints to read" }
        : g.dnaConfirmed
          ? { id: "input", status: "done", detail: `${critical} constraints confirmed` }
          : { id: "input", status: "todo", detail: "Confirm the constraints" }

  const conceptDrafts = ws.assets.filter((a) => a.kind === "ghost-front" && a.status === "draft").length
  const concept: StepState = !g.dnaConfirmed
    ? { id: "concept", status: "locked", detail: "After the sketch" }
    : busy("ghost-front")
      ? { id: "concept", status: "running", detail: "Qwen is drawing" }
      : front
        ? { id: "concept", status: "done", detail: "Concept approved" }
        : { id: "concept", status: "todo", detail: conceptDrafts ? `${conceptDrafts} to choose from` : "To generate" }

  const meshes = ws.assets.filter((a) => a.kind === "mesh" && a.status !== "rejected")
  const bozza: StepState = !front
    ? { id: "3d", status: "locked", detail: "After the concept" }
    : busy("mesh")
      ? { id: "3d", status: "running", detail: "Rebuilding the volume" }
      : meshOf(ws)
        ? { id: "3d", status: "done", detail: approvedOf(ws, "mesh") ? "Model approved" : "Model ready" }
        : { id: "3d", status: "todo", detail: meshes.length ? `${meshes.length} models to choose from` : "To generate" }

  const render = renderSlots(ws.garment.shoot)
  const viewsDone = render.filter((s) => approvedOf(ws, s.kind)).length
  const viste: StepState = !front
    ? { id: "viste", status: "locked", detail: "After the concept" }
    : busy("viste", ...render.map((s) => s.kind))
      ? { id: "viste", status: "running", detail: `${viewsDone}/${render.length} approved · running` }
      : {
          id: "viste",
          status: viewsDone === render.length ? "done" : "todo",
          detail: meshOf(ws) || viewsDone ? `${viewsDone}/${render.length} approved` : "Better after the 3D",
        }

  const scena: StepState = !meshOf(ws)
    ? { id: "scena", status: "locked", detail: "After the 3D model" }
    : approvedOf(ws, "scene")
      ? { id: "scena", status: "done", detail: "Scene approved" }
      : { id: "scena", status: "todo", detail: has("scene") ? "To choose" : "From the scene pipeline" }

  const indossato: StepState = !front
    ? { id: "indossato", status: "locked", detail: "Needs the approved concept" }
    : busy("on-model")
      ? { id: "indossato", status: "running", detail: "Running" }
      : approvedOf(ws, "on-model")
        ? { id: "indossato", status: "done", detail: "Approved" }
        : { id: "indossato", status: "todo", detail: "To generate" }

  const looks = ws.looks.filter((l) => studioCell(ws, l.id).shot).length
  const studio: StepState = !approvedOf(ws, "on-model")
    ? { id: "studio", status: "locked", detail: "Needs the approved on-model shot" }
    : busy("studio:")
      ? { id: "studio", status: "running", detail: `${looks}/${ws.looks.length} looks · running` }
      : { id: "studio", status: looks > 0 ? "done" : "todo", detail: looks ? `${looks}/${ws.looks.length} looks approved` : "To generate" }

  const videos = ws.formats.filter((f) => ugcDone(ws, f.id)).length
  const ugc: StepState = !front
    ? { id: "ugc", status: "locked", detail: "Needs the approved concept" }
    : busy("ugc:")
      ? { id: "ugc", status: "running", detail: `${videos}/${ws.formats.length} reels · running` }
      : { id: "ugc", status: videos === ws.formats.length ? "done" : "todo", detail: `${videos}/${ws.formats.length} reels approved` }

  const testi: StepState = !front
    ? { id: "testi", status: "locked", detail: "Needs the approved concept" }
    : busy("pdp")
      ? { id: "testi", status: "running", detail: "Writing" }
      : g.pdp
        ? { id: "testi", status: "done", detail: "Page written" }
        : { id: "testi", status: "todo", detail: "To write" }

  const pubblica: StepState = !g.pdp
    ? { id: "pubblica", status: "locked", detail: "After the product page" }
    : busy("export")
      ? { id: "pubblica", status: "running", detail: "Exporting" }
      : g.exportedAt && g.signoff
        ? { id: "pubblica", status: "done", detail: "Signed and exported" }
        : { id: "pubblica", status: "todo", detail: g.signoff ? "Signed · to export" : "To sign" }

  // a delivery step: with only the sketch it would be the one open step after the brief, and the pill would jump to it
  const prova: StepState = !front
    ? { id: "prova", status: "locked", detail: "Needs the approved concept" }
    : { id: "prova", status: "todo", detail: "Webcam · Lucy VTON" }

  const campaign = ws.market.campaign
  const ads = ws.market.creatives.length
  const campagna: StepState = !ads
    ? { id: "campagna", status: "locked", detail: "Needs approved content" }
    : campaign
      ? { id: "campagna", status: "done", detail: `${campaign.result.totals.preorders} pre-orders in ${campaign.result.plan.days} days` }
      : { id: "campagna", status: "todo", detail: `${ads} assets ready to launch` }

  const verdict = { go: "GO", iterate: "Iterate", stop: "Stop" } as const
  const validazione: StepState = !campaign
    ? { id: "validazione", status: "locked", detail: "After the market test" }
    : busy("campaign-analysis")
      ? { id: "validazione", status: "running", detail: "Reading the test" }
      : campaign.analysis
        ? { id: "validazione", status: "done", detail: `${verdict[campaign.forecast.decision]} · ${campaign.forecast.order.quantity} units` }
        : { id: "validazione", status: "todo", detail: `${verdict[campaign.forecast.decision]} statistical · to analyse` }

  return [input, concept, bozza, viste, scena, indossato, studio, ugc, testi, pubblica, prova, campagna, validazione]
}

export function scoreTone(score?: number): "ok" | "warn" | "bad" | undefined {
  if (score === undefined) return undefined
  return score >= 85 ? "ok" : score >= 65 ? "warn" : "bad"
}

export function creatorName(ws: Pick<Workspace, "creators">, id?: string, withCity = true) {
  const c = ws.creators.find((x) => x.id === id)
  if (!c) return id ?? ""
  return [c.name, `${c.age} y/o`, withCity ? c.city : ""].filter(Boolean).join(" · ")
}
