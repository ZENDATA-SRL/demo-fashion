import { arg, main } from "../lib/cli"
import { computeFocus } from "../lib/focus"
import { getGarment } from "../lib/garment"

/** Regions for the synchronised zoom of the consistency check, recomputed for the current hero images. */
main(async () => {
  const { garment } = await getGarment(arg("garment"))
  const n = await computeFocus(garment.id, true)
  console.log(`${garment.sku}: regions saved on ${n} images`)
})
