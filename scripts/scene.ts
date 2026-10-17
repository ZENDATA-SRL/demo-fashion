import { arg, contactSheet, list, main, printRanking } from "../lib/cli"
import { generateScene, getGarment } from "../lib/garment"

const SETTING =
  "The garment lies casually folded on the seat of a mid-century oak lounge chair in a quiet Milan apartment, a linen throw and a ceramic cup on a low table beside it, warm plaster wall behind."

/** npm run scene -- [--garment id] [--models qwen-image-2.1] [--setting "..."] */
main(async () => {
  const { garment } = await getGarment(arg("garment"))
  const results = await generateScene(garment.id, list(arg("models", "qwen-image-2.1")), arg("setting", SETTING))
  console.log(`\n${garment.sku} · scene\n`)
  printRanking(results)
  const ok = results.filter((r) => r.asset)
  if (ok.length) console.log(`\nsheet → ${await contactSheet(ok.map((r) => r.asset!.media), `${garment.sku}-scene`)}`)
})
