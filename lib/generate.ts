import { saveBuffer, saveRemote } from "./media"
import { amdReady } from "./providers/text"
import { imageModel, meshModel, musicModel, textModel, videoModel } from "./providers/registry"
import type { ImageModel, ImageRequest, MeshRequest, ModelInfo, MusicRequest, Output, TextRequest, VideoRequest } from "./providers/types"
import type { Generation, Media } from "./types"

function saveOutput(out: Output, fallbackExt: string): Promise<Media> {
  return "url" in out ? saveRemote(out.url, fallbackExt) : saveBuffer(out.data, out.ext || fallbackExt)
}

function generation(model: ModelInfo, startedAt: number, usd?: number): Generation {
  return {
    modelId: model.id,
    provider: model.provider,
    hosting: model.hosting,
    weights: model.weights,
    ms: Date.now() - startedAt,
    ...(usd !== undefined ? { usd } : {}),
  }
}

export type Generated = { media: Media; gen: Generation }

function imageCost(model: ImageModel, refs: number): number | undefined {
  return model.usd === undefined ? undefined : model.usd + (model.usdPerRef ?? 0) * refs
}

export async function generateImage(modelId: string, req: ImageRequest): Promise<Generated> {
  const model = imageModel(modelId)
  const startedAt = Date.now()
  const media = await saveOutput(await model.run(req), ".jpg")
  return { media, gen: generation(model, startedAt, imageCost(model, req.refs.length)) }
}

export async function generateVideo(modelId: string, req: VideoRequest): Promise<Generated> {
  const model = videoModel(modelId)
  const durationSec = Math.min(model.maxSec, Math.max(model.minSec, Math.round(req.durationSec)))
  const startedAt = Date.now()
  const media = await saveOutput(await model.run({ ...req, durationSec }), ".mp4")
  return { media, gen: generation(model, startedAt, model.usd && model.usd * durationSec) }
}

export async function generateMesh(modelId: string, req: MeshRequest): Promise<Generated> {
  const model = meshModel(modelId)
  const startedAt = Date.now()
  const media = await saveOutput(await model.run(req), ".glb")
  return { media, gen: generation(model, startedAt, model.usd) }
}

export async function generateMusic(modelId: string, req: MusicRequest): Promise<Generated> {
  const model = musicModel(modelId)
  const startedAt = Date.now()
  const media = await saveOutput(await model.run(req), ".wav")
  return { media, gen: generation(model, startedAt, model.usd) }
}

export async function askJson<T>(req: TextRequest): Promise<{ data: T; model: string }> {
  return askJsonWith<T>(undefined, req)
}

/**
 * Same as askJson on a named text model; `undefined` is the one set in TEXT_MODEL.
 * With AMD_API_KEY set, AMD Token Factory answers first and the named model is the fallback.
 */
export async function askJsonWith<T>(modelId: string | undefined, req: TextRequest): Promise<{ data: T; model: string }> {
  const model = textModel(modelId)
  if (amdReady() && model.id !== "amd") {
    try {
      return { data: await textModel("amd").json<T>(req), model: "amd" }
    } catch (err) {
      console.warn(`AMD Token Factory failed, falling back to ${model.id}: ${(err as Error).message}`)
    }
  }
  return { data: await model.json<T>(req), model: model.id }
}
