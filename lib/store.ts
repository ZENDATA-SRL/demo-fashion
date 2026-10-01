import { existsSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Db } from "./types"

export const DATA_DIR = join(process.cwd(), "data")
const DB_PATH = join(DATA_DIR, "db.json")

/**
 * Reserved garmentId of the shared model cast. The base bodies belong to no garment: they are generated once and
 * every garment reads them, so `getGarment` returns them next to the assets of the garment itself.
 */
export const CAST_ID = "cast"

const empty = (): Db => ({ garments: [], assets: [] })

export async function readDb(): Promise<Db> {
  if (!existsSync(DB_PATH)) return empty()
  return { ...empty(), ...(JSON.parse(await readFile(DB_PATH, "utf8")) as Partial<Db>) }
}

// Route handlers can be bundled separately in dev, so the write queue lives on globalThis.
const g = globalThis as { __dbQueue?: Promise<unknown> }

/** Serialised read-modify-write: generations run in parallel, only the final write is queued. */
export function updateDb<T>(fn: (db: Db) => T): Promise<T> {
  const run = (g.__dbQueue ?? Promise.resolve()).then(async () => {
    const db = await readDb()
    const result = fn(db)
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(`${DB_PATH}.tmp`, JSON.stringify(db, null, 2))
    await rename(`${DB_PATH}.tmp`, DB_PATH)
    return result
  })
  g.__dbQueue = run.catch(() => undefined)
  return run
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
