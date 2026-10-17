import { mkdir, readFile, writeFile } from "node:fs/promises"
import { extname, join } from "node:path"
import { DATA_DIR, newId } from "./store"
import type { Media } from "./types"

export const MEDIA_DIR = join(DATA_DIR, "media")

export const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".glb": "model/gltf-binary",
}

export function mediaPath(media: Media | string): string {
  return join(MEDIA_DIR, typeof media === "string" ? media : media.file)
}

export function readMedia(media: Media): Promise<Buffer> {
  return readFile(mediaPath(media))
}

export async function saveBuffer(data: Buffer, ext: string): Promise<Media> {
  await mkdir(MEDIA_DIR, { recursive: true })
  const file = `${newId("m")}${ext}`
  await writeFile(mediaPath(file), data)
  return { file, mime: MIME[ext] ?? "application/octet-stream" }
}

export async function saveRemote(url: string, fallbackExt: string): Promise<Media> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed (${res.status})`)
  const ext = extname(new URL(url).pathname).toLowerCase()
  return saveBuffer(Buffer.from(await res.arrayBuffer()), MIME[ext] ? ext : fallbackExt)
}

export async function importFile(path: string): Promise<Media> {
  const ext = extname(path).toLowerCase()
  if (!MIME[ext]) throw new Error(`unsupported format: ${ext}`)
  return saveBuffer(await readFile(path), ext)
}
