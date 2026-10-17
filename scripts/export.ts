import { arg, main } from "../lib/cli"
import { exportPack } from "../lib/export"

main(async () => {
  const { dir, files, missing } = await exportPack(arg("garment"))
  console.log(`export → ${dir}`)
  for (const f of files) console.log(`  ${f}`)
  if (missing.length) console.log(`\nmissing (not approved or not generated): ${missing.join(", ")}`)
})
