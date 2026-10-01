import { NextRequest, NextResponse } from "next/server"

const APP = "decart/lucy2-vton/realtime"

export async function GET(request: NextRequest) {
  const app = request.nextUrl.searchParams.get("app")
  if (app !== APP) {
    return NextResponse.json({ error: "app non consentita" }, { status: 400 })
  }
  const key = process.env.FAL_KEY
  if (!key) {
    return NextResponse.json({ error: "FAL_KEY mancante" }, { status: 500 })
  }

  const res = await fetch("https://rest.fal.ai/tokens/realtime", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
    body: JSON.stringify({ app, duration: 600 }),
  })
  const raw = await res.text()
  if (!res.ok) {
    return NextResponse.json({ error: `token fal ${res.status}` }, { status: 502 })
  }
  const token = JSON.parse(raw) as unknown
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "token fal non valido" }, { status: 502 })
  }
  return NextResponse.json(token)
}
