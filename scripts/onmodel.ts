import { arg, contactSheet, list, main, printRanking } from "../lib/cli"
import { castAsset, ensureCastView, generateOnModel, getGarment } from "../lib/garment"
import { CAST } from "../lib/prompts/cast"

/** npm run onmodel -- [--person <assetId> | --cast model-10] [--models a,b] */
main(async () => {
  const { garment, assets } = await getGarment(arg("garment"))
  const castId = arg("cast", CAST[0].id)
  let personId = arg("person") ?? castAsset(assets, castId, "front")?.id
  if (!personId) {
    const person = await ensureCastView(castId, "front", arg("person-model", "qwen-image-2.1"))
    personId = person.id
    console.log(`modella creata ${person.id} (${person.label})`)
  }

  const results = await generateOnModel(garment.id, personId, list(arg("models", "qwen-image-2.1")))
  console.log(`\n${garment.sku} · on-model\n`)
  printRanking(results)

  const person = (await getGarment(garment.id)).assets.find((a) => a.id === personId)!
  const ok = results.filter((r) => r.asset)
  const sheet = await contactSheet([person.media, ...ok.map((r) => r.asset!.media)], `${garment.sku}-on-model`)
  console.log(`\nfoglio (ordine: modella · ${ok.map((r) => r.modelId).join(" · ")}) → ${sheet}`)
})
