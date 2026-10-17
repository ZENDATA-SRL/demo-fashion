import { meshOnPod, qwenOnPod } from "./runpod"
import { falAudio, falFile, falImage, falQueue, falUrl, falVideo } from "./fal"
import { TEXT_MODELS } from "./text"
import type { Aspect, ImageModel, MeshModel, MusicModel, TextModel, VideoModel } from "./types"

const SIZE_PRESET: Record<Aspect, string> = {
  "9:16": "portrait_16_9",
  "3:4": "portrait_4_3",
  "1:1": "square_hd",
  "4:3": "landscape_4_3",
}

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: "qwen-image-2.1-runpod",
    label: "Qwen Image 2.1 · RunPod",
    note: "Default. Il grafo di qwen-loro sul pod ComfyUI: riferimenti in ordine, 40 step, CFG 1",
    provider: "runpod",
    hosting: "self-hosted",
    weights: "open",
    run: qwenOnPod,
  },
  {
    id: "gpt-image-2.5-sunburst",
    label: "GPT Image 2.5 Sunburst",
    note: "Subject preservation e coerenza multi-turno, precisione",
    provider: "fal",
    hosting: "managed",
    weights: "closed",
    usd: 0.04,
    usdPerRef: 0.012,
    run: async (req) => {
      const urls = await Promise.all(req.refs.map(falUrl))
      const endpoint = urls.length ? "openai/gpt-image-2.5/sunburst/edit" : "openai/gpt-image-2.5/sunburst/text-to-image"
      return falImage(
        await falQueue(
          endpoint,
          {
            prompt: req.prompt,
            ...(urls.length ? { image_urls: urls } : {}),
            image_size: SIZE_PRESET[req.aspect],
            quality: "high",
            num_images: 1,
            output_format: "jpeg",
            moderation: "low",
          },
          300_000,
        ),
      )
    },
  },
  {
    id: "qwen-image-2.1",
    label: "Qwen Image 2.1 · fal",
    note: "Edit e text-to-image su fal, prompt non espanso",
    provider: "fal",
    hosting: "managed",
    weights: "open",
    usd: 0.035,
    run: async (req) => {
      const urls = await Promise.all(req.refs.map(falUrl))
      const size = SIZE_PRESET[req.aspect]
      const body = {
        prompt: req.prompt,
        image_size: size,
        num_images: 1,
        output_format: "jpeg" as const,
        prompt_expander: "none" as const,
        enable_safety_checker: false,
      }
      return falImage(
        await falQueue(urls.length ? "fal-ai/qwen-image-2.1/edit" : "fal-ai/qwen-image-2.1", urls.length ? { ...body, image_urls: urls } : body, 300_000),
      )
    },
  },
]

export const VIDEO_MODELS: VideoModel[] = [
  {
    id: "h3-max",
    label: "MiniMax H3 Max · 768p",
    note: "Parla italiano in modo nativo, buono sui panni in movimento. $0.04/s in promo fino al 30/9",
    provider: "fal",
    hosting: "managed",
    weights: "closed",
    usd: 0.08,
    minSec: 5,
    maxSec: 15,
    run: async ({ prompt, frame, durationSec, endFrame, refs }) => {
      const views = refs ?? []
      const shared = {
        prompt,
        image_url: await falUrl(frame),
        ...(endFrame ? { end_image_url: await falUrl(endFrame) } : {}),
        duration: durationSec,
        resolution: "768P",
        prompt_expansion_mode: "disabled" as const,
        enable_safety_checker: false,
      }
      // A spin shows sides the opening photo does not. Reference-to-video keeps those packshots
      // while the clip still opens on the approved frame.
      if (views.length) {
        return falVideo(
          await falQueue("minimax/h3-max/reference-to-video", {
            ...shared,
            aspect_ratio: "9:16",
            reference_image_urls: await Promise.all(views.map(falUrl)),
          }),
        )
      }
      return falVideo(await falQueue("minimax/h3-max/image-to-video", shared))
    },
  },
]

/** Image-to-3D: the pod first, then open-weight endpoints on fal. Closed APIs (Meshy, Tripo H3, Hunyuan 3.1 Pro) stay out. */
export const MESH_MODELS: MeshModel[] = [
  {
    id: "pixal3d-runpod",
    label: "Pixal3D · RunPod",
    note: "Default. Template ComfyUI Pixal3D sul pod: BiRefNet, MoGe, upsample 1536, PBR",
    provider: "runpod",
    hosting: "self-hosted",
    weights: "open",
    run: (req) => meshOnPod(req, "pixal3d"),
  },
  {
    id: "trellis-2-runpod",
    label: "TRELLIS.2 · RunPod",
    note: "Stesso template sul pod, ramo TRELLIS.2",
    provider: "runpod",
    hosting: "self-hosted",
    weights: "open",
    run: (req) => meshOnPod(req, "trellis2"),
  },
  {
    id: "trellis-2",
    label: "TRELLIS.2",
    note: "Default. Superfici aperte e texture PBR, MIT. Risoluzione 1024, mesh alleggerita per il viewer",
    provider: "fal",
    hosting: "managed",
    weights: "open",
    usd: 0.3,
    run: async ({ image }) =>
      falFile(
        await falQueue("fal-ai/trellis-2", {
          image_url: await falUrl(image),
          resolution: "1024",
          texture_size: "1024",
          decimation_target: 80_000,
          remesh: true,
        }),
        ["model_glb"],
      ),
  },
  {
    id: "trellis",
    label: "TRELLIS",
    note: "La versione precedente, più economica, mesh texturizzata. MIT",
    provider: "fal",
    hosting: "managed",
    weights: "open",
    usd: 0.02,
    run: async ({ image }) =>
      falFile(
        await falQueue("fal-ai/trellis", {
          image_url: await falUrl(image),
          texture_size: 1024,
        }),
        ["model_mesh", "model_glb"],
      ),
  },
  {
    id: "triposr",
    label: "TripoSR",
    note: "Bozza in pochi secondi, geometria rozza, senza PBR. MIT",
    provider: "fal",
    hosting: "managed",
    weights: "open",
    usd: 0.07,
    run: async ({ image }) =>
      falFile(
        await falQueue("fal-ai/triposr", {
          image_url: await falUrl(image),
          output_format: "glb",
          do_remove_background: true,
          foreground_ratio: 0.9,
          mc_resolution: 256,
        }),
        ["model_mesh", "model_glb"],
      ),
  },
  {
    id: "hunyuan3d-v21",
    label: "Hunyuan3D 2.1",
    note: "Texture PBR spesso migliori. Pesi aperti, licenza Tencent: uso commerciale in UE da verificare",
    provider: "fal",
    hosting: "managed",
    weights: "open",
    usd: 0.9,
    run: async ({ image }) =>
      falFile(
        await falQueue("fal-ai/hunyuan3d-v21", {
          input_image_url: await falUrl(image),
          num_inference_steps: 50,
          guidance_scale: 7.5,
          octree_resolution: 256,
          textured_mesh: true,
        }),
        ["model_glb_pbr", "model_glb"],
      ),
  },
  {
    id: "sam-3d",
    label: "SAM 3D",
    note: "Ricostruzione Meta da una foto, mesh con texture. Licenza SAM",
    provider: "fal",
    hosting: "managed",
    weights: "open",
    usd: 0.02,
    run: async ({ image, prompt }) =>
      falFile(
        await falQueue("fal-ai/sam-3/3d-objects", {
          image_url: await falUrl(image),
          prompt: prompt || "garment",
          export_textured_glb: true,
        }),
        ["model_glb"],
      ),
  },
]

export const MUSIC_MODELS: MusicModel[] = [
  {
    id: "lyria2",
    label: "Google Lyria 2",
    note: "Strumentale di 30 s a 48 kHz, basta per un reel",
    provider: "fal",
    hosting: "managed",
    weights: "closed",
    usd: 0.1,
    run: async ({ prompt, avoid }) => falAudio(await falQueue("fal-ai/lyria2", { prompt, negative_prompt: avoid })),
  },
]

function find<T extends { id: string }>(list: T[], id: string, kind: string): T {
  const model = list.find((m) => m.id === id)
  if (!model) throw new Error(`modello ${kind} sconosciuto: ${id} (disponibili: ${list.map((m) => m.id).join(", ")})`)
  return model
}

/** The pod is configured when COMFY_BASE names a real host, not the `<pod-id>` placeholder of .env.example. */
export const comfyReady = () => !!process.env.COMFY_BASE && !process.env.COMFY_BASE.includes("<")

/** Same open model on fal while the RunPod pod is not configured, so the defaults keep working. */
const RUNPOD_FALLBACK: Record<string, string> = { "qwen-image-2.1-runpod": "qwen-image-2.1" }

export const imageModel = (id: string) => find(IMAGE_MODELS, !comfyReady() && RUNPOD_FALLBACK[id] ? RUNPOD_FALLBACK[id] : id, "immagine")
export const videoModel = (id: string) => find(VIDEO_MODELS, id, "video")
export const musicModel = (id: string) => find(MUSIC_MODELS, id, "musica")
export const meshModel = (id: string) => find(MESH_MODELS, id, "3d")
export const textModel = (id = process.env.TEXT_MODEL ?? "gemini"): TextModel => find(TEXT_MODELS, id, "testo")
