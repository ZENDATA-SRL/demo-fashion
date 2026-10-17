import { readDb } from "@/lib/store"
import { Topbar } from "../ui/kit"
import { NewGarment } from "../ui/new-garment"

export const dynamic = "force-dynamic"

/** The example inputs are the ones of the first garment in the library, so a live demo can restart from them. */
export default async function NewPage() {
  const db = await readDb()
  const first = db.garments[0]
  const input = (kind: string) => first && db.assets.filter((a) => a.garmentId === first.id && a.kind === kind && !a.refs.length).at(-1)?.media.file
  const fallback = (kind: string) => first && db.assets.filter((a) => a.garmentId === first.id && a.kind === kind).at(-1)?.media.file
  const example = first
    ? {
        archive: input("archive") ?? fallback("archive"),
        sketch: input("sketch") ?? fallback("sketch"),
        brief: "new FW26 take, double-face wool, toggle buttons, lacquer red",
        name: first.name,
        maison: first.maison,
      }
    : undefined
  return (
    <>
      <Topbar crumbs={[{ label: "Products", href: "/" }, { label: "New product" }]} />
      <NewGarment example={example} />
    </>
  )
}
