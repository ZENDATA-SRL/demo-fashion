import { IMAGE_MODELS, MESH_MODELS, VIDEO_MODELS } from "../lib/providers/registry"
import { TEXT_MODELS } from "../lib/providers/text"
import type { ModelInfo } from "../lib/providers/types"

const groups: Array<[string, ModelInfo[]]> = [
  ["Immagine", IMAGE_MODELS],
  ["Video", VIDEO_MODELS],
  ["3D", MESH_MODELS],
  ["Testo / vision", TEXT_MODELS],
]

for (const [title, models] of groups) {
  console.log(`\n${title}`)
  for (const m of models) {
    console.log(`  ${m.id.padEnd(24)} ${m.provider.padEnd(18)} ${m.hosting.padEnd(12)} ${m.weights.padEnd(7)} ${m.note}`)
  }
}
