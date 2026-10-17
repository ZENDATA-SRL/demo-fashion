import catalog from "../data/brand-catalog.json"
import market from "../data/market.json"
import { brandProfile, type LoraTag } from "./brand-lora"
import type { ArchiveLaunch } from "./campaign-types"

/**
 * The brand's past catalogue and the DNA it adds up to. Products come from data/brand-catalog.json, prices and sales
 * from the launch archive in data/market.json (same SKUs). A code belongs to the DNA because the products carry it,
 * and the sell-through says how much it pays. All simulated.
 */

export type ProductFamily = "leather" | "knit"

export type CatalogProduct = {
  sku: string
  family: ProductFamily
  name: string
  season: string
  silhouette: string
  material: string
  colour: { name: string; hex: string }
  hardware: string
  /** LoRA tokens of the brand profile this product carries */
  codes: string[]
  note: string
  /** an unbranded stand-in photo and the credit its licence asks for */
  photo: { src: string; credit: string; license: string; url: string }
  price: number
  sellThrough: number
  produced: number
}

export type DnaCode = {
  tag: LoraTag
  /** the product family the code belongs to: a knit code is judged among the knitwear only */
  family: ProductFamily
  /** SKUs carrying the code */
  skus: string[]
  /** products of that family, the base of `share` */
  of: number
  share: number
  /** average sell-through of the products with the code, and its distance from those without */
  sellThrough: number
  lift: number
}

export type BrandCatalog = {
  brand: string
  manifesto: string
  lora: { file: string; strength: number; base: string }
  extraLoras: Array<{ family: string; file: string; strength: number }>
  products: CatalogProduct[]
  codes: DnaCode[]
  materials: Array<{ label: string; n: number }>
  sellThrough: number
}

const ARCHIVE = market.archive as ArchiveLaunch[]

const avg = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0)

export function brandCatalog(): BrandCatalog {
  const profile = brandProfile(catalog.loraProfile)
  const products: CatalogProduct[] = catalog.products.map((p) => {
    const launch = ARCHIVE.find((a) => a.sku === p.sku)
    if (!launch) throw new Error(`catalogue SKU without a launch in the archive: ${p.sku}`)
    return { ...p, family: p.family as ProductFamily, name: launch.name, price: launch.price, sellThrough: launch.outcome.sellThrough, produced: launch.outcome.produced }
  })

  const codes = profile.tags
    .map((tag): DnaCode => {
      // the family of the products that carry the code; a code nobody carries yet stays with the bags
      const family = products.find((p) => p.codes.includes(tag.token))?.family ?? "leather"
      const pool = products.filter((p) => p.family === family)
      const withIt = pool.filter((p) => p.codes.includes(tag.token))
      const without = pool.filter((p) => !p.codes.includes(tag.token))
      const sellThrough = avg(withIt.map((p) => p.sellThrough))
      return {
        tag,
        family,
        skus: withIt.map((p) => p.sku),
        of: pool.length,
        share: withIt.length / pool.length,
        sellThrough,
        lift: withIt.length && without.length ? sellThrough - avg(without.map((p) => p.sellThrough)) : 0,
      }
    })
    .sort((a, b) => (a.family === "leather" ? 0 : 1) - (b.family === "leather" ? 0 : 1) || b.share - a.share || b.lift - a.lift)

  const counts = new Map<string, number>()
  for (const p of products) counts.set(p.material, (counts.get(p.material) ?? 0) + 1)
  const materials = [...counts].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n)

  return {
    brand: catalog.brand,
    manifesto: catalog.manifesto,
    lora: profile.lora,
    extraLoras: profile.extraLoras ?? [],
    products,
    codes,
    materials,
    sellThrough: avg(products.map((p) => p.sellThrough)),
  }
}
