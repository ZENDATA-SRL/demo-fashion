import { readMedia } from "../media"
import type { TextModel, TextRequest } from "./types"

function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("il modello di testo non ha restituito JSON valido")
    return JSON.parse(match[0]) as T
  }
}

async function withRetry(label: string, call: () => Promise<Response>): Promise<Record<string, unknown>> {
  let lastErr: Error | undefined
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await call()
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`${label} ${res.status}`)
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt))
      continue
    }
    if (!res.ok) throw new Error(`${label} ${res.status}: ${JSON.stringify(data.error ?? data).slice(0, 300)}`)
    return data
  }
  throw lastErr ?? new Error(`${label} fallito`)
}

async function geminiJson<T>(req: TextRequest): Promise<T> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error("GEMINI_API_KEY mancante in .env")
  const model = process.env.GEMINI_MODEL ?? "gemini-3.8-flash"
  const images = await Promise.all(
    (req.images ?? []).map(async (m) => ({ inlineData: { mimeType: m.mime, data: (await readMedia(m)).toString("base64") } })),
  )
  const body = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: "user", parts: [...images, { text: req.prompt }] }],
    generationConfig: { temperature: req.temperature ?? 0.4, responseMimeType: "application/json" },
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
  const data = await withRetry("Gemini", () =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  )
  const candidates = data.candidates as Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> | undefined
  const text = candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim()
  if (!text) throw new Error(`Gemini risposta vuota (${candidates?.[0]?.finishReason ?? "?"})`)
  return parseJson<T>(text)
}

/** Any OpenAI-compatible chat server: vLLM, Ollama, LM Studio, or a hosted one. */
async function openAiJson<T>(req: TextRequest): Promise<T> {
  const base = (process.env.OPENAI_BASE_URL ?? "http://localhost:11434/v1").replace(/\/$/, "")
  const model = process.env.OPENAI_MODEL
  if (!model) throw new Error("OPENAI_MODEL mancante in .env")
  const images = await Promise.all(
    (req.images ?? []).map(async (m) => ({
      type: "image_url",
      image_url: { url: `data:${m.mime};base64,${(await readMedia(m)).toString("base64")}` },
    })),
  )
  const body = {
    model,
    temperature: req.temperature ?? 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: [...images, { type: "text", text: req.prompt }] },
    ],
  }
  const data = await withRetry("LLM locale", () =>
    fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.OPENAI_API_KEY ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  )
  const text = (data.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content
  if (!text) throw new Error("LLM locale: risposta vuota")
  return parseJson<T>(text)
}

export const TEXT_MODELS: TextModel[] = [
  {
    id: "gemini",
    label: "Gemini",
    note: "Vision + JSON, gestito da Google",
    provider: "gemini",
    hosting: "managed",
    weights: "closed",
    json: geminiJson,
  },
  {
    id: "local-llm",
    label: "LLM OpenAI-compatible",
    note: "vLLM / Ollama / LM Studio con un modello vision (es. Qwen3-VL)",
    provider: "openai-compatible",
    hosting: "self-hosted",
    weights: "open",
    json: openAiJson,
  },
]
