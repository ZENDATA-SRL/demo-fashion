import { arg, contactSheet, list, main, printRanking } from "../lib/cli"
import { castAsset, castOf, ensureCastView, generateStudio, getGarment } from "../lib/garment"
import { CAST } from "../lib/prompts/cast"
import { STUDIO_LOOKS, looksForStudio } from "../lib/prompts/studio"

/** npm run studio -- [--person <assetId> | --cast model-10] [--looks a,b] [--models a,b] */
main(async () => {
  const { garment, assets } = await getGarment(arg("garment"))
  const castId = arg("cast", CAST[0].id)
  const person =
    (arg("person") ? assets.find((a) => a.id === arg("person")) : undefined) ??
    assets.filter((a) => a.kind === "on-model" && a.status === "approved").at(-1) ??
    castAsset(assets, castId, "front")
  if (!person) throw new Error("no model: run `npm run cast` first")
  const models = list(arg("models", "qwen-image-2.1"))
  const looks = list(arg("looks", looksForStudio(garment.shoot).map((l) => l.id).join(",")))

  // a back look reads the model's own back view, so make sure the cast has it before shooting
  const cast = castOf(person, assets)
  if (cast && looks.some((l) => STUDIO_LOOKS.find((x) => x.id === l)?.view === "back")) {
    await ensureCastView(cast.modelId, "back", arg("person-model", "qwen-image-2.1"))
  }

  const personId = person.id
  const results = (await Promise.all(looks.map((look) => generateStudio(garment.id, personId, look, models)))).flat()
  console.log(`\n${garment.sku} · studio (${looks.join(", ")})\n`)
  printRanking(results)

  const ok = results.filter((r) => r.asset)
  const sheet = await contactSheet(ok.map((r) => r.asset!.media), `${garment.sku}-studio`)
  console.log(`\nsheet → ${sheet}`)
})
