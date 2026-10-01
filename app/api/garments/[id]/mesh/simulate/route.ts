import { existsSync } from "node:fs"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { simulateOperator } from "@/lib/garment"
import { buildWorkspace } from "@/lib/workspace"

type Ctx = { params: Promise<{ id: string }> }

/** The demo stand-in for the operator: the refined GLB prepared beforehand, named by DEMO_OPERATOR_GLB. */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const glb = process.env.DEMO_OPERATOR_GLB || join(process.cwd(), "demo", "operator", "cabas.glb")
    if (!existsSync(glb)) throw new Error("DEMO_OPERATOR_GLB non punta a un GLB")
    await simulateOperator(id, glb)
    return NextResponse.json(await buildWorkspace(id))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 })
  }
}
