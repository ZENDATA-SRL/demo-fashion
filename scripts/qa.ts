import { arg, main, printRanking } from "../lib/cli"
import { getGarment, qaAsset } from "../lib/garment"

/** Re-runs QA on existing assets of a kind (after a DNA edit or a QA prompt change), no new generations. */
main(async () => {
  const { garment, assets } = await getGarment(arg("garment"))
  const kind = arg("kind", "ghost-front")
  const targets = assets.filter((a) => a.kind === kind)
  if (!targets.length) throw new Error(`no "${kind}" asset`)
  const rows = await Promise.all(
    targets.map(async (asset) => ({ modelId: asset.gen?.modelId ?? "?", asset, qa: await qaAsset(asset.id) })),
  )
  console.log(`\n${garment.sku} · ${kind} · QA ${rows.find((r) => r.qa)?.qa?.model ?? "—"}\n`)
  printRanking(rows)
})
