import { arg, main } from "../lib/cli"
import { extractDna, getGarment, writeShootPlan } from "../lib/garment"

const SOURCE_LABEL = { sketch: "sketch", archive: "archivio", note: "nota", measured: "MISURATO", invented: "INVENTATO" } as const

main(async () => {
  const { garment } = await getGarment(arg("garment"))
  const dna = await extractDna(garment.id)
  console.log(`\n${garment.sku} · ${dna.summary}\n`)
  for (const f of dna.fields) {
    const flag = f.critical ? "●" : " "
    console.log(`${flag} ${f.label.padEnd(18)} ${SOURCE_LABEL[f.source].padEnd(10)} ${f.value}`)
  }
  const invented = dna.fields.filter((f) => f.source === "invented")
  console.log(`\n● = critical (checked on every asset) · ${invented.length} invented fields to sign off`)
  const plan = await writeShootPlan(garment.id)
  console.log(`\nShoot plan: ${plan.noun} · ${plan.description}`)
})
