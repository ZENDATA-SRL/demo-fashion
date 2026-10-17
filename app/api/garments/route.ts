import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { extname } from "node:path"
import { NextResponse } from "next/server"
import { startAction } from "@/lib/actions"
import { addInput, createGarment } from "@/lib/garment"
import { MIME, mediaPath, saveBuffer } from "@/lib/media"
import { readDb } from "@/lib/store"
import type { Media } from "@/lib/types"
import { listGarments } from "@/lib/workspace"

export async function GET() {
  return NextResponse.json(await listGarments())
}

/** An uploaded file, or the name of a media file already in the library (the example inputs). */
async function inputMedia(form: FormData, field: string): Promise<Media | undefined> {
  const file = form.get(field)
  if (file instanceof File && file.size > 0) {
    const ext = extname(file.name).toLowerCase().replace(".jpeg", ".jpg")
    if (!MIME[ext] || ext === ".mp4") throw new Error(`unsupported format: ${file.name}`)
    return saveBuffer(Buffer.from(await file.arrayBuffer()), ext)
  }
  const from = form.get(`${field}From`)
  if (typeof from === "string" && /^[\w.-]+$/.test(from) && existsSync(mediaPath(from))) {
    return saveBuffer(await readFile(mediaPath(from)), extname(from))
  }
  return undefined
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const text = (k: string) => String(form.get(k) ?? "").trim()
    const brief = text("brief")
    if (!brief) return NextResponse.json({ error: "Write the product description" }, { status: 400 })

    const archive = await inputMedia(form, "archive")
    const sketch = await inputMedia(form, "sketch")
    const created = text("start") === "ai"
    if (!archive && !sketch && !created) return NextResponse.json({ error: "Upload a photo or a sketch, or have it created from the description" }, { status: 400 })

    const db = await readDb()
    const base = text("sku") || `FW26-${String(db.garments.length + 1).padStart(3, "0")}`
    let sku = base
    for (let i = 2; db.garments.some((g) => g.sku === sku); i++) sku = `${base}-${i}`

    const garment = await createGarment({
      sku,
      name: text("name") || "New product",
      maison: text("maison") || "Aurenzi Milano",
      line: text("line") === "uomo" ? "uomo" : "donna",
      brief,
      goal: text("goal") || "site pre-orders + 6 UGC ads to test 3 hooks before production",
    })
    if (archive) await addInput(garment.id, "archive", archive)
    if (sketch) await addInput(garment.id, "sketch", sketch)
    if (process.env.DEMO_LIVE === "1") await startAction(garment.id, { type: "prepare" })
    return NextResponse.json({ id: garment.id })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 })
  }
}
