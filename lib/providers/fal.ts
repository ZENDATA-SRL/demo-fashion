import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { readMedia } from "../media"
import { DATA_DIR } from "../store"
import type { Media } from "../types"
import type { Output } from "./types"

function falKey(): string {
  const key = process.env.FAL_KEY
  if (!key) throw new Error("FAL_KEY missing in .env")
  return key
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const raw = await res.text()
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    throw new Error(`fal ${res.status}: ${raw.slice(0, 240)}`)
  }
}

/** `["body", "image_urls", 0]` -> `image_urls.0`: on a content_policy_violation this is the input that got flagged. */
function detailField(loc: unknown): string {
  if (!Array.isArray(loc)) return ""
  return loc.map(String).filter((part) => part !== "body").join(".")
}

function detailText(detail: unknown): string {
  if (typeof detail !== "object" || !detail || !("msg" in detail)) return String(detail)
  const { msg, loc } = detail as { msg: unknown; loc?: unknown }
  const field = detailField(loc)
  return field ? `${String(msg)} [campo: ${field}]` : String(msg)
}

function falError(data: Record<string, unknown>, fallback: string): string {
  if (typeof data.detail === "string") return data.detail
  if (typeof data.error === "string") return data.error
  if (Array.isArray(data.detail)) return data.detail.map(detailText).join("; ")
  return fallback
}

export async function falQueue(endpoint: string, body: Record<string, unknown>, timeoutMs = 900_000) {
  const auth = { Authorization: `Key ${falKey()}` }
  const startedAt = Date.now()
  const elapsed = () => ((Date.now() - startedAt) / 1000).toFixed(1)
  const fail = (message: string): never => {
    console.error(`[fal] ${endpoint} · error after ${elapsed()}s · ${message}`)
    throw new Error(message)
  }

  console.log(`[fal] ${endpoint} · submitting`)
  const submit = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  })
  const queued = await readJson(submit)
  if (!submit.ok) fail(falError(queued, `fal ${submit.status}`))
  const statusUrl = String(queued.status_url)
  let responseUrl = String(queued.response_url)
  console.log(`[fal] ${endpoint} · queued ${queued.request_id ?? ""}`)

  const deadline = Date.now() + timeoutMs
  let polls = 0
  while (true) {
    let status: Record<string, unknown>
    try {
      status = await readJson(await fetch(statusUrl, { headers: auth, signal: AbortSignal.timeout(20_000) }))
      polls = 0
    } catch (err) {
      polls += 1
      if (polls >= 5 || Date.now() > deadline) fail(err instanceof Error ? err.message : String(err))
      await new Promise((r) => setTimeout(r, 2000))
      continue
    }
    if (status.status === "COMPLETED") {
      if (typeof status.response_url === "string") responseUrl = status.response_url
      break
    }
    if (status.status === "FAILED" || status.status === "CANCELLED") {
      const url = typeof status.response_url === "string" ? status.response_url : responseUrl
      const body: Record<string, unknown> = await fetch(url, { headers: auth }).then(readJson).catch(() => ({}))
      fail(falError({ ...status, ...body }, `fal ${status.status}`))
    }
    if (Date.now() > deadline) fail(`fal timeout (${endpoint})`)
    await new Promise((r) => setTimeout(r, 2000))
  }

  const res = await fetch(responseUrl, { headers: auth })
  const result = await readJson(res)
  if (!res.ok) fail(falError(result, `fal result ${res.status}`))
  console.log(`[fal] ${endpoint} · done in ${elapsed()}s`)
  return result
}

async function uploadToFal(data: Buffer, contentType: string, fileName: string): Promise<string> {
  const init = await fetch("https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST",
    headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ file_name: fileName, content_type: contentType }),
  })
  const json = (await init.json()) as { upload_url?: string; file_url?: string; detail?: string }
  if (!init.ok || !json.upload_url || !json.file_url) throw new Error(json.detail ?? "fal upload failed")
  const put = await fetch(json.upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(data),
  })
  if (!put.ok) throw new Error("fal upload failed")
  return json.file_url
}

const CACHE_PATH = join(DATA_DIR, "fal-urls.json")
let cache: Record<string, string> | undefined

/** Local file -> fal CDN url, uploaded once and re-uploaded if the CDN link expired. */
export async function falUrl(media: Media): Promise<string> {
  cache ??= existsSync(CACHE_PATH) ? (JSON.parse(await readFile(CACHE_PATH, "utf8")) as Record<string, string>) : {}
  const cached = cache[media.file]
  if (cached) {
    const head = await fetch(cached, { method: "HEAD" }).catch(() => null)
    if (head?.ok) return cached
  }
  const url = await uploadToFal(await readMedia(media), media.mime, media.file)
  cache[media.file] = url
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2))
  return url
}

export function falImage(result: Record<string, unknown>): Output {
  const images = result.images as Array<{ url?: string }> | undefined
  const url = images?.[0]?.url ?? (result.image as { url?: string } | undefined)?.url
  if (!url) throw new Error("fal: no image returned")
  return { url }
}

export function falAudio(result: Record<string, unknown>): Output {
  const url = (result.audio as { url?: string } | undefined)?.url
  if (!url) throw new Error("fal: no audio returned")
  return { url }
}

export function falVideo(result: Record<string, unknown>): Output {
  const url = (result.video as { url?: string } | undefined)?.url
  if (!url) throw new Error("fal: no video returned")
  return { url }
}

/** First file url among the keys a 3D endpoint uses (`model_glb`, `model_mesh`). */
export function falFile(result: Record<string, unknown>, keys: string[]): Output {
  for (const key of keys) {
    const file = result[key] as { url?: string } | undefined
    if (file?.url) return { url: file.url }
  }
  throw new Error("fal: no 3D file returned")
}
