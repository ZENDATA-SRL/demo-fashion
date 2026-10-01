import { arg, list, main, contactSheet, printRanking } from "../lib/cli"
import { assembleReel, ensureCreator, ensureMusic, generateUgcClips, generateUgcFrames, getGarment } from "../lib/garment"
import { mediaPath } from "../lib/media"
import { CREATORS, UGC_FORMATS, UGC_PLAN, UGC_TRACKS, ugcFormat } from "../lib/prompts/ugc"

/**
 * Every ad is an edited reel: a frame per shot, a clip per shot from the approved frame, then the cut.
 * npm run ugc -- creators [--creator-model …]   the portrait of every creator, in parallel, shared by all garments
 * npm run ugc -- music  [--format ootd|street-check|get-dressed|drive] [--new]   a template track, or the shared «drive» bed (all of them by default)
 * npm run ugc -- frames [--creator giulia|chiara-2|amina-2] [--format ootd|street-check|get-dressed] [--shots a,b] [--models a,b]
 * npm run ugc -- clips  [--creator …] [--format …] [--shots a,b] [--models h3-max] [--voice hype|bestie|review|dry|chill]
 * npm run ugc -- reel   [--creator …] [--format …]   cuts the approved clips, with the template's music and text
 *   --creator omitted: the plan's creator for the format; --shots omitted: all the shots of the format
 */
main(async () => {
  const step = process.argv[2]
  const creatorModel = arg("creator-model", "qwen-image-2.1")

  if (step === "creators") {
    const people = await Promise.all(CREATORS.map((c) => ensureCreator(c.id, creatorModel)))
    const sheet = await contactSheet(people.map((p) => p.media), "ugc-creators")
    console.log(`\ncreator (${CREATORS.map((c) => c.name).join(" · ")}) → ${sheet}`)
    return
  }

  if (step === "music") {
    const fresh = process.argv.includes("--new")
    const id = arg("format")
    const tracks = id
      ? [UGC_TRACKS.find((t) => t.id === id) ?? (ugcFormat(id).music ? { id, prompt: ugcFormat(id).music!.prompt } : undefined)].filter((t) => !!t)
      : [
          ...UGC_FORMATS.filter((f) => f.music).map((f) => ({ id: f.id, prompt: f.music!.prompt })),
          ...UGC_TRACKS.map((t) => ({ id: t.id, prompt: t.prompt })),
        ]
    for (const track of tracks) {
      const media = await ensureMusic(track, fresh)
      console.log(`${track.id} → ${mediaPath(media)}`)
    }
    return
  }

  const { garment } = await getGarment(arg("garment"))
  const format = ugcFormat(arg("format", UGC_PLAN[0].format))
  const creatorId = arg("creator", UGC_PLAN.find((p) => p.format === format.id)?.creator ?? UGC_PLAN[0].creator)
  const shots = arg("shots") ? list(arg("shots")!) : undefined

  if (step === "frames") {
    const person = await ensureCreator(creatorId, creatorModel)
    const results = await generateUgcFrames(garment.id, person.id, format.id, list(arg("models", "qwen-image-2.1")), shots)
    console.log(`\n${garment.sku} · ${creatorId} · ${format.id} · fotogrammi\n`)
    printRanking(results)
    const ok = results.filter((r) => r.asset)
    const sheet = await contactSheet([person.media, ...ok.map((r) => r.asset!.media)], `${garment.sku}-ugc-${format.id}`)
    console.log(`\nfoglio (ordine: creator · ${ok.map((r) => r.asset!.label).join(" · ")}) → ${sheet}`)
    return
  }

  if (step === "clips") {
    const results = await generateUgcClips(garment.id, creatorId, format.id, list(arg("models", "h3-max")), { shots, voice: arg("voice") })
    console.log(`\n${garment.sku} · ${creatorId} · ${format.id} · clip (QA sulla parte che resta nel montaggio)\n`)
    printRanking(results)
    return
  }

  if (step === "reel") {
    const reel = await assembleReel(garment.id, creatorId, format.id)
    console.log(`\nreel ${reel.id} → data/media/${reel.media.file}`)
    return
  }

  throw new Error("uso: npm run ugc -- frames | clips | reel")
})
