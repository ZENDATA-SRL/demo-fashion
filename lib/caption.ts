import type { UgcCaption } from "./prompts/ugc"

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** Greedy wrap on word boundaries; explicit newlines are kept. */
function wrap(text: string, perLine: number): string[] {
  return text.split("\n").flatMap((paragraph) => {
    const lines: string[] = []
    for (const word of paragraph.trim().split(/\s+/)) {
      const last = lines.at(-1)
      if (last !== undefined && (last + " " + word).length <= perLine) lines[lines.length - 1] = `${last} ${word}`
      else lines.push(word)
    }
    return lines
  })
}

/**
 * The on-screen text of a reel as a transparent PNG at the reel's size. The local ffmpeg has no drawtext, so the text
 * is drawn here and overlaid. "title" is the yellow serif of an OOTD opener, "caption" the white TikTok text box.
 */
export async function captionPng(text: string, style: UgcCaption["style"], width: number, height: number): Promise<Buffer> {
  const title = style === "title"
  const size = Math.round(width * (title ? 0.085 : 0.043))
  const lines = wrap(title ? text.toUpperCase() : text, title ? 14 : 34)
  const lineHeight = size * (title ? 1.05 : 1.3)
  const top = title ? height * 0.42 - (lines.length * lineHeight) / 2 + size : height * 0.14 + size
  const font = title
    ? `font-family="Didot, Bodoni 72, Georgia, serif" fill="#f3d34a" letter-spacing="${Math.round(size * 0.02)}"`
    : `font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="500" fill="#ffffff"`
  const tspans = lines.map((l, i) => `<tspan x="${width / 2}" y="${(top + i * lineHeight).toFixed(1)}">${escape(l)}</tspan>`).join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<defs><filter id="s" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="${Math.max(1, size * 0.04)}" stdDeviation="${Math.max(1, size * 0.06)}" flood-color="#000" flood-opacity="${title ? 0.35 : 0.55}"/></filter></defs>
<text text-anchor="middle" font-size="${size}" ${font} filter="url(#s)">${tspans}</text>
</svg>`
  // imported on use: a static import of this external package turns every Next route that reaches it into an async module
  const { default: sharp } = await import("sharp")
  return sharp(Buffer.from(svg)).png().toBuffer()
}
