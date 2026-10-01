import { NextResponse } from "next/server"
import { updateDb } from "@/lib/store"
import type { DnaField, ShootPlan, Source } from "@/lib/types"
import { buildWorkspace } from "@/lib/workspace"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    return NextResponse.json(await buildWorkspace(id))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 404 })
  }
}

const SOURCES: Source[] = ["sketch", "archive", "note", "invented", "measured"]

type Patch = {
  field?: { key: string; value?: string; source?: Source; critical?: boolean }
  confirmDna?: boolean
  /** one text of the shoot plan, by dotted path, e.g. "views.front" or "zones.1.target" */
  shoot?: { path: string; value: string }
  signoff?: { by: string; items: string[] } | null
}

const SHOOT_PATH =
  /^(noun|description|identity|lock|scale|outfit|wear|views\.(front|back|side)|details\.detail-(button|fabric)\.(label|region|shot)|hardware\.(label|target)|ugc\.(wear|show|touch)|ugc\.copy\.[a-z-]+\.(hook|line)|zones\.\d+\.(label|target)|backZones\.\d+)$/

function setShootText(plan: ShootPlan, path: string, value: string) {
  if (!SHOOT_PATH.test(path)) throw new Error(`campo del piano non modificabile: ${path}`)
  const keys = path.split(".")
  const last = keys.pop()!
  const parent = keys.reduce<unknown>((o, k) => (o as Record<string, unknown> | null | undefined)?.[k], plan) as Record<string, unknown> | null | undefined
  if (!parent || typeof parent[last] !== "string") throw new Error(`campo del piano non trovato: ${path}`)
  parent[last] = value
}

/** Edits by a reviewer: one DNA field, one text of the shoot plan, the DNA confirmation, the sign-off. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as Patch
  try {
    await updateDb((db) => {
      const g = db.garments.find((x) => x.id === id)
      if (!g) throw new Error("capo non trovato")
      if (body.field) {
        const f: DnaField | undefined = g.dna?.fields.find((x) => x.key === body.field!.key)
        if (!f) throw new Error("campo non trovato")
        if (typeof body.field.value === "string" && body.field.value.trim()) f.value = body.field.value.trim()
        if (body.field.source && SOURCES.includes(body.field.source)) f.source = body.field.source
        if (typeof body.field.critical === "boolean") f.critical = body.field.critical
      }
      if (body.shoot) {
        if (!g.shoot) throw new Error("piano di scatti mancante")
        if (typeof body.shoot.value !== "string" || !body.shoot.value.trim()) throw new Error("testo vuoto")
        setShootText(g.shoot, body.shoot.path, body.shoot.value.trim())
      }
      if (body.confirmDna === true) g.dnaConfirmedAt = new Date().toISOString()
      if (body.confirmDna === false) delete g.dnaConfirmedAt
      if (body.signoff === null) delete g.signoff
      else if (body.signoff) g.signoff = { by: body.signoff.by || "reviewer", items: body.signoff.items, at: new Date().toISOString() }
    })
    return NextResponse.json(await buildWorkspace(id))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 })
  }
}
