import { NextResponse } from "next/server"
import { startAction, type Action } from "@/lib/actions"
import { BRAND_LORA_IDS } from "@/lib/brand-lora"
import { allCast } from "@/lib/prompts/cast"
import { STUDIO_LOOKS } from "@/lib/prompts/studio"
import { UGC_FORMATS, UGC_TRACKS, UGC_VOICES } from "@/lib/prompts/ugc"

type Ctx = { params: Promise<{ id: string }> }

const TYPES: Action["type"][] = ["prepare", "dna", "brand-dna", "shoot", "canon", "canon-all", "refine", "onmodel", "onmodel-all", "studio", "ugc-frame", "ugc-clip", "ugc-reel", "ugc-auto", "pdp", "focus", "export", "qa", "mesh"]

/** The demo ships with every asset already generated: provider calls only run with DEMO_LIVE=1 and keys in .env. */
export async function POST(req: Request, { params }: Ctx) {
  if (process.env.DEMO_LIVE !== "1") return NextResponse.json({ offline: true })
  const { id } = await params
  const action = (await req.json().catch(() => ({}))) as Action
  if (!TYPES.includes(action.type)) return NextResponse.json({ error: "azione sconosciuta" }, { status: 400 })
  if ("models" in action && (!Array.isArray(action.models) || !action.models.length)) {
    return NextResponse.json({ error: "Scegli almeno un modello" }, { status: 400 })
  }
  if (action.type === "studio" && !STUDIO_LOOKS.some((l) => l.id === action.look)) {
    return NextResponse.json({ error: "look studio sconosciuto" }, { status: 400 })
  }
  if (action.type === "ugc-frame" || action.type === "ugc-clip" || action.type === "ugc-reel" || action.type === "ugc-auto") {
    const format = UGC_FORMATS.find((f) => f.id === action.format)
    if (!format) return NextResponse.json({ error: "formato UGC sconosciuto" }, { status: 400 })
    if ("shots" in action && action.shots?.some((id) => !format.shots.some((s) => s.id === id))) {
      return NextResponse.json({ error: "scatto UGC sconosciuto" }, { status: 400 })
    }
    if ((action.type === "ugc-clip" || action.type === "ugc-auto") && action.voice && !UGC_VOICES.some((v) => v.id === action.voice)) {
      return NextResponse.json({ error: "voce UGC sconosciuta" }, { status: 400 })
    }
    if ((action.type === "ugc-reel" || action.type === "ugc-auto") && action.music && !UGC_TRACKS.some((t) => t.id === action.music)) {
      return NextResponse.json({ error: "musica UGC sconosciuta" }, { status: 400 })
    }
  }
  if (action.type === "onmodel" && action.model && !allCast().some((m) => m.id === action.model)) {
    return NextResponse.json({ error: "cast sconosciuto" }, { status: 400 })
  }
  if (action.type === "refine" && !action.instruction?.trim()) {
    return NextResponse.json({ error: "Scrivi cosa correggere" }, { status: 400 })
  }
  if (action.type === "brand-dna" && !BRAND_LORA_IDS.includes(action.brandId)) {
    return NextResponse.json({ error: "Brand LoRA sconosciuto" }, { status: 400 })
  }
  try {
    return NextResponse.json(await startAction(id, action))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 })
  }
}
