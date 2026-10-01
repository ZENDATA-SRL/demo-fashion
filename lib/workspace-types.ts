import type { AssetKind, AssetStatus, Box, CastView, DnaField, Operator, Pdp, ShootPlan, Source } from "./types"

/** Serialisable shapes shared by the API and the client. No runtime imports here. */

export type JobType = "prepare" | "dna" | "brand-dna" | "shoot" | "canon" | "canon-all" | "refine" | "onmodel" | "onmodel-all" | "studio" | "ugc-frame" | "ugc-clip" | "ugc-reel" | "ugc-auto" | "pdp" | "focus" | "export" | "qa" | "mesh"

export type JobView = {
  id: string
  type: JobType
  /** the slot the job fills: a view kind, "on-model", "studio:<look>", "ugc:<creator>:<format>", "dna"… */
  target: string
  /** view kinds a multi-slot job is filling right now */
  slots?: string[]
  label: string
  phase?: string
  models: string[]
  errors: Array<{ modelId: string; error: string }>
  status: "running" | "done" | "error"
  error?: string
  startedAt: string
  /** when the images now in `slots` actually started, if later than `startedAt` */
  since?: string
  endedAt?: string
}

export type CheckView = { key: string; label: string; pass: boolean; note: string }

export type AssetView = {
  id: string
  kind: AssetKind
  label?: string
  src: string
  /** still for videos: the first frame they were animated from */
  poster?: string
  video: boolean
  /** GLB: the inspector orbits it; the grid shows `poster` */
  mesh: boolean
  status: AssetStatus
  approvedBy?: string
  modelId: string
  model: string
  weights: "open" | "closed"
  hosting: "managed" | "self-hosted"
  seconds: number
  usd?: number
  qa?: { score: number; checks: CheckView[]; artifacts: string[]; model: string }
  prompt?: string
  refs: Array<{ id: string; kind: AssetKind; label: string; src: string }>
  refIds: string[]
  /** creator id for UGC assets and creator portraits */
  creator?: string
  /** UGC format id */
  format?: string
  /** UGC shot id, for frames and clips; the reel has none */
  shot?: string
  focus?: Record<string, Box>
  operator?: Operator
  measure?: { cm: number; target: number; how: string }
  createdAt: string
}

export type ModelOption = {
  id: string
  label: string
  note: string
  provider: string
  weights: "open" | "closed"
  hosting: "managed" | "self-hosted"
  usd?: number
  group: "image" | "video" | "mesh"
}

/** A model of the shared cast; `views` holds the asset id of each angle that has been generated. */
export type CastMemberView = { id: string; label: string; note: string; views: Partial<Record<CastView, string>> }

export type CreatorView = { id: string; code: string; name: string; age: string; city: string }
/** `seconds` is what gets generated, `cut` what the reel keeps */
export type ShotView = { id: string; label: string; note: string; garment: "own" | "holds" | "wears"; voice: "on" | "over" | "none"; seconds: number; cut: number }
/** `seconds` is the length of the edited reel; `speaks` false for a reel cut to music; `caption` its on-screen text, empty until written */
export type FormatView = { id: string; label: string; note: string; hook: string; seconds: number; speaks: boolean; caption: string; shots: ShotView[] }
export type LookView = { id: string; label: string; note: string; back: boolean }
export type PresetView = { id: string; label: string; note: string }

/** Average seconds a finished generation of this kind took, across every garment. */
export type Pace = Record<string, { seconds: number; n: number }>

export type Workspace = {
  garment: {
    id: string
    sku: string
    name: string
    maison: string
    brief: string
    goal: string
    line: "donna" | "uomo"
    createdAt: string
    dna: { summary: string; fields: DnaField[]; model: string; at: string } | null
    shoot: ShootPlan | null
    dnaConfirmed: boolean
    pdp: Pdp | null
    signoff: { by: string; at: string; items: string[] } | null
    exportedAt: string | null
  }
  assets: AssetView[]
  jobs: JobView[]
  models: ModelOption[]
  /** the base bodies every worn shot starts from, shared by all garments */
  cast: CastMemberView[]
  creators: CreatorView[]
  formats: FormatView[]
  /** one reel per template with its default creator; any creator can shoot any template */
  plan: Array<{ creator: string; format: string }>
  /** how she speaks in the UGC reels; the first is the default */
  ugcVoices: PresetView[]
  /** extra beds a mute reel can use instead of the template's own track */
  ugcTracks: PresetView[]
  /** studio editorial looks; each is its own slot, the asset label is the look id */
  looks: LookView[]
  /** regions of the side-by-side zoom, from the shoot plan; `key` indexes AssetView.focus */
  zones: Array<{ key: string; label: string }>
  exportFiles: string[]
  cost: number
  /** how long each kind of image usually takes, from every generation stored so far */
  pace: Pace
}

export type GarmentCard = {
  id: string
  sku: string
  name: string
  maison: string
  line: "donna" | "uomo"
  thumb?: string
  createdAt: string
  steps: Array<{ id: string; status: StepStatus }>
  running: number
}

export type StepStatus = "locked" | "todo" | "running" | "done"

export type { AssetKind, AssetStatus, Box, CastView, DnaField, Pdp, ShootPlan, Source }
