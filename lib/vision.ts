import { execFile } from "node:child_process"
import { readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { askJson } from "./generate"
import { mediaPath, saveBuffer } from "./media"
import { newId } from "./store"
import type { Box, Media } from "./types"

export type { Box }

const run = promisify(execFile)

const LOCATE_SYSTEM = `You locate regions in a product image. For each requested target return the tightest bounding box that contains it.
Return JSON: { "boxes": [ { "label": string, "box_2d": [ymin, xmin, ymax, xmax] } ] } with coordinates normalised to 0-1000, one entry per target in the same order and with the same label. If a target is not visible, omit it.`

export async function locate(media: Media, targets: string[]): Promise<Record<string, Box>> {
  const { data } = await askJson<{ boxes?: Array<{ label: string; box_2d: Box }> }>({
    system: LOCATE_SYSTEM,
    prompt: `Targets:\n${targets.map((t) => `- ${t}`).join("\n")}`,
    images: [media],
    temperature: 0,
  })
  const out: Record<string, Box> = {}
  for (const b of data.boxes ?? []) {
    if (targets.includes(b.label) && Array.isArray(b.box_2d) && b.box_2d.length === 4) out[b.label] = b.box_2d
  }
  return out
}

async function size(path: string): Promise<{ width: number; height: number }> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", path])
  const stream = (JSON.parse(stdout) as { streams: Array<{ width: number; height: number }> }).streams[0]
  return { width: stream.width, height: stream.height }
}

async function duration(path: string): Promise<number> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
  return Number(stdout.trim())
}

/** Stills at the given fractions of a video's duration (0-1). */
export async function extractFrames(video: Media, fractions: number[]): Promise<Array<{ sec: number; media: Media }>> {
  const src = mediaPath(video)
  const total = await duration(src)
  return Promise.all(
    fractions.map(async (f) => {
      const sec = Math.max(0, Math.min(total - 0.05, total * f))
      const out = join(tmpdir(), `${newId("frame")}.jpg`)
      await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", sec.toFixed(2), "-i", src, "-frames:v", "1", "-q:v", "2", out])
      const media = await saveBuffer(await readFile(out), ".jpg")
      await rm(out, { force: true })
      return { sec, media }
    }),
  )
}

async function hasAudio(path: string): Promise<boolean> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", path])
  return stdout.trim().length > 0
}

/**
 * Where the sound of a clip ends, from the audio track: the start of the trailing silence, or the clip's end when the
 * sound runs to the last frame (a sentence the generator cut short). `duration` is the real length, often longer than
 * the length asked for.
 */
export async function soundEnd(media: Media): Promise<{ end: number; duration: number }> {
  const src = mediaPath(media)
  const total = await duration(src)
  if (!(await hasAudio(src))) return { end: 0, duration: total }
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-i", src, "-af", "silencedetect=noise=-38dB:d=0.15", "-f", "null", "-"])
  const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]))
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]))
  const lastStart = starts.at(-1)
  // a trailing silence has a start and no end, or an end at the very end of the file
  const trailing = lastStart !== undefined && (ends.length < starts.length || total - (ends.at(-1) ?? 0) < 0.05)
  return { end: trailing ? lastStart! : total, duration: total }
}

/**
 * Tempo and first beat of a music track, from the autocorrelation of its onset envelope over the first 20 seconds.
 * Music models do not keep the tempo they are asked for, so the edit is snapped to what the track really plays.
 * The search stays in 85-140 BPM, where reel music sits, to avoid half and double tempo.
 */
export async function beatGrid(media: Media): Promise<{ bpm: number; period: number; offset: number }> {
  const rate = 11025
  const hop = 128
  const { stdout } = await run("ffmpeg", ["-v", "error", "-i", mediaPath(media), "-t", "20", "-ac", "1", "-ar", String(rate), "-f", "f32le", "-"], {
    encoding: "buffer",
    maxBuffer: 64 << 20,
  })
  const pcm = new Float32Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.byteLength / 4))
  const frames = Math.floor(pcm.length / hop)
  const fps = rate / hop
  const onset = new Float32Array(frames)
  let prev = 0
  for (let i = 0; i < frames; i++) {
    let e = 0
    for (let j = i * hop; j < (i + 1) * hop; j++) e += pcm[j] * pcm[j]
    const level = Math.log(1e-7 + e)
    onset[i] = i ? Math.max(0, level - prev) : 0
    prev = level
  }
  const at = (x: number) => {
    const i = Math.floor(x)
    return i + 1 < frames ? onset[i] + (onset[i + 1] - onset[i]) * (x - i) : 0
  }
  let best = { bpm: 120, score: -1 }
  for (let bpm = 85; bpm <= 140; bpm += 0.25) {
    const lag = (60 / bpm) * fps
    let score = 0
    for (let i = 0; i + 2 * lag < frames; i++) score += onset[i] * (at(i + lag) + 0.5 * at(i + 2 * lag))
    if (score > best.score) best = { bpm, score }
  }
  // the autocorrelation finds the tempo to about a beat per minute; a comb over tempo and phase together pins both
  let fine = { bpm: best.bpm, frame: 0, score: -1 }
  for (let bpm = best.bpm - 1.5; bpm <= best.bpm + 1.5; bpm += 0.02) {
    const lag = (60 / bpm) * fps
    for (let f = 0; f < lag; f += 0.5) {
      let score = 0
      for (let x = f; x < frames - 1; x += lag) score += at(x)
      if (score > fine.score) fine = { bpm, frame: f, score }
    }
  }
  return { bpm: Math.round(fine.bpm * 100) / 100, period: 60 / fine.bpm, offset: fine.frame / fps }
}

export type Cut = { media: Media; from: number; to: number }

export type MontageOptions = {
  /** a track laid under the whole edit from second `start`, its first beat, so the cuts land on the beat */
  music?: { media: Media; start: number }
  /** level of the clips' own sound under the music */
  ambience?: number
  /** a transparent PNG at the size of the reel, shown between `from` and `to` */
  overlay?: { render: (width: number, height: number) => Promise<Buffer>; from: number; to: number }
}

/**
 * Hard cuts, each clip trimmed to its seconds `from`-`to`, at the size of the first clip; the same clip can be cut
 * several times. A clip without an audio track gets silence, and every cut gets a few milliseconds of audio fade so it
 * does not click.
 */
export async function montage(cuts: Cut[], opts: MontageOptions = {}): Promise<Media> {
  const paths = cuts.map((c) => mediaPath(c.media))
  const { width, height } = await size(paths[0])
  const audio = await Promise.all(paths.map(hasAudio))
  const fade = 0.04
  const total = cuts.reduce((t, c) => t + c.to - c.from, 0)
  const filters = cuts.flatMap((c, i) => {
    const [from, to, d] = [c.from.toFixed(2), c.to.toFixed(2), (c.to - c.from).toFixed(2)]
    const a = audio[i] ? `[${i}:a]atrim=${from}:${to},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo` : `aevalsrc=0:c=stereo:s=48000:d=${d}`
    return [
      `[${i}:v]trim=${from}:${to},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=30,setsar=1[v${i}]`,
      `${a},afade=t=in:d=${fade},afade=t=out:st=${(c.to - c.from - fade).toFixed(2)}:d=${fade}[a${i}]`,
    ]
  })
  const inputs = cuts.map((_, i) => `[v${i}][a${i}]`).join("")
  const graph = [...filters, `${inputs}concat=n=${cuts.length}:v=1:a=1[cv][ca]`]

  const extra: string[] = []
  const tmp: string[] = []
  let next = cuts.length
  if (opts.overlay) {
    const png = join(tmpdir(), `${newId("overlay")}.png`)
    await writeFile(png, await opts.overlay.render(width, height))
    tmp.push(png)
    extra.push("-i", png)
    graph.push(`[cv][${next++}:v]overlay=0:0:enable='between(t,${opts.overlay.from},${opts.overlay.to})'[v]`)
  } else {
    graph.push("[cv]null[v]")
  }
  if (opts.music) {
    extra.push("-i", mediaPath(opts.music.media))
    const start = opts.music.start
    graph.push(
      `[${next++}:a]atrim=${start.toFixed(3)}:${(start + total).toFixed(3)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=out:st=${Math.max(0, total - 0.6).toFixed(2)}:d=0.6[mus]`,
      `[ca]volume=${opts.ambience ?? 0.15}[amb]`,
      "[amb][mus]amix=inputs=2:duration=first:normalize=0[a]",
    )
  } else {
    graph.push("[ca]anull[a]")
  }

  const out = join(tmpdir(), `${newId("reel")}.mp4`)
  try {
    await run("ffmpeg", [
      "-y", "-loglevel", "error",
      ...paths.flatMap((p) => ["-i", p]),
      ...extra,
      "-filter_complex", graph.join(";"),
      "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
      out,
    ])
    return await saveBuffer(await readFile(out), ".mp4")
  } finally {
    await Promise.all([out, ...tmp].map((p) => rm(p, { force: true })))
  }
}

/** Crops a box with `pad` extra margin on each side (fraction of the box), upscaled so the short side is at least 768px. */
export async function crop(media: Media, box: Box, pad = 0.15): Promise<Media> {
  const src = mediaPath(media)
  const { width, height } = await size(src)
  const [y0, x0, y1, x1] = box.map((v) => Math.max(0, Math.min(1000, v)) / 1000)
  const padX = (x1 - x0) * pad
  const padY = (y1 - y0) * pad
  const left = Math.max(0, Math.floor((x0 - padX) * width))
  const top = Math.max(0, Math.floor((y0 - padY) * height))
  const w = Math.min(width - left, Math.ceil((x1 - x0 + 2 * padX) * width))
  const h = Math.min(height - top, Math.ceil((y1 - y0 + 2 * padY) * height))
  if (w < 8 || h < 8) throw new Error("ritaglio troppo piccolo")
  const out = join(tmpdir(), `${newId("crop")}.jpg`)
  const scale = w < h ? "scale=max(768\\,iw):-2" : "scale=-2:max(768\\,ih)"
  await run("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", `crop=${w}:${h}:${left}:${top},${scale}:flags=lanczos`, "-q:v", "2", out])
  const saved = await saveBuffer(await readFile(out), ".jpg")
  await rm(out, { force: true })
  return saved
}
