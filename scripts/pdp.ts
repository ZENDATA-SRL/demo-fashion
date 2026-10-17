import { arg, main } from "../lib/cli"
import { getGarment, writePdp } from "../lib/garment"

main(async () => {
  const { garment } = await getGarment(arg("garment"))
  const pdp = await writePdp(garment.id)
  console.log(`\n${pdp.title}\n${pdp.subtitle}\n\n${pdp.description}\n`)
  for (const d of pdp.details) console.log(`· ${d}`)
  console.log(`\nFit: ${pdp.fit}\nComposition: ${pdp.composition}\nCare: ${pdp.care.join(" · ")}\n\n${pdp.preorder}\n`)
  for (const f of pdp.faq) console.log(`Q: ${f.q}\nA: ${f.a}\n`)
  const toSign = pdp.claims.filter((c) => c.needsSignOff)
  console.log(`${pdp.claims.length} claims tracked, ${toSign.length} to sign off:`)
  for (const c of toSign) console.log(`  ✎ [${c.source}] ${c.text}`)
})
