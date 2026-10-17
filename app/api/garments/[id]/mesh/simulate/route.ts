import { NextResponse } from "next/server"
import { getGarment, operatorGlbFor, simulateOperator } from "@/lib/garment"
import { buildWorkspace } from "@/lib/workspace"

type Ctx = { params: Promise<{ id: string }> }

/** The demo stand-in for the operator: the refined GLB prepared beforehand for this garment (see operatorGlbFor). */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const { garment } = await getGarment(id)
    const glb = operatorGlbFor(garment.sku)
    if (!glb) throw new Error("Nessun intervento operatore preparato per questo capo")
    await simulateOperator(id, glb)
    return NextResponse.json(await buildWorkspace(id))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 })
  }
}
