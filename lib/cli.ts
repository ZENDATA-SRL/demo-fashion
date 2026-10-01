import { execFile } from "node:child_process"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"
import { mediaPath } from "./media"
import { DATA_DIR } from "./store"
import type { Asset, Media, Qa } from "./types"

const run = promisify(execFile)

/** `--name value` or `--name=value`; the fallback is used when the flag is absent. */
export function arg(name: string, fallback: string): string
export function arg(name: string): string | undefined
export function arg(name: string, fallback?: string): string | undefined {
  const argv = process.argv.slice(2)
  const inline = argv.find((a) => a.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback
}

export function list(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean)
}

/** Side-by-side contact sheet (same height, left to right in the given order). */
export async function contactSheet(images: Media[], name: string, height = 1000): Promise<string> {
  const dir = join(DATA_DIR, "sheets")
  await mkdir(dir, { recursive: true })
  const out = join(dir, `${name}.jpg`)
  const args = ["-y", "-loglevel", "error"]
  images.forEach((m) => args.push("-i", mediaPath(m)))
  const scaled = images.map((_, i) => `[${i}:v]scale=-2:${height},pad=iw+24:ih:12:0:white[s${i}]`)
  const stack =
    images.length === 1 ? "[s0]copy[out]" : `${images.map((_, i) => `[s${i}]`).join("")}hstack=inputs=${images.length}[out]`
  args.push("-filter_complex", `${scaled.join(";")};${stack}`, "-map", "[out]", "-q:v", "3", "-frames:v", "1", out)
  await run("ffmpeg", args)
  return out
}

export function printRanking(rows: Array<{ modelId: string; asset?: Asset; qa?: Qa; error?: string }>): void {
  const ranked = [...rows].sort((a, b) => (b.qa?.score ?? -1) - (a.qa?.score ?? -1))
  for (const { modelId, asset, qa, error } of ranked) {
    if (!asset || !qa) {
      console.log(`✗ ${modelId.padEnd(24)} ${error ?? "nessun QA"}`)
      continue
    }
    const gen = asset.gen
    const weights = gen?.weights === "open" ? "open  " : "closed"
    console.log(`${String(qa.score).padStart(3)}  ${modelId.padEnd(24)} ${weights} ${((gen?.ms ?? 0) / 1000).toFixed(0)}s  ${mediaPath(asset.media)}`)
    for (const c of qa.checks.filter((c) => !c.pass)) console.log(`       ✗ ${c.key}: ${c.note}`)
    for (const a of qa.artifacts) console.log(`       ! ${a}`)
    if (gen?.notice) console.log(`       ⚠ ${gen.notice}`)
  }
}

export function main(fn: () => Promise<void>): void {
  fn().catch((err) => {
    console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
