import { ensureShootPlan, getGarment } from "./garment"
import { UGC_PLAN, allCreators, shotLabel, ugcShot } from "./prompts/ugc"
import { updateDb } from "./store"
import type { Asset, AssetKind, Box, Zone } from "./types"
import { locate } from "./vision"

/** Stable key of a zone, shared with the UI: "Revers" → "revers". */
export const zoneKey = (zone: Pick<Zone, "label">) =>
  zone.label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

function targetsFor(role: HeroRole, kind: AssetKind, zones: Zone[]): Record<string, string> {
  const photo = Object.fromEntries(zones.map((z) => [zoneKey(z), z.target]))
  if (role === "sketch") {
    return {
      intero: "the whole FRONT view drawing of the garment (the one on the left), from top to hem",
      ...Object.fromEntries(zones.map((z) => [zoneKey(z), `${z.target}, in the FRONT view drawing (the garment on the left)`])),
    }
  }
  if (kind === "ugc-frame") return { intero: "the person from the top of her head down to the lower edge of the garment", ...photo }
  return photo
}

export type HeroRole = "sketch" | "front" | "worn"

function creatorOf(asset: Asset, all: Asset[]): string | undefined {
  const ids = [...asset.refs, ...asset.refs.flatMap((id) => all.find((a) => a.id === id)?.refs ?? [])]
  for (const id of ids) {
    const person = all.find((a) => a.id === id && a.kind === "person")
    if (person && allCreators().some((c) => c.id === person.label)) return person.label
  }
  return undefined
}

/** The three images of the consistency check: technical flat, site packshot, a phone frame (or the on-model photo). */
export function heroAssets(assets: Asset[]): Partial<Record<HeroRole, Asset>> {
  const approved = (kind: AssetKind) => assets.find((a) => a.kind === kind && a.status === "approved")
  const frames = assets.filter((a) => a.kind === "ugc-frame" && a.status === "approved" && ugcShot(a.label)?.shot.garment === "wears")
  const full = frames.filter((f) => f.label === shotLabel(UGC_PLAN[0].format, "on"))
  return {
    sketch: assets.filter((a) => a.kind === "sketch").at(-1),
    front: approved("ghost-front"),
    worn: full.find((f) => creatorOf(f, assets) === UGC_PLAN[0].creator) ?? full[0] ?? frames[0] ?? approved("on-model"),
  }
}

/** Named regions for the synchronised zoom, stored on each hero asset. Skips assets that already have them. */
export async function computeFocus(garmentId: string, force = false): Promise<number> {
  const { assets } = await getGarment(garmentId)
  const { zones } = await ensureShootPlan(garmentId)
  const jobs = Object.entries(heroAssets(assets)).filter((e): e is [HeroRole, Asset] => !!e[1] && (force || !e[1].focus))
  await Promise.all(
    jobs.map(async ([role, asset]) => {
      const targets = targetsFor(role, asset.kind, zones)
      const boxes = await locate(asset.media, Object.values(targets))
      const focus: Record<string, Box> = {}
      for (const [key, target] of Object.entries(targets)) if (boxes[target]) focus[key] = boxes[target]
      await updateDb((db) => {
        const a = db.assets.find((x) => x.id === asset.id)
        if (a) a.focus = focus
      })
    }),
  )
  return jobs.length
}
