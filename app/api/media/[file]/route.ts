import { createReadStream, existsSync } from "node:fs"
import { stat } from "node:fs/promises"
import { extname } from "node:path"
import { Readable } from "node:stream"
import { MIME, mediaPath } from "@/lib/media"

type Ctx = { params: Promise<{ file: string }> }

/** Serves data/media with HTTP Range support, so videos can seek and start instantly. */
export async function GET(req: Request, { params }: Ctx) {
  const { file } = await params
  if (!/^[\w.-]+$/.test(file)) return new Response("not found", { status: 404 })
  const path = mediaPath(file)
  if (!existsSync(path)) return new Response("not found", { status: 404 })

  const { size } = await stat(path)
  const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream"
  const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable" }

  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/)
  if (range) {
    const start = range[1] ? Number(range[1]) : 0
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
    const stream = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}` },
    })
  }
  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } })
}
