import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"
import { mediaPath } from "@/lib/media"
import { DATA_DIR } from "@/lib/store"

const run = promisify(execFile)
const CACHE = join(DATA_DIR, "cache", "frames")

type Ctx = { params: Promise<{ file: string }> }

/** A still from a video at ?t=seconds, extracted once with ffmpeg and cached. */
export async function GET(req: Request, { params }: Ctx) {
  const { file } = await params
  const t = Math.max(0, Number(new URL(req.url).searchParams.get("t") ?? 0) || 0)
  if (!/^[\w.-]+\.mp4$/.test(file) || !existsSync(mediaPath(file))) return new Response("not found", { status: 404 })

  const out = join(CACHE, `${file}_${t.toFixed(2)}.jpg`)
  if (!existsSync(out)) {
    await mkdir(CACHE, { recursive: true })
    await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", t.toFixed(2), "-i", mediaPath(file), "-frames:v", "1", "-vf", "scale=-2:960", "-q:v", "3", out])
  }
  return new Response(new Uint8Array(await readFile(out)), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  })
}
