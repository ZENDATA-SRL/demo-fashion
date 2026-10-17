import { brandCatalog } from "@/lib/brand-catalog"
import { Topbar } from "../ui/kit"
import { CatalogView } from "./catalog-view"

export const dynamic = "force-dynamic"

const pct = (n: number) => `${Math.round(n * 100)}%`

/** The brand's past catalogue and the codes it adds up to: what every new product is generated against. */
export default function BrandPage() {
  const b = brandCatalog()
  const seasons = new Set(b.products.map((p) => p.season))
  const palette = [...new Map(b.products.map((p) => [p.colour.name, p.colour])).values()]

  return (
    <>
      <Topbar crumbs={[{ label: "Products", href: "/" }, { label: "Brand DNA" }]} />
      <main className="page brand-page">
        <div className="page-head">
          <div>
            <span className="caps">Brand DNA · archive catalogue</span>
            <h1 className="page-title">{b.brand}</h1>
            <p className="brand-lede">{b.manifesto}</p>
          </div>
          <dl className="brand-stats">
            <div>
              <dt className="caps">Products</dt>
              <dd className="num">{b.products.length}</dd>
            </div>
            <div>
              <dt className="caps">Seasons</dt>
              <dd className="num">{seasons.size}</dd>
            </div>
            <div>
              <dt className="caps">Average sell-through</dt>
              <dd className="num">{pct(b.sellThrough)}</dd>
            </div>
          </dl>
        </div>

        <CatalogView b={b} />

        <section className="brand-block">
          <header className="brand-block-head">
            <h2>Palette and materials</h2>
          </header>
          <ul className="brand-palette">
            {palette.map((c) => (
              <li key={c.name}>
                <span className="swatch" style={{ background: c.hex }} />
                <span>{c.name}</span>
                <span className="mono muted">{c.hex}</span>
              </li>
            ))}
          </ul>
          <ul className="brand-materials">
            {b.materials.map((m) => (
              <li key={m.label}>
                {m.label} <span className="mono muted">×{m.n}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  )
}
