import { existsSync, readFileSync } from "node:fs"
import { mkdir, rename, writeFile } from "node:fs/promises"
import { extname, join } from "node:path"
import { askJson } from "./generate"
import { IDENTITY_SYSTEM, identityPrompt } from "./prompts/identity"
import { evolusFile, evolusText } from "./providers/evolus"
import { DATA_DIR } from "./store"

/**
 * The brand characteristics read from the house's corporate identity document. Evolus reads the document (OCR
 * included) and summarises it, the text model turns the summary into fields, and the brand page and the
 * "Write with AI" rewrite of the DNA use them.
 */
export type BrandIdentity = {
  brand: string
  manifesto: string
  values: string[]
  tone: string
  palette: Array<{ name: string; hex: string }>
  materials: string[]
  signatures: string[]
  avoid: string[]
  source: { file: string; at: string; model: string }
}

const PATH = join(DATA_DIR, "brand-identity.json")

export const IDENTITY_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
}

export function readIdentity(): BrandIdentity | undefined {
  return existsSync(PATH) ? (JSON.parse(readFileSync(PATH, "utf8")) as BrandIdentity) : undefined
}

const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [])

export async function importIdentity(file: { data: Buffer; name: string }): Promise<BrandIdentity> {
  const ext = extname(file.name).toLowerCase()
  const mime = IDENTITY_TYPES[ext]
  if (!mime) throw new Error(`unsupported format: ${file.name}`)
  const options = { length: "long", style: "bullets" } as const
  // plain text goes as text; documents and scans go as files, which Evolus reads with OCR
  const summary = mime.startsWith("text/")
    ? await evolusText("summarize", file.data.toString("utf8"), options)
    : await evolusFile("summarize", { ...file, mime }, options)

  const { data, model } = await askJson<Omit<BrandIdentity, "source">>({
    system: IDENTITY_SYSTEM,
    prompt: identityPrompt(file.name, summary.output),
    temperature: 0.2,
  })
  const identity: BrandIdentity = {
    brand: data.brand?.trim() ?? "",
    manifesto: data.manifesto?.trim() ?? "",
    values: list(data.values),
    tone: data.tone?.trim() ?? "",
    palette: (Array.isArray(data.palette) ? data.palette : []).filter((c) => c?.name && /^#[0-9a-f]{6}$/i.test(c.hex ?? "")),
    materials: list(data.materials),
    signatures: list(data.signatures),
    avoid: list(data.avoid),
    source: { file: file.name, at: new Date().toISOString(), model: `Evolus summarize · ${model}` },
  }
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(`${PATH}.tmp`, JSON.stringify(identity, null, 2))
  await rename(`${PATH}.tmp`, PATH)
  return identity
}

/** The identity as a prompt block, for the generations that write in the brand's vocabulary. */
export function identityBlock(id: BrandIdentity): string {
  const line = (label: string, xs: string[]) => (xs.length ? `${label}: ${xs.join("; ")}\n` : "")
  return `BRAND IDENTITY (from ${id.source.file}):
${id.manifesto ? `Manifesto: ${id.manifesto}\n` : ""}${line("Materials", id.materials)}${line("Signatures", id.signatures)}${line(
    "Palette",
    id.palette.map((c) => `${c.name} ${c.hex}`),
  )}${line("Never", id.avoid)}`
}
