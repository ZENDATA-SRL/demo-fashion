import { arg, contactSheet, main } from "../lib/cli"
import { createGarment, seedArchive, seedSketch } from "../lib/garment"
import { mediaPath } from "../lib/media"

/** The fictional demo SKU: an invented maison, so no real house is ever named or imitated. */
const DEMO = {
  sku: "AUR-FW26-OC01",
  name: "Cappotto Staffa",
  maison: "Aurenzi Milano",
  brief: "nuova interpretazione FW26 del cappotto d'archivio 1989, lana double, bottoni staffa, rosso lacca",
  goal: "pre-order sul sito + 6 UGC ads per testare 3 hook prima di produrre",
}

main(async () => {
  const archiveModel = arg("archive-model", "qwen-image-2.1")
  const sketchModel = arg("sketch-model", "qwen-image-2.1")

  const garment = await createGarment(DEMO)
  console.log(`capo ${garment.sku} · ${garment.id}`)

  const archive = await seedArchive(garment, archiveModel)
  console.log(`archivio 1989 → ${mediaPath(archive.media)}`)

  const sketch = await seedSketch(garment, archive, sketchModel)
  console.log(`disegno tecnico FW26 → ${mediaPath(sketch.media)}`)

  console.log(`foglio → ${await contactSheet([archive.media, sketch.media], `${garment.sku}-input`)}`)
})
