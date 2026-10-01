import { extname } from "node:path"
import { readMedia } from "../media"
import type { Media } from "../types"
import type { Output } from "./types"

/** The ComfyUI pod on RunPod: Qwen Image 2.1 for every image, Pixal3D / TRELLIS.2 for the 3D. */
function base(): string {
  const url = process.env.COMFY_BASE
  if (!url) throw new Error("COMFY_BASE mancante in .env (es. https://<pod>-8188.proxy.runpod.net)")
  return url.replace(/\/$/, "")
}

/** The RunPod proxy turns away requests without a browser user agent. */
const UA = { "User-Agent": "Mozilla/5.0 (demo-fashion)" }
const SUBFOLDER = "demo_fashion"

type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>
type FileRef = { filename: string; subfolder?: string; type?: string }
type HistoryEntry = { outputs: Record<string, unknown>; status?: { completed?: boolean; status_str?: string; messages?: unknown[] } }

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...UA, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const raw = await res.text()
  if (!res.ok) throw new Error(`ComfyUI ${res.status} su ${path}: ${raw.slice(0, 400)}`)
  return JSON.parse(raw) as T
}

const uploaded = new Set<string>()

/** Local media -> name under ComfyUI's input folder, uploaded once per server process. */
export async function comfyInput(media: Media): Promise<string> {
  const name = `${SUBFOLDER}/${media.file}`
  if (uploaded.has(name)) return name
  const form = new FormData()
  form.set("image", new Blob([new Uint8Array(await readMedia(media))], { type: media.mime }), media.file)
  form.set("type", "input")
  form.set("subfolder", SUBFOLDER)
  form.set("overwrite", "true")
  // the proxy drops some large uploads with a broken pipe
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${base()}/api/upload/image`, { method: "POST", headers: UA, body: form })
      if (!res.ok) throw new Error(`upload ${res.status}: ${(await res.text()).slice(0, 200)}`)
      break
    } catch (err) {
      if (attempt === 3) throw err
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)))
    }
  }
  uploaded.add(name)
  return name
}

/** Queues a graph and waits for it; the pod runs one job at a time, so the wait includes the queue. */
export async function comfyRun(graph: Graph, timeoutMs: number): Promise<HistoryEntry> {
  const started = Date.now()
  const { prompt_id: id } = await api<{ prompt_id: string }>("/prompt", { prompt: graph, client_id: "demo-fashion" })
  console.log(`[comfy] ${id} · in coda`)
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 2000))
    const history = await api<Record<string, HistoryEntry>>(`/history/${id}`).catch(() => ({}) as Record<string, HistoryEntry>)
    const entry = history[id]
    if (!entry) continue
    if (entry.status?.status_str === "error") {
      const error = entry.status.messages?.find((m) => Array.isArray(m) && m[0] === "execution_error") as [string, { exception_message?: string; node_type?: string }] | undefined
      throw new Error(`ComfyUI: ${error?.[1].node_type ?? "nodo"} · ${error?.[1].exception_message?.trim() ?? "errore"}`)
    }
    if (entry.status?.completed) {
      console.log(`[comfy] ${id} · fatto in ${Math.round((Date.now() - started) / 1000)}s`)
      return entry
    }
  }
  throw new Error(`ComfyUI: timeout dopo ${Math.round(timeoutMs / 60000)} minuti`)
}

function* files(node: unknown): Generator<FileRef> {
  if (Array.isArray(node)) for (const v of node) yield* files(v)
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>
    if (typeof o.filename === "string") yield o as FileRef
    for (const v of Object.values(o)) yield* files(v)
  }
}

/** The first output file whose name ends with one of `exts`, downloaded from the pod. */
export async function comfyOutput(entry: HistoryEntry, exts: string[]): Promise<Output> {
  for (const file of files(entry.outputs)) {
    const ext = extname(file.filename).toLowerCase()
    if (!exts.includes(ext)) continue
    const q = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder ?? "", type: file.type ?? "output" })
    const res = await fetch(`${base()}/view?${q}`, { headers: UA })
    if (!res.ok) throw new Error(`ComfyUI: download ${res.status}`)
    return { data: Buffer.from(await res.arrayBuffer()), ext }
  }
  throw new Error(`ComfyUI: nessun file ${exts.join("/")} in uscita`)
}
