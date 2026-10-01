import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { attachView, createGarment, putDna } from "./garment"
import { importFile } from "./media"
import { readDb } from "./store"
import type { AssetKind, DnaField, Garment, GarmentDna, Source } from "./types"

/** Views a locked product can arrive with. The rest of the pipeline still generates whatever is missing. */
export const HANDOFF_VIEWS = ["ghost-front", "ghost-back", "ghost-side", "detail-button", "detail-fabric"] as const
export type HandoffView = (typeof HANDOFF_VIEWS)[number]

const FIELD_SOURCES: Source[] = ["sketch", "archive", "note", "invented"]

export type HandoffField = {
  key: string
  label: string
  value: string
  source: Exclude<Source, "measured">
  critical: boolean
}

/**
 * The product contract from upstream: identity, centimetres, and the views already locked.
 * Measurements are not read off a photo here. They arrive as a checked size.
 */
export type ProductHandoff = {
  sku: string
  name: string
  maison: string
  line?: "donna" | "uomo"
  style?: string
  brief: string
  goal?: string
  summary: string
  measurements: string
  trimSize?: string
  fields: HandoffField[]
  views?: Partial<Record<HandoffView, string>>
}

function need(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`handoff: manca ${label}`)
  return value.trim()
}

export function parseHandoff(raw: unknown): ProductHandoff {
  if (!raw || typeof raw !== "object") throw new Error("handoff: JSON non valido")
  const o = raw as Record<string, unknown>
  const line = o.line === "uomo" ? "uomo" : o.line === "donna" || o.line === undefined ? "donna" : null
  if (!line) throw new Error("handoff: line è donna o uomo")
  if (!Array.isArray(o.fields) || o.fields.length === 0) throw new Error("handoff: servono i campi del DNA")
  const fields: HandoffField[] = o.fields.map((item, i) => {
    if (!item || typeof item !== "object") throw new Error(`handoff: campo ${i + 1} non valido`)
    const f = item as Record<string, unknown>
    const source = f.source
    if (typeof source !== "string" || !FIELD_SOURCES.includes(source as Source) || source === "measured") {
      throw new Error(`handoff: fonte non valida su ${String(f.key ?? i + 1)}`)
    }
    return {
      key: need(f.key, `key del campo ${i + 1}`),
      label: need(f.label, `label di ${String(f.key)}`),
      value: need(f.value, `value di ${String(f.key)}`),
      source: source as HandoffField["source"],
      critical: f.critical === true,
    }
  })
  const keys = new Set(fields.map((f) => f.key))
  if (keys.size !== fields.length) throw new Error("handoff: chiavi DNA duplicate")
  for (const reserved of ["measurements", "trim_size"]) {
    if (keys.has(reserved)) throw new Error(`handoff: ${reserved} si scrive nel campo dedicato, non tra i fields`)
  }
  const views: ProductHandoff["views"] = {}
  if (o.views !== undefined) {
    if (!o.views || typeof o.views !== "object") throw new Error("handoff: views non valido")
    for (const [kind, path] of Object.entries(o.views as Record<string, unknown>)) {
      if (!HANDOFF_VIEWS.includes(kind as HandoffView)) throw new Error(`handoff: vista sconosciuta ${kind}`)
      views[kind as HandoffView] = need(path, kind)
    }
  }
  return {
    sku: need(o.sku, "sku"),
    name: need(o.name, "name"),
    maison: need(o.maison, "maison"),
    line,
    style: typeof o.style === "string" ? o.style.trim() : undefined,
    brief: need(o.brief, "brief"),
    goal: typeof o.goal === "string" && o.goal.trim() ? o.goal.trim() : undefined,
    summary: need(o.summary, "summary"),
    measurements: need(o.measurements, "measurements"),
    trimSize: typeof o.trimSize === "string" && o.trimSize.trim() ? o.trimSize.trim() : undefined,
    fields,
    views,
  }
}

/** DNA for the pipeline. Centimetres stay out of the critical list: QA checks them as scale, not as a button count. */
export function dnaFromHandoff(handoff: ProductHandoff, at = new Date().toISOString()): GarmentDna {
  const measured: DnaField[] = [
    {
      key: "measurements",
      label: "Misure",
      value: handoff.measurements,
      source: "measured",
      critical: false,
    },
    {
      key: "trim_size",
      label: "Misure minuteria",
      value: handoff.trimSize ?? "none",
      source: "measured",
      critical: false,
    },
  ]
  return {
    summary: handoff.summary,
    fields: [...handoff.fields, ...measured],
    model: "handoff",
    at,
  }
}

export async function importHandoff(file: string): Promise<Garment> {
  const path = resolve(file)
  const handoff = parseHandoff(JSON.parse(await readFile(path, "utf8")))
  const db = await readDb()
  if (db.garments.some((g) => g.sku === handoff.sku)) throw new Error(`SKU già presente: ${handoff.sku}`)

  const dir = dirname(path)
  const views = Object.entries(handoff.views ?? {}) as Array<[HandoffView, string]>
  for (const [kind, rel] of views) {
    const abs = isAbsolute(rel) ? rel : join(dir, rel)
    if (!existsSync(abs)) throw new Error(`handoff: file mancante per ${kind}: ${abs}`)
  }

  const garment = await createGarment({
    sku: handoff.sku,
    name: handoff.name,
    maison: handoff.maison,
    line: handoff.line,
    brief: handoff.brief,
    goal: handoff.goal ?? "pre-order sul sito + 6 UGC ads per testare 3 hook prima di produrre",
  })
  await putDna(garment.id, dnaFromHandoff(handoff))
  for (const [kind, rel] of views) {
    const abs = isAbsolute(rel) ? rel : join(dir, rel)
    await attachView(garment.id, kind as AssetKind, await importFile(abs))
  }
  return garment
}
