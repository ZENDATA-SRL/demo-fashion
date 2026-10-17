import { NextResponse } from "next/server"
import { CHANNEL_IDS, MARKET_IDS, clearCampaign, runCampaign } from "@/lib/campaign"
import type { CampaignPlan } from "@/lib/campaign-types"
import { buildWorkspace } from "@/lib/workspace"

type Ctx = { params: Promise<{ id: string }> }

function planOf(body: Partial<CampaignPlan>): CampaignPlan {
  const num = (v: unknown, min: number, max: number, name: string) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new Error(`${name} fuori intervallo (${min}–${max})`)
    return Math.round(v)
  }
  const channels = (body.channels ?? []).filter((c) => CHANNEL_IDS.includes(c))
  const markets = (body.markets ?? []).filter((m) => MARKET_IDS.includes(m))
  if (!channels.length) throw new Error("Scegli almeno un canale")
  if (!markets.length) throw new Error("Scegli almeno un mercato")
  return { budget: num(body.budget, 500, 20000, "Budget"), days: num(body.days, 3, 30, "Durata"), channels, markets, price: num(body.price, 50, 5000, "Prezzo") }
}

/** The simulation is deterministic and costs nothing, so it runs in the offline demo too. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await runCampaign(id, planOf((await req.json().catch(() => ({}))) as Partial<CampaignPlan>))
    return NextResponse.json(await buildWorkspace(id))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  await clearCampaign(id)
  return NextResponse.json(await buildWorkspace(id))
}
