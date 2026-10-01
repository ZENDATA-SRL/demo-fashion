import { arg, contactSheet, list, main } from "../lib/cli"
import { getGarment, pick } from "../lib/garment"
import type { AssetKind } from "../lib/types"

/** The approved chain side by side, input to output: the "same button, same seam" moment of the demo. */
main(async () => {
  const { garment, assets } = await getGarment(arg("garment"))
  const kinds = list(arg("kinds", "sketch,archive,ghost-front,ghost-back,ghost-side,detail-button,detail-fabric,on-model")) as AssetKind[]
  const chosen = kinds.map((kind) => ({ kind, asset: pick(assets, kind) })).filter((c) => c.asset)
  const sheet = await contactSheet(chosen.map((c) => c.asset!.media), `${garment.sku}-approved`, Number(arg("height", "700")))
  console.log(`${chosen.map((c) => `${c.kind}${c.asset!.status === "approved" ? " ✓" : ""}`).join(" · ")}\n→ ${sheet}`)
})
