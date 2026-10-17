import { extname } from "node:path"
import { NextResponse } from "next/server"
import { IDENTITY_TYPES, importIdentity, readIdentity } from "@/lib/brand-identity"

export async function GET() {
  return NextResponse.json(readIdentity() ?? null)
}

/** The house's corporate identity document: Evolus reads it and the brand characteristics are rewritten from it. */
export async function POST(req: Request) {
  if (process.env.DEMO_LIVE !== "1") {
    return NextResponse.json({ error: "Offline demo: set DEMO_LIVE=1 to read a new document" }, { status: 409 })
  }
  try {
    const file = (await req.formData()).get("file")
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a document" }, { status: 400 })
    if (!IDENTITY_TYPES[extname(file.name).toLowerCase()]) {
      return NextResponse.json({ error: "Use a PDF, DOCX, TXT, Markdown or image file" }, { status: 400 })
    }
    if (file.size > 20 << 20) return NextResponse.json({ error: "The document is over 20 MB" }, { status: 400 })
    return NextResponse.json(await importIdentity({ data: Buffer.from(await file.arrayBuffer()), name: file.name }))
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
