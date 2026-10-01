import { arg, contactSheet, list, main, printRanking } from "../lib/cli"
import { refineAsset } from "../lib/garment"
import { readDb } from "../lib/store"

/** npm run refine -- <assetId> --do "peak lapels instead of notched" [--models a,b] */
main(async () => {
  const assetId = process.argv[2]
  const instruction = arg("do")
  if (!assetId || assetId.startsWith("--") || !instruction) throw new Error('uso: npm run refine -- <assetId> --do "cosa cambiare" [--models a,b]')
  const models = list(arg("models", "qwen-image-2.1"))

  const results = await refineAsset(assetId, instruction, models)
  console.log(`\nrefine ${assetId} · "${instruction}"\n`)
  printRanking(results)

  const source = (await readDb()).assets.find((a) => a.id === assetId)
  const ok = results.filter((r) => r.asset)
  if (source && ok.length) {
    const sheet = await contactSheet([source.media, ...ok.map((r) => r.asset!.media)], `refine-${assetId}`)
    console.log(`\nfoglio (ordine: originale · ${ok.map((r) => r.modelId).join(" · ")}) → ${sheet}`)
  }
})
