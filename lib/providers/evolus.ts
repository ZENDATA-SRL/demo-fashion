/**
 * Evolus AI Tools (https://evolus.ai/en/developers): `summarize` and the other document tools, on Evolus models.
 * The REST API takes an application key with its space ID, both from the workspace's API keys page.
 */

const BASE = "https://api.evolus.ai/api/v1"

export type EvolusOptions = { length?: "short" | "medium" | "long"; style?: "prose" | "bullets" } | { target: string; style?: "natural" | "literal" | "formal" }
type ToolResult = { tool: string; output: string; creditsConsumed?: number; truncated?: boolean }

export const evolusReady = () => !!process.env.EVOLUS_API_KEY && !!process.env.EVOLUS_APP_ID

function headers(): Record<string, string> {
  if (!evolusReady()) throw new Error("EVOLUS_API_KEY or EVOLUS_APP_ID missing in .env")
  return { "X-ApiKey": process.env.EVOLUS_API_KEY!, "X-Application-Id": process.env.EVOLUS_APP_ID! }
}

async function parse(res: Response): Promise<ToolResult> {
  const data = (await res.json().catch(() => ({}))) as Partial<ToolResult> & { title?: string; errorCode?: string }
  if (res.status === 402) throw new Error("Evolus: the workspace has run out of credits")
  if (!res.ok) throw new Error(`Evolus ${res.status}: ${data.title ?? data.errorCode ?? "request failed"}`)
  if (!data.output?.trim()) throw new Error("Evolus: empty output")
  return data as ToolResult
}

/** A tool on plain text, up to 120,000 characters. */
export async function evolusText(tool: string, text: string, options: EvolusOptions = {}): Promise<ToolResult> {
  const res = await fetch(`${BASE}/ai-tools/${tool}/run`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 120_000), options }),
  })
  return parse(res)
}

/** A tool on a document (PDF, DOCX, scans and images with OCR), up to 20 MB. */
export async function evolusFile(tool: string, file: { data: Buffer; name: string; mime: string }, options: EvolusOptions = {}): Promise<ToolResult> {
  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(file.data)], { type: file.mime }), file.name)
  const res = await fetch(`${BASE}/ai-tools/${tool}/run-media?options=${encodeURIComponent(JSON.stringify(options))}`, {
    method: "POST",
    headers: headers(),
    body: form,
  })
  return parse(res)
}
