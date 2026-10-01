import pixal3d from "./workflows/pixal3d.json"
import { comfyInput, comfyOutput, comfyRun } from "./comfy"
import type { Aspect, ImageRequest, MeshRequest, Output } from "./types"

/** Latent sizes of the qwen-loro pipeline: 1536 × 2048 for a still life, the long side at 2048 elsewhere. */
const LATENT: Record<Aspect, [number, number]> = {
  "3:4": [1536, 2048],
  "9:16": [1152, 2048],
  "1:1": [1536, 1536],
  "4:3": [2048, 1536],
}
const MAX_REFS = 10
const seed = () => Math.floor(Math.random() * 2 ** 31)

/** The fixed graph of qwen-loro (PIPELINE.md §1): references in order as <image1>…, 40 steps, CFG 1, Euler simple. */
export async function qwenOnPod(req: ImageRequest): Promise<Output> {
  const refs = await Promise.all(req.refs.slice(0, MAX_REFS).map(comfyInput))
  const [width, height] = LATENT[req.aspect]
  const encode: Record<string, unknown> = { clip: ["13", 0], vae: ["4", 0], prompt: req.prompt, negative_prompt: "", resolution: 1024 }
  refs.forEach((_, i) => (encode[`images.image_${i + 1}`] = ["37", i]))
  const graph = {
    "1": { class_type: "UNETLoader", inputs: { unet_name: "qwen_image_2.1_int8_convrot.safetensors", weight_dtype: "default" } },
    "13": { class_type: "CLIPLoader", inputs: { clip_name: "qwen3vl_8b_int8_convrot.safetensors", type: "qwen_image", device: "default" } },
    "4": { class_type: "VAELoader", inputs: { vae_name: "qwen_image_2.1_vae_bf16.safetensors" } },
    ...(refs.length
      ? {
          "37": {
            class_type: "QwenImageReferencePack",
            inputs: { references_json: JSON.stringify({ references: refs.map((file) => ({ kind: "image", file })) }), max_reference_edge: 1024 },
          },
        }
      : {}),
    "39": { class_type: "TextEncodeQwenImage21", inputs: encode },
    "10": { class_type: "EmptyLatentImage", inputs: { width, height, batch_size: 1 } },
    "48": { class_type: "QwenImage21Cache", inputs: { model: ["1", 0], device: "auto", dtype: "default" } },
    "2": {
      class_type: "KSampler",
      inputs: { model: ["48", 0], positive: ["39", 0], negative: ["39", 1], latent_image: ["10", 0], seed: seed(), steps: 40, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 1 },
    },
    "3": { class_type: "VAEDecode", inputs: { samples: ["2", 0], vae: ["4", 0] } },
    "15": { class_type: "SaveImage", inputs: { images: ["3", 0], filename_prefix: "demo_fashion/qwen" } },
  }
  return comfyOutput(await comfyRun(graph, 20 * 60_000), [".png", ".jpg", ".webp"])
}

type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>

/** The Comfy template `3d_pixal3d_trellis2_image_to_model`, as qwen-loro's image_to_3d.py runs it. */
export async function meshOnPod(req: MeshRequest, model: "pixal3d" | "trellis2"): Promise<Output> {
  const g = structuredClone(pixal3d) as Graph
  const s = seed()
  g["122"].inputs.image = await comfyInput(req.image)
  g["316"].inputs.value = model === "trellis2"
  g["40"].inputs.unet_name = "trellis_2_bf16.safetensors"
  g["319"].inputs.unet_name = "pixal3d_bf16.safetensors"
  ;["23", "18", "3", "12"].forEach((id, k) => (g[id].inputs.seed = s + k))
  g["94"].inputs.target_resolution = "1536"
  // the 700k faces of the template make a 60 MB file; the viewer and the size check need far less
  g["186"].inputs.target_face_count = 200_000
  g["322"].inputs.filename_prefix = `3d/demo_fashion/${model}`
  delete g["246"]
  delete g["323"]
  return comfyOutput(await comfyRun(g, 40 * 60_000), [".glb"])
}
