import { NextResponse } from "next/server"
import { setStatus } from "@/lib/garment"
import type { AssetStatus } from "@/lib/types"

type Ctx = { params: Promise<{ id: string }> }

const STATUSES: AssetStatus[] = ["draft", "approved", "rejected"]

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { status?: AssetStatus; by?: string }
  if (!body.status || !STATUSES.includes(body.status)) return NextResponse.json({ error: "stato non valido" }, { status: 400 })
  try {
    const asset = await setStatus(id, body.status, body.by ?? "reviewer")
    return NextResponse.json({ id: asset.id, status: asset.status, approvedBy: asset.approvedBy ?? null })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 404 })
  }
}
