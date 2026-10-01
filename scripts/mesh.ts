import { arg, list, main, printRanking } from "../lib/cli"
import { generateMeshes, getGarment, setStatus } from "../lib/garment"

/** npm run mesh -- [--garment id] [--models trellis-2,hunyuan3d-v21] [--approve] */
main(async () => {
  const { garment } = await getGarment(arg("garment"))
  const modelIds = list(arg("models", "trellis-2"))
  const results = await generateMeshes(garment.id, modelIds)
  console.log(`\n${garment.sku} · mesh (${modelIds.join(", ")})\n`)
  printRanking(results)

  if (process.argv.includes("--approve")) {
    const best = results.find((r) => r.asset)?.asset
    if (best) {
      await setStatus(best.id, "approved", "pipeline")
      console.log(`\napprovato → ${best.id}`)
    }
  }
})
