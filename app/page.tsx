/* eslint-disable @next/next/no-img-element */
import Link from "next/link"
import { STEPS } from "@/lib/steps"
import { listGarments } from "@/lib/workspace"
import { Icon, Topbar } from "./ui/kit"

export const dynamic = "force-dynamic"

export default async function Library() {
  const garments = await listGarments()
  return (
    <>
      <Topbar crumbs={[{ label: "Products" }]} />
      <main className="page">
        <div className="page-head home-head">
          <div>
            <h1 className="page-title">Products</h1>
            <Link href="/brand" className="home-brand-link">
              Brand DNA · the catalogue that defines it
              <Icon name="right" size={12} />
            </Link>
          </div>
        </div>
        <div className="library">
          <Link href="/new" className="g-new enter">
            <span className="plus">
              <Icon name="plus" size={16} />
            </span>
            <span style={{ fontWeight: 500 }}>New product</span>
          </Link>
          {garments.map((g, i) => {
            const done = g.steps.filter((s) => s.status === "done").length
            const next = STEPS.find((s) => g.steps.find((x) => x.id === s.id)?.status !== "done")
            return (
              <Link key={g.id} href={`/g/${g.id}?step=input`} className="g-card enter" style={{ "--d": `${(i + 1) * 50}ms` } as React.CSSProperties}>
                <div className="g-thumb">{g.thumb ? <img src={g.thumb} alt="" /> : <Icon name="image" size={28} />}</div>
                <div className="g-body">
                  <div className="g-name">{g.name}</div>
                  <div className="g-meta">
                    <span className="mono">{g.sku}</span>
                    <span>{g.line === "uomo" ? "Men" : "Women"}</span>
                    <span>{g.running ? `${g.running} running` : next ? `Next: ${next.label}` : "Complete"}</span>
                  </div>
                  <div className="pips" aria-label={`${done} of ${g.steps.length} steps done`}>
                    {g.steps.map((s) => (
                      <i key={s.id} data-s={s.status} />
                    ))}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </main>
    </>
  )
}