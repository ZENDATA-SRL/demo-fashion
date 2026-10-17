import { extname } from "node:path"
import { NextResponse } from "next/server"
import { addOperatorMesh } from "@/lib/garment"
import { saveBuffer } from "@/lib/media"
import { buildWorkspace } from "@/lib/workspace"

type Ctx = { params: Promise<{ id: string }> }

/** The operator sends back the refined model as a GLB. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File) || file.size === 0) throw new Error("no file")
    if (extname(file.name).toLowerCase() !== ".glb") throw new Error("a .glb file is required")
    const label = form.get("label") === "pixal3d" ? "pixal3d" : "operatore"
    await addOperatorMesh(id, await saveBuffer(Buffer.from(await file.arrayBuffer()), ".glb"), label)
    return NextResponse.json(await buildWorkspace(id))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 })
  }
}
