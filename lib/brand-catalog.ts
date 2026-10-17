import catalog from "../data/brand-catalog.json"
import market from "../data/market.json"
import { brandProfile, type LoraTag } from "./brand-lora"
import type { ArchiveLaunch } from "./campaign-types"

/**
 * The brand's past catalogue and the DNA it adds up to. Products come from data/brand-catalog.json, prices and sales
 * from the launch archive in data/market.json (same SKUs). A code belongs to the DNA because the products carry it,
 * and the sell-through says how much it pays. All simulated.
 */

export type CatalogProduct = {
  sku: string
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
  /** SKUs carrying the code */
  skus: string[]
  share: number
  /** average sell-through of the products with the code, and its distance from those without */
  sellThrough: number
  lift: number
}

export type BrandCatalog = {
  brand: string
  manifesto: string
  lora: { file: string; strength: number; base: string }
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
    if (!launch) throw new Error(`SKU di catalogo senza lancio in archivio: ${p.sku}`)
    return { ...p, name: launch.name, price: launch.price, sellThrough: launch.outcome.sellThrough, produced: launch.outcome.produced }
  })

  const codes = profile.tags
    .map((tag) => {
      const withIt = products.filter((p) => p.codes.includes(tag.token))
      const without = products.filter((p) => !p.codes.includes(tag.token))
      const sellThrough = avg(withIt.map((p) => p.sellThrough))
      return {
        tag,
        skus: withIt.map((p) => p.sku),
        share: withIt.length / products.length,
        sellThrough,
        lift: withIt.length && without.length ? sellThrough - avg(without.map((p) => p.sellThrough)) : 0,
      }
    })
    .sort((a, b) => b.share - a.share || b.lift - a.lift)

  const counts = new Map<string, number>()
  for (const p of products) counts.set(p.material, (counts.get(p.material) ?? 0) + 1)
  const materials = [...counts].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n)

  return {
    brand: catalog.brand,
    manifesto: catalog.manifesto,
    lora: profile.lora,
    products,
    codes,
    materials,
    sellThrough: avg(products.map((p) => p.sellThrough)),
  }
}
