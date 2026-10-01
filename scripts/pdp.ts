import { arg, main } from "../lib/cli"
import { getGarment, writePdp } from "../lib/garment"

main(async () => {
  const { garment } = await getGarment(arg("garment"))
  const pdp = await writePdp(garment.id)
  console.log(`\n${pdp.title}\n${pdp.subtitle}\n\n${pdp.description}\n`)
  for (const d of pdp.details) console.log(`· ${d}`)
  console.log(`\nVestibilità: ${pdp.fit}\nComposizione: ${pdp.composition}\nCura: ${pdp.care.join(" · ")}\n\n${pdp.preorder}\n`)
  for (const f of pdp.faq) console.log(`D: ${f.q}\nR: ${f.a}\n`)
  const toSign = pdp.claims.filter((c) => c.needsSignOff)
  console.log(`${pdp.claims.length} affermazioni tracciate, ${toSign.length} da firmare:`)
  for (const c of toSign) console.log(`  ✎ [${c.source}] ${c.text}`)
})
