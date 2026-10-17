import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { extname, join } from "node:path"
import { promisify } from "node:util"
import { getGarment, pick } from "./garment"
import { mediaPath } from "./media"
import { looksForStudio } from "./prompts/studio"
import { allCreators } from "./prompts/ugc"
import { DATA_DIR } from "./store"
import type { Asset, AssetKind, Garment, Pdp } from "./types"

const run = promisify(execFile)

export const DISCLOSURE = "Advertisement · AI-generated content · virtual creator"
const LABEL_PNG = join(process.cwd(), "assets", "disclosure-en.png")

const SITE_ORDER: Array<[AssetKind, string]> = [
  ["ghost-front", "01_fronte"],
  ["ghost-back", "02_retro"],
  ["ghost-side", "03_tre-quarti"],
  ["detail-button", "04_dettaglio-bottone"],
  ["detail-fabric", "05_dettaglio-tessuto"],
  ["on-model", "06_indossato"],
]

const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex")

async function videoWidth(path: string): Promise<number> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width", "-of", "csv=p=0", path])
  return Number(stdout.trim())
}

/** Burns the disclosure label top-left for the whole clip: visible on the first frame and on every re-cut. */
async function burnDisclosure(src: string, out: string): Promise<void> {
  const width = await videoWidth(src)
  const labelW = Math.round(width * 0.62 / 2) * 2
  const margin = Math.round(width * 0.04)
  await run("ffmpeg", [
    "-y", "-loglevel", "error", "-i", src, "-i", LABEL_PNG,
    "-filter_complex", `[1:v]scale=${labelW}:-2[l];[0:v][l]overlay=x=${margin}:y=${margin}`,
    "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "copy",
    out,
  ], { maxBuffer: 64 * 1024 * 1024 })
}

function pdpMarkdown(pdp: Pdp): string {
  return `# ${pdp.title}

${pdp.subtitle}

${pdp.description}

${pdp.details.map((d) => `- ${d}`).join("\n")}

**Fit** ${pdp.fit}

**Composition** ${pdp.composition}

**Care**
${pdp.care.map((c) => `- ${c}`).join("\n")}

**Pre-order** ${pdp.preorder}

## FAQ
${pdp.faq.map((f) => `**${f.q}**\n${f.a}`).join("\n\n")}
`
}

function signOff(garment: Garment, exported: Array<{ file: string; asset: Asset }>): string {
  const invented = garment.dna?.fields.filter((f) => f.source === "invented") ?? []
  const claims = garment.pdp?.claims.filter((c) => c.needsSignOff) ?? []
  const ugc = exported.filter((e) => e.asset.kind === "ugc-video")
  return `# Sign-off before publishing · ${garment.sku}

Nothing in this folder goes online without the signatures below. Every file is tracked in \`manifest.json\` (model, provider, hash, references used).

## 1. Garment details invented by the system (not in the sketch, archive or note)
${invented.map((f) => `- [ ] **${f.label}**: ${f.value}`).join("\n") || "- none"}

## 2. Product page claims to verify
${claims.map((c) => `- [ ] [${c.source}] ${c.text}`).join("\n") || "- none"}

## 3. Policy texts (pre-order and FAQ)
Drafted by the system: every commitment on payment, returns, lead times and production changes must be validated with legal and customer care.
${garment.pdp ? [`- [ ] Pre-order: ${garment.pdp.preorder}`, ...garment.pdp.faq.map((f) => `- [ ] ${f.q} — ${f.a}`)].join("\n") : "- no text"}

## 4. Synthetic UGC content
Every clip carries the label "${DISCLOSURE}" burned in for its whole length. The creators are invented faces, not replicas of real people; no third-party brands in the prompts. The lines describe the product and do not simulate purchase experiences.
${ugc.map((e) => `- [ ] \`${e.file}\``).join("\n") || "- no approved clip"}

## 5. Publishing
- [ ] Caption with "#ad" / "Advertisement" visible without expanding the text
- [ ] Account bio or description declares the virtual creators
- [ ] Provenance metadata kept in the uploaded file, where the platform supports it

Signed: ______________________  Role: ______________  Date: __________
`
}

export async function exportPack(garmentId?: string): Promise<{ dir: string; files: string[]; missing: string[] }> {
  const { garment, assets } = await getGarment(garmentId)
  const dir = join(DATA_DIR, "export", garment.sku)
  await rm(dir, { recursive: true, force: true })
  for (const sub of ["inputs", "site", "ugc"]) await mkdir(join(dir, sub), { recursive: true })

  const byId = new Map(assets.map((a) => [a.id, a]))
  const exported: Array<{ file: string; asset: Asset; extra?: Record<string, unknown> }> = []
  const missing: string[] = []

  for (const kind of ["sketch", "archive"] as const) {
    const asset = pick(assets, kind)
    if (!asset) continue
    const file = `inputs/${garment.sku}_input_${kind}${extname(asset.media.file)}`
    await copyFile(mediaPath(asset.media), join(dir, file))
    exported.push({ file, asset })
  }

  for (const [kind, suffix] of SITE_ORDER) {
    const asset = assets.find((a) => a.kind === kind && a.status === "approved")
    if (!asset) {
      missing.push(kind)
      continue
    }
    const file = `site/${garment.sku}_${suffix}${extname(asset.media.file).replace(".jpeg", ".jpg")}`
    await copyFile(mediaPath(asset.media), join(dir, file))
    exported.push({ file, asset })
  }

  for (const [i, look] of looksForStudio(garment.shoot).entries()) {
    const asset = assets.find((a) => a.kind === "lookbook" && a.label === look.id && a.status === "approved")
    if (!asset) continue
    const file = `site/${garment.sku}_07-${i + 1}_studio_${look.id}${extname(asset.media.file).replace(".jpeg", ".jpg")}`
    await copyFile(mediaPath(asset.media), join(dir, file))
    exported.push({ file, asset, extra: { look: look.id } })
  }

  if (garment.pdp) {
    await writeFile(join(dir, "site", "pdp.json"), JSON.stringify(garment.pdp, null, 2))
    await writeFile(join(dir, "site", "pdp.md"), pdpMarkdown(garment.pdp))
  } else {
    missing.push("pdp")
  }

  // reels only: refs are the clips, then the creator; the one-take videos from before the reels are left out
  const creatorOfVideo = (video: Asset) => assets.find((a) => a.kind === "person" && video.refs.includes(a.id))?.label
  const isReel = (video: Asset) => byId.get(video.refs[0])?.kind === "ugc-clip"
  const videos = assets.filter((a) => a.kind === "ugc-video" && a.status === "approved" && isReel(a) && allCreators().some((c) => c.id === creatorOfVideo(a)))
  if (!videos.length) missing.push("ugc-video")
  for (const video of videos) {
    const creatorId = creatorOfVideo(video)!
    const formatId = video.label ?? ""
    const copy = garment.shoot?.ugc.copy[formatId]
    const models = [...new Set(video.refs.map((id) => byId.get(id)?.gen?.modelId).filter(Boolean))].join("-") || "reel"
    const file = `ugc/${garment.sku}_ugc_${formatId}_${creatorId}_${models}.mp4`
    await burnDisclosure(mediaPath(video.media), join(dir, file))
    exported.push({ file, asset: video, extra: { creator: creatorId, format: formatId, hook: copy?.hook, disclosure: DISCLOSURE } })
  }

  const fileOf = new Map(exported.map((e) => [e.asset.id, e.file]))
  const manifest = {
    garment: { sku: garment.sku, name: garment.name, maison: garment.maison, brief: garment.brief, goal: garment.goal },
    dna: garment.dna,
    exportedAt: new Date().toISOString(),
    disclosure: DISCLOSURE,
    assets: await Promise.all(
      exported.map(async ({ file, asset, extra }) => ({
        file,
        id: asset.id,
        kind: asset.kind,
        status: asset.status,
        approvedBy: asset.approvedBy ?? null,
        sha256: sha256(await readFile(join(dir, file))),
        sourceSha256: sha256(await readFile(mediaPath(asset.media))),
        generation: asset.gen ?? null,
        qa: asset.qa ? { score: asset.qa.score, model: asset.qa.model, failed: asset.qa.checks.filter((c) => !c.pass).map((c) => c.key) } : null,
        promptSha256: asset.prompt ? sha256(asset.prompt) : null,
        references: asset.refs.map((id) => ({ id, kind: byId.get(id)?.kind, label: byId.get(id)?.label, file: fileOf.get(id) ?? byId.get(id)?.media.file })),
        ...extra,
      })),
    ),
  }
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2))
  await writeFile(join(dir, "sign-off.md"), signOff(garment, exported))

  return { dir, files: [...exported.map((e) => e.file), "manifest.json", "sign-off.md"], missing }
}
