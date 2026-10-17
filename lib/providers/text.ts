import { BedrockRuntimeClient, ConverseCommand, type ImageFormat } from "@aws-sdk/client-bedrock-runtime"
import { readMedia } from "../media"
import type { TextModel, TextRequest } from "./types"

function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("the text model did not return valid JSON")
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
  throw lastErr ?? new Error(`${label} failed`)
}

async function geminiJson<T>(req: TextRequest): Promise<T> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error("GEMINI_API_KEY missing in .env")
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
  if (!text) throw new Error(`Gemini empty response (${candidates?.[0]?.finishReason ?? "?"})`)
  return parseJson<T>(text)
}

type ChatServer = { label: string; base: string; model?: string; key?: string }

/** Any OpenAI-compatible chat server: vLLM, Ollama, LM Studio, or a hosted one. */
async function chatJson<T>(server: ChatServer, req: TextRequest): Promise<T> {
  const { label, model, key } = server
  const base = server.base.replace(/\/$/, "")
  if (!model) throw new Error(`${label}: model missing in .env`)
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
  const data = await withRetry(label, () =>
    fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  )
  const text = (data.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content
  if (!text) throw new Error(`${label}: empty response`)
  return parseJson<T>(text)
}

const openAiJson = <T>(req: TextRequest) =>
  chatJson<T>(
    { label: "Local LLM", base: process.env.OPENAI_BASE_URL ?? "http://localhost:11434/v1", model: process.env.OPENAI_MODEL, key: process.env.OPENAI_API_KEY },
    req,
  )

export const amdReady = () => !!process.env.AMD_API_KEY
export const amdModelId = () => process.env.AMD_MODEL ?? "Qwen3.8-27B"

/** AMD Token Factory, OpenAI-compatible; the default model reads images, which DNA extraction and QA need. */
function amdJson<T>(req: TextRequest): Promise<T> {
  if (!amdReady()) throw new Error("AMD_API_KEY missing in .env")
  return chatJson<T>(
    { label: "AMD Token Factory", base: process.env.AMD_BASE_URL ?? "https://developer.amd.com.cn/radeon/api/v1", model: amdModelId(), key: process.env.AMD_API_KEY },
    req,
  )
}

const g = globalThis as { __bedrock?: BedrockRuntimeClient }

export const bedrockModelId = () => process.env.BEDROCK_MODEL_ID ?? "eu.anthropic.claude-sonnet-5-5"

/** Amazon Bedrock Converse API. Credentials come from the default AWS chain (AWS_PROFILE, env keys, SSO). */
async function bedrockJson<T>(req: TextRequest): Promise<T> {
  g.__bedrock ??= new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "eu-central-1" })
  const modelId = bedrockModelId()
  const images = await Promise.all(
    (req.images ?? []).map(async (m) => ({
      image: { format: m.mime.replace("image/", "").replace("jpg", "jpeg") as ImageFormat, source: { bytes: await readMedia(m) } },
    })),
  )
  // a tool call returns the answer as a structured object: no JSON to repair when a quote holds quotation marks.
  // Newer models refuse a forced tool_choice, so the instruction asks for it and the text reply stays the fallback.
  const out = await g.__bedrock.send(
    new ConverseCommand({
      modelId,
      system: [{ text: `${req.system}\n\nConsegna la risposta chiamando lo strumento "answer" con l'oggetto come input, senza altro testo.` }],
      messages: [{ role: "user", content: [...images, { text: req.prompt }] }],
      inferenceConfig: { maxTokens: 12000 },
      toolConfig: {
        tools: [{ toolSpec: { name: "answer", description: "La risposta, nello schema JSON chiesto dal prompt di sistema.", inputSchema: { json: { type: "object" } } } }],
        toolChoice: { auto: {} },
      },
    }),
  )
  const content = out.output?.message?.content ?? []
  const tool = content.find((c) => c.toolUse)?.toolUse?.input
  if (tool && typeof tool === "object") {
    // some replies wrap the object once more, as { "input": {...} } or { "answer": {...} }
    const keys = Object.keys(tool)
    const inner = keys.length === 1 ? (tool as Record<string, unknown>)[keys[0]] : undefined
    return (inner && typeof inner === "object" && !Array.isArray(inner) ? inner : tool) as T
  }
  const text = content.map((c) => c.text ?? "").join("").trim()
  if (!text) throw new Error(`Bedrock empty response (${out.stopReason ?? "?"})`)
  return parseJson<T>(text)
}

export const TEXT_MODELS: TextModel[] = [
  {
    id: "amd",
    label: "AMD Token Factory",
    note: "Open models (Qwen, DeepSeek, Gemma…) on AMD GPUs, model from AMD_MODEL",
    provider: "amd",
    hosting: "managed",
    weights: "open",
    json: amdJson,
  },
  {
    id: "gemini",
    label: "Gemini",
    note: "Vision + JSON, managed by Google",
    provider: "gemini",
    hosting: "managed",
    weights: "closed",
    json: geminiJson,
  },
  {
    id: "local-llm",
    label: "LLM OpenAI-compatible",
    note: "vLLM / Ollama / LM Studio with a vision model (e.g. Qwen3-VL)",
    provider: "openai-compatible",
    hosting: "self-hosted",
    weights: "open",
    json: openAiJson,
  },
  {
    id: "bedrock",
    label: "Claude on Amazon Bedrock",
    note: "Converse API, model from BEDROCK_MODEL_ID",
    provider: "bedrock",
    hosting: "managed",
    weights: "closed",
    json: bedrockJson,
  },
]
