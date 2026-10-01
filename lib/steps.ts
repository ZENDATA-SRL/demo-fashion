import type { AssetKind, AssetView, JobType, ShootPlan, StepStatus, Workspace } from "./workspace-types"

/** The pipeline as the UI sees it: pure functions over a Workspace, shared by server (library) and client. */

export const STEPS = [
  { id: "input", phase: "prodotto", label: "Bozzetto", title: "Il bozzetto", lede: "Il punto di partenza e i vincoli da rispettare." },
  { id: "concept", phase: "prodotto", label: "Concept", title: "Concept realistico", lede: "Il bozzetto diventa un prodotto reale." },
  { id: "3d", phase: "prodotto", label: "3D", title: "Modello 3D", lede: "Le misure, verificate sul modello." },
  { id: "viste", phase: "contenuti", label: "View", title: "View prodotto", lede: "Fronte, lato e retro del prodotto approvato." },
  { id: "scena", phase: "contenuti", label: "Ambientazione", title: "Ambientazione", lede: "Il modello approvato in una scena vera, con le scelte del bozzetto." },
  { id: "indossato", phase: "contenuti", label: "Indossato", title: "Indossato", lede: "Il prodotto addosso a una modella." },
  { id: "studio", phase: "contenuti", label: "Studio", title: "Editoriale in studio", lede: "Scatti editoriali." },
  { id: "ugc", phase: "contenuti", label: "UGC", title: "Video UGC", lede: "Video con creator." },
  { id: "testi", phase: "lancio", label: "Scheda", title: "Scheda prodotto", lede: "La pagina prodotto." },
  { id: "pubblica", phase: "lancio", label: "Firma", title: "Firma ed esporta", lede: "Controlla, firma, esporta." },
  { id: "prova", phase: "lancio", label: "Prova", title: "Prova dal vivo", lede: "Il prodotto addosso a te, dal vivo." },
] as const

export const PHASES = [
  { id: "prodotto", label: "Sviluppo prodotto" },
  { id: "contenuti", label: "Contenuti" },
  { id: "lancio", label: "Lancio" },
] as const

export type StepId = (typeof STEPS)[number]["id"]

/** Shots a person can ask QA to score. Worn shots carry the measured-size check. */
export const QA_KINDS: AssetKind[] = ["ghost-front", "on-model", "lookbook", "ugc-frame"]

export const VIEW_SLOTS: Array<{ kind: AssetKind; label: string }> = [
  { kind: "ghost-front", label: "Fronte" },
  { kind: "ghost-side", label: "Lato" },
  { kind: "ghost-back", label: "Retro" },
  { kind: "detail-button", label: "Dettaglio" },
  { kind: "detail-fabric", label: "Tessuto" },
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
    ? { id: "input", status: "running", detail: inputJob?.type === "refine" ? "Correggo il bozzetto" : inputJob ? "Creo il prodotto" : "Leggo i vincoli" }
    : !has("sketch") && !g.dna
      ? { id: "input", status: "todo", detail: "Carica un bozzetto o fallo creare" }
      : !g.dna
        ? { id: "input", status: "todo", detail: "Vincoli da leggere" }
        : g.dnaConfirmed
          ? { id: "input", status: "done", detail: `${critical} vincoli confermati` }
          : { id: "input", status: "todo", detail: "Conferma i vincoli" }

  const conceptDrafts = ws.assets.filter((a) => a.kind === "ghost-front" && a.status === "draft").length
  const concept: StepState = !g.dnaConfirmed
    ? { id: "concept", status: "locked", detail: "Dopo il bozzetto" }
    : busy("ghost-front")
      ? { id: "concept", status: "running", detail: "Qwen sta disegnando" }
      : front
        ? { id: "concept", status: "done", detail: "Concept approvato" }
        : { id: "concept", status: "todo", detail: conceptDrafts ? `${conceptDrafts} da scegliere` : "Da generare" }

  const meshes = ws.assets.filter((a) => a.kind === "mesh" && a.status !== "rejected")
  const bozza: StepState = !front
    ? { id: "3d", status: "locked", detail: "Dopo il concept" }
    : busy("mesh")
      ? { id: "3d", status: "running", detail: "Ricostruisco il volume" }
      : meshOf(ws)
        ? { id: "3d", status: "done", detail: approvedOf(ws, "mesh") ? "Modello approvato" : "Modello pronto" }
        : { id: "3d", status: "todo", detail: meshes.length ? `${meshes.length} modelli da scegliere` : "Da generare" }

  const render = renderSlots(ws.garment.shoot)
  const viewsDone = render.filter((s) => approvedOf(ws, s.kind)).length
  const viste: StepState = !front
    ? { id: "viste", status: "locked", detail: "Dopo il concept" }
    : busy("viste", ...render.map((s) => s.kind))
      ? { id: "viste", status: "running", detail: `${viewsDone}/${render.length} approvati · in corso` }
      : {
          id: "viste",
          status: viewsDone === render.length ? "done" : "todo",
          detail: meshOf(ws) || viewsDone ? `${viewsDone}/${render.length} approvati` : "Meglio dopo il 3D",
        }

  const scena: StepState = !meshOf(ws)
    ? { id: "scena", status: "locked", detail: "Dopo il modello 3D" }
    : approvedOf(ws, "scene")
      ? { id: "scena", status: "done", detail: "Scena approvata" }
      : { id: "scena", status: "todo", detail: has("scene") ? "Da scegliere" : "Dalla pipeline scena" }

  const indossato: StepState = !front
    ? { id: "indossato", status: "locked", detail: "Serve il concept approvato" }
    : busy("on-model")
      ? { id: "indossato", status: "running", detail: "In corso" }
      : approvedOf(ws, "on-model")
        ? { id: "indossato", status: "done", detail: "Approvato" }
        : { id: "indossato", status: "todo", detail: "Da generare" }

  const looks = ws.looks.filter((l) => studioCell(ws, l.id).shot).length
  const studio: StepState = !approvedOf(ws, "on-model")
    ? { id: "studio", status: "locked", detail: "Serve l'indossato approvato" }
    : busy("studio:")
      ? { id: "studio", status: "running", detail: `${looks}/${ws.looks.length} look · in corso` }
      : { id: "studio", status: looks > 0 ? "done" : "todo", detail: looks ? `${looks}/${ws.looks.length} look approvati` : "Da generare" }

  const videos = ws.formats.filter((f) => ugcDone(ws, f.id)).length
  const ugc: StepState = !front
    ? { id: "ugc", status: "locked", detail: "Serve il concept approvato" }
    : busy("ugc:")
      ? { id: "ugc", status: "running", detail: `${videos}/${ws.formats.length} reel · in corso` }
      : { id: "ugc", status: videos === ws.formats.length ? "done" : "todo", detail: `${videos}/${ws.formats.length} reel approvati` }

  const testi: StepState = !front
    ? { id: "testi", status: "locked", detail: "Serve il concept approvato" }
    : busy("pdp")
      ? { id: "testi", status: "running", detail: "Scrivo" }
      : g.pdp
        ? { id: "testi", status: "done", detail: "Scheda scritta" }
        : { id: "testi", status: "todo", detail: "Da scrivere" }

  const pubblica: StepState = !g.pdp
    ? { id: "pubblica", status: "locked", detail: "Dopo la scheda" }
    : busy("export")
      ? { id: "pubblica", status: "running", detail: "Esporto" }
      : g.exportedAt && g.signoff
        ? { id: "pubblica", status: "done", detail: "Firmato ed esportato" }
        : { id: "pubblica", status: "todo", detail: g.signoff ? "Firmato · da esportare" : "Da firmare" }

  const hasLook = !!approvedOf(ws, "ghost-front") || has("sketch") || has("archive")
  const prova: StepState = !hasLook
    ? { id: "prova", status: "locked", detail: "Serve un'immagine del capo" }
    : { id: "prova", status: "todo", detail: "Webcam · Lucy VTON" }

  return [input, concept, bozza, viste, scena, indossato, studio, ugc, testi, pubblica, prova]
}

export function scoreTone(score?: number): "ok" | "warn" | "bad" | undefined {
  if (score === undefined) return undefined
  return score >= 85 ? "ok" : score >= 65 ? "warn" : "bad"
}

export function creatorName(ws: Pick<Workspace, "creators">, id?: string, withCity = true) {
  const c = ws.creators.find((x) => x.id === id)
  if (!c) return id ?? ""
  return [c.name, `${c.age} anni`, withCity ? c.city : ""].filter(Boolean).join(" · ")
}
