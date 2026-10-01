import { resolve } from "node:path"
import { arg, main } from "../lib/cli"
import { importHandoff } from "../lib/handoff"

main(async () => {
  const file = resolve(arg("file", "examples/ophidia/product.json"))
  const garment = await importHandoff(file)
  console.log(`${garment.sku} · ${garment.name} · ${garment.id}`)
  console.log("DNA misurato e viste bloccate. Da qui: indossato, studio, UGC, pagina.")
})
