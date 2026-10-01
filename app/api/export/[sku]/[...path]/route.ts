import { createReadStream, existsSync } from "node:fs"
import { stat } from "node:fs/promises"
import { basename, extname, join, normalize, sep } from "node:path"
import { Readable } from "node:stream"
import { MIME } from "@/lib/media"
import { DATA_DIR } from "@/lib/store"

type Ctx = { params: Promise<{ sku: string; path: string[] }> }

const TEXT: Record<string, string> = { ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8" }

export async function GET(req: Request, { params }: Ctx) {
  const { sku, path } = await params
  const root = join(DATA_DIR, "export", sku)
  const file = normalize(join(root, ...path))
  if (!/^[\w.-]+$/.test(sku) || !file.startsWith(root + sep) || !existsSync(file)) return new Response("not found", { status: 404 })
  const ext = extname(file).toLowerCase()
  const download = new URL(req.url).searchParams.has("download")
  const { size } = await stat(file)
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: {
      "Content-Type": TEXT[ext] ?? MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(size),
      ...(download ? { "Content-Disposition": `attachment; filename="${basename(file)}"` } : {}),
    },
  })
}
