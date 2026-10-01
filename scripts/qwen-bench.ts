import { ensureCastView, generateCanon, generateOnModel } from "../lib/garment"
import { mediaPath } from "../lib/media"
import { CAST_MEN } from "../lib/prompts/cast"
import type { AssetKind } from "../lib/types"

const id = "g_mul19n4iilgd"
const model = "qwen-image-2.1"
const kinds = ["ghost-front", "ghost-back", "ghost-side", "detail-button", "detail-fabric"] as AssetKind[]

const [views, people] = await Promise.all([
  Promise.all(
    kinds.map(async (kind) => {
      const results = await generateCanon(id, kind, [model])
      const hit = results[0]
      console.log(kind, hit?.error ?? hit?.asset?.media.file)
      return { kind, file: hit?.asset ? mediaPath(hit.asset.media.file) : undefined, error: hit?.error }
    }),
  ),
  Promise.all(
    CAST_MEN.map(async (m) => {
      const person = await ensureCastView(m.id, "front", model)
      console.log("cast", m.label, person.media.file)
      return person
    }),
  ),
])

const worn = await Promise.all(
  people.map(async (person) => {
    const results = await generateOnModel(id, person.id, [model])
    const hit = results[0]
    console.log("on-model", person.label, hit?.error ?? hit?.asset?.media.file)
    return {
      label: person.label,
      cast: mediaPath(person.media.file),
      file: hit?.asset ? mediaPath(hit.asset.media.file) : undefined,
      error: hit?.error,
    }
  }),
)

console.log(JSON.stringify({ views, worn }, null, 2))
