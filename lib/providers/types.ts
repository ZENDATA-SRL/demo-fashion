import type { Hosting, Media, Weights } from "../types"

export type Aspect = "9:16" | "3:4" | "1:1" | "4:3"

/** Adapters return either a URL to download or the bytes themselves (self-hosted servers). */
export type Output = { url: string } | { data: Buffer; ext: string }

export type ModelInfo = {
  id: string
  label: string
  note: string
  provider: "fal" | "runpod" | "gemini" | "openai-compatible" | "bedrock" | "amd"
  hosting: Hosting
  /** open weights can move to self-hosting without changing the pipeline */
  weights: Weights
  /** per image, or per second for video; token-priced models carry an estimate from the provider's size table */
  usd?: number
}

export type ImageRequest = { prompt: string; refs: Media[]; aspect: Aspect }
export type ImageModel = ModelInfo & {
  /** extra cost of each reference image (input tokens) */
  usdPerRef?: number
  run: (req: ImageRequest) => Promise<Output>
}

export type VideoRequest = {
  prompt: string
  frame: Media
  durationSec: number
  /** last frame; the same as `frame` pins a loop that ends where it started */
  endFrame?: Media
  /**
   * Product views besides the opening frame (front, side, back). H3 reference-to-video
   * keeps them as Image 1, Image 2… while the clip still opens on `frame`.
   */
  refs?: Media[]
}
export type VideoModel = ModelInfo & {
  minSec: number
  maxSec: number
  run: (req: VideoRequest) => Promise<Output>
}

export type MusicRequest = { prompt: string; avoid: string }
export type MusicModel = ModelInfo & { run: (req: MusicRequest) => Promise<Output> }

/** `prompt` names the object for models that segment before reconstructing. */
export type MeshRequest = { image: Media; prompt?: string }
export type MeshModel = ModelInfo & { run: (req: MeshRequest) => Promise<Output> }

export type TextRequest = {
  system: string
  prompt: string
  images?: Media[]
  temperature?: number
  /** AMD Token Factory model for this call, in place of AMD_MODEL */
  amdModel?: string
}
export type TextModel = ModelInfo & { json: <T>(req: TextRequest) => Promise<T> }
