import { arg, contactSheet, list, main } from "../lib/cli"
import { ensureCast } from "../lib/garment"
import { CAST, CAST_VIEWS, castParts } from "../lib/prompts/cast"

/** npm run cast -- [--models model-10,model-11] [--image-model qwen-image-2.1] */
main(async () => {
  const ids = list(arg("models", CAST.map((m) => m.id).join(",")))
  const assets = await ensureCast(arg("image-model", "qwen-image-2.1"), ids)
  console.log(`\ncast · ${ids.length} modelle × ${CAST_VIEWS.length} viste\n`)
  for (const asset of assets) {
    const parts = castParts(asset.label)
    console.log(`  ${(parts ? `${parts.modelId} ${parts.view}` : (asset.label ?? "")).padEnd(22)} ${asset.id} ${asset.status}`)
  }
  const sheet = await contactSheet(assets.map((a) => a.media), "cast")
  console.log(`\nfoglio (ordine: ${assets.map((a) => a.label).join(" · ")}) → ${sheet}`)
})
