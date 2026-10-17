import { arg, contactSheet, list, main, printRanking } from "../lib/cli"
import { buttonRef, generateCanon, getGarment } from "../lib/garment"
import type { AssetKind } from "../lib/types"

/** npm run canon -- --kind ghost-back,ghost-side --models a,b — views run in parallel inside one process (one db writer). */
main(async () => {
  const { garment } = await getGarment(arg("garment"))
  const kinds = list(arg("kind", "ghost-front")) as AssetKind[]
  const models = list(arg("models", "qwen-image-2.1"))

  await buttonRef(garment.id)
  const runs = await Promise.all(kinds.map(async (kind) => ({ kind, results: await generateCanon(garment.id, kind, models) })))

  for (const { kind, results } of runs) {
    console.log(`\n${garment.sku} · ${kind}\n`)
    printRanking(results)
    const ok = results.filter((r) => r.asset)
    if (ok.length) {
      const sheet = await contactSheet(ok.map((r) => r.asset!.media), `${garment.sku}-${kind}`)
      console.log(`sheet (order: ${ok.map((r) => r.modelId).join(" · ")}) → ${sheet}`)
    }
  }
})
