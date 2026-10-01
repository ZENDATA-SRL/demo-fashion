/** A file inside data/media. Providers upload it wherever they need it (fal CDN, ComfyUI input dir, base64). */
export type Media = {
  file: string
  mime: string
}

/** [ymin, xmin, ymax, xmax] normalised to 0-1000, Gemini's native grounding format. */
export type Box = [number, number, number, number]

export type Hosting = "managed" | "self-hosted"
export type Weights = "open" | "closed"

/** Where a garment detail comes from: this is what the provenance overlay shows and what legal signs off. */
/** "measured" is a size that arrived from an upstream product spec, not a guess read off a photo. */
export type Source = "sketch" | "archive" | "note" | "invented" | "measured"

export type DnaField = {
  key: string
  label: string
  value: string
  source: Source
  /** critical fields are checked by QA on every asset */
  critical: boolean
}

export type GarmentDna = {
  /** one English line reused verbatim in every prompt */
  summary: string
  fields: DnaField[]
  model: string
  at: string
}

export type ShotDetail = {
  /** Italian UI label of the slot, e.g. "Bottone", "Scollo" */
  label: string
  /** what to locate on the approved front to crop the reference, English */
  region: string
  /** what the macro shows and how it is lit, English */
  shot: string
}

export type Zone = {
  /** Italian UI label, e.g. "Revers" */
  label: string
  /** what to locate on an image of the garment, English */
  target: string
}

export type UgcCopy = { hook: string; line: string }

/**
 * The garment-specific half of every prompt, written after the DNA; the fixed half (deliverable, light, background,
 * moderation-safe wording) stays in code. Image and video prompts with a person in frame use `description` and
 * `identity` instead of the raw DNA, which can carry words the content checkers block.
 */
export type ShootPlan = {
  /** English noun used in prompts: "coat", "bodysuit" */
  noun: string
  /** one English line, neutral catalogue wording */
  description: string
  /** the signature details every image and clip must keep, as a list starting with "its …" */
  identity: string
  /** the details to keep identical, e.g. "cut, colour, lapel shape, button count, button design and hardware" */
  lock: string
  views: { front: string; back: string; side: string }
  details: { "detail-button": ShotDetail; "detail-fabric": ShotDetail }
  /** close-up of the hardware cropped from the packshot and passed as reference; null when there is none worth it */
  hardware: { label: string; target: string } | null
  /** what the PDP model wears besides the garment */
  outfit: string
  /** how the PDP model wears it, completes "she wears the <noun> …" */
  wear: string
  /**
   * The size of the garment written as body landmarks on a 175 cm model ("the hem falls just above the knee"),
   * because image models follow relative anchors and ignore centimetres. Moderation-safe, so it rides along in the
   * worn prompts too, where the DNA and its measurements stay out.
   */
  scale: string
  ugc: {
    /** completes "she wears the <noun> …"; names every layer needed, since the creator's own clothes are not worn under it */
    wear: string
    /** true for outerwear worn over the creator's own clothes; false when the garment replaces them */
    over: boolean
    /** what a creator shows when she holds it up or turns */
    show: string
    /** the one detail her hand touches */
    touch: string
    /**
     * The physical garments that are not sewn together, top first, each a short noun phrase with no article.
     * One entry for a dress, jumpsuit, coat or skirt. A two-piece lists the top and the trousers: the hold shots
     * put one piece in each hand, and QA fails a frame that fuses them into one hanging garment.
     */
    pieces: string[]
    /** Italian hook and spoken line per UGC format id */
    copy: Record<string, UgcCopy>
  }
  /** 2-3 regions for QA zooms and the side-by-side consistency check */
  zones: Zone[]
  /** 1-2 regions of the back view for QA zooms */
  backZones: string[]
  /** when set, only these studio look ids appear in the Studio step */
  studioLooks?: string[]
  model: string
  at: string
}

export type Garment = {
  id: string
  sku: string
  name: string
  maison: string
  /** who wears it; omitted garments stay on the women's line */
  line?: "donna" | "uomo"
  /** designer note, usually Italian */
  brief: string
  /** business goal, e.g. "pre-order + 6 UGC ads to test 3 hooks" */
  goal: string
  dna?: GarmentDna
  shoot?: ShootPlan
  /** a person reviewed the DNA: generation of the views can start */
  dnaConfirmedAt?: string
  pdp?: Pdp
  signoff?: { by: string; at: string; items: string[] }
  exportedAt?: string
  createdAt: string
}

export type Pdp = {
  title: string
  subtitle: string
  description: string
  details: string[]
  fit: string
  composition: string
  care: string[]
  preorder: string
  faq: Array<{ q: string; a: string }>
  /** every customer-facing fact, traced to its DNA source: the legal sign-off list */
  claims: Array<{ text: string; source: Source; needsSignOff: boolean }>
  model: string
  at: string
}

export type AssetKind =
  | "archive"
  | "sketch"
  | "ghost-front"
  | "ghost-back"
  | "ghost-side"
  | "detail-button"
  | "detail-fabric"
  | "on-model"
  | "lookbook"
  | "ugc-frame"
  /** one shot of a UGC reel, animated from its approved frame */
  | "ugc-clip"
  /** the edited UGC reel: the approved clips of every shot, cut together */
  | "ugc-video"
  /** deterministic crop of another asset, used as a zoomed reference */
  | "crop"
  /** fictional model or creator in a neutral outfit, the body the garment is put on */
  | "person"
  /** GLB from an open image-to-3D model */
  | "mesh"
  /** front studio render of the approved 3D at its real measurements: the shape reference for every worn shot */
  | "mesh-front"
  /** the approved 3D product photographed in a real setting, made outside the app by the qwen-loro scene pipeline */
  | "scene"

/** The three angles every model of the shared cast is photographed in. */
export type CastView = "front" | "back" | "side"

export type Generation = {
  modelId: string
  provider: string
  hosting: Hosting
  weights: Weights
  ms: number
  usd?: number
  /** set when a content checker blocked the requested model and a fallback ran */
  notice?: string
}

export type QaCheck = { key: string; pass: boolean; note: string }

export type Qa = {
  /** 0-100 */
  score: number
  checks: QaCheck[]
  artifacts: string[]
  model: string
  at: string
}

export type AssetStatus = "draft" | "approved" | "rejected"

export type Asset = {
  id: string
  garmentId: string
  kind: AssetKind
  /** what a crop shows, e.g. "button" */
  label?: string
  media: Media
  status: AssetStatus
  prompt?: string
  /** asset ids passed as references, in order */
  refs: string[]
  /** named regions (bottone, revers, polsino…) for the synchronised zoom of the UI */
  focus?: Record<string, Box>
  gen?: Generation
  qa?: Qa
  /** UGC clips: seconds where her voice starts and ends, so the edit never cuts a sentence */
  speech?: { start: number; end: number }
  approvedBy?: string
  /** a mesh the operator refined: the time it took and what changed; `simulated` when the pass was prepared before the demo */
  operator?: Operator
  /** a scene: the product length read on the table plane, against the length it should have */
  measure?: { cm: number; target: number; how: string }
  createdAt: string
}

export type Operator = {
  minutes: number
  changes: string[]
  simulated: boolean
  tool: string
  /** body without handles, in cm, measured by the operator on the finished model */
  body?: { w: number; h: number; d: number }
}

export type Db = {
  garments: Garment[]
  assets: Asset[]
}
