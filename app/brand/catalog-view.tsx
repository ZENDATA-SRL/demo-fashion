"use client"
/* eslint-disable @next/next/no-img-element */

import { useState } from "react"
import type { BrandCatalog } from "@/lib/brand-catalog"

const pct = (n: number) => `${Math.round(n * 100)}%`
const points = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n * 100))} pt`
const eur = (n: number) => `€ ${n.toLocaleString("en-GB")}`

const FAMILY = {
  leather: { title: "Leather goods", noun: "bags" },
  knit: { title: "Knitwear", noun: "knits" },
} as const

/** The catalogue grid and the DNA codes it adds up to; picking a code shows which products carry it. */
export function CatalogView({ b }: { b: BrandCatalog }) {
  const [code, setCode] = useState<string | null>(null)
  const label = (token: string) => b.codes.find((c) => c.tag.token === token)?.tag.label ?? token
  const picked = b.codes.find((c) => c.tag.token === code)
  const toggle = (token: string) => setCode((c) => (c === token ? null : token))

  return (
    <>
      <section className="brand-block">
        <header className="brand-block-head">
          <h2>The catalogue</h2>
          <p className="muted">The past launches the DNA is drawn from, oldest first. Pick a code to see which products carry it.</p>
        </header>
        <div className="catalog-filter" role="group" aria-label="Filter by code">
          <button className="catalog-chip" aria-pressed={!code} onClick={() => setCode(null)}>
            All <span className="num">{b.products.length}</span>
          </button>
          {b.codes.map((c) => (
            <button key={c.tag.token} className="catalog-chip" aria-pressed={code === c.tag.token} onClick={() => toggle(c.tag.token)}>
              {c.tag.label} <span className="num">{c.skus.length}</span>
            </button>
          ))}
        </div>
        {picked && (
          <p className="catalog-filter-note num">
            {picked.skus.length} of {picked.of} {FAMILY[picked.family].noun} · sell-through {pct(picked.sellThrough)},{" "}
            <span data-tone={picked.lift >= 0.02 ? "ok" : picked.lift <= -0.02 ? "bad" : undefined}>{points(picked.lift)}</span> versus the other {FAMILY[picked.family].noun}
          </p>
        )}
        <div className="catalog-grid">
          {b.products.map((p) => (
            <article key={p.sku} className="catalog-item card" data-dim={code ? !p.codes.includes(code) : undefined}>
              <div className="catalog-thumb">
                <img src={p.photo.src} alt={`${p.name}, ${p.material.toLowerCase()} ${p.colour.name.toLowerCase()}`} loading="lazy" />
                <span className="catalog-season mono">{p.season}</span>
              </div>
              <div className="catalog-body">
                <div className="catalog-title">
                  <span className="g-name">{p.name}</span>
                  <span className="mono muted">{p.sku}</span>
                </div>
                <p className="catalog-spec">
                  <span className="swatch" style={{ background: p.colour.hex }} aria-hidden />
                  {p.material} · {p.colour.name} · {p.hardware}
                </p>
                <div className="catalog-sales num">
                  <span>{eur(p.price)}</span>
                  <span className="catalog-st" data-tone={p.sellThrough >= b.sellThrough ? "ok" : "bad"} aria-label={`sell-through ${pct(p.sellThrough)}`}>
                    <i style={{ width: pct(p.sellThrough) }} />
                  </span>
                  <span>{pct(p.sellThrough)}</span>
                </div>
                <ul className="catalog-codes">
                  {p.codes.length ? (
                    p.codes.map((t) => (
                      <li key={t} data-on={t === code || undefined}>
                        {label(t)}
                      </li>
                    ))
                  ) : (
                    <li data-off>Off-code</li>
                  )}
                </ul>
                <p className="catalog-note muted">{p.note}</p>
                <a className="catalog-credit" href={p.photo.url} target="_blank" rel="noreferrer">
                  Photo {p.photo.credit} · {p.photo.license}
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="brand-block">
        <header className="brand-block-head">
          <h2>The DNA codes</h2>
          <p className="muted">
            How many products of the same family carry each code and how they sold against the others. These are the tokens of the LoRA{" "}
            <span className="mono">{b.lora.file}</span> · strength {b.lora.strength} on {b.lora.base}
            {b.extraLoras.map((l) => (
              <span key={l.file}>
                , plus <span className="mono">{l.file}</span> · strength {l.strength} for {l.family}
              </span>
            ))}
            , which the Design Brief uses to write the constraints.
          </p>
        </header>
        {(["leather", "knit"] as const).map((family) => {
          const codes = b.codes.filter((c) => c.family === family)
          if (!codes.length) return null
          return (
            <div key={family} className="dna-family">
              <h3 className="caps">{FAMILY[family].title}</h3>
              <ol className="dna-codes">
                {codes.map((c) => (
                  <li key={c.tag.token}>
                    <button className="dna-code card" aria-pressed={code === c.tag.token} onClick={() => toggle(c.tag.token)}>
                      <span className="dna-code-name">
                        <b>{c.tag.label}</b>
                        <span className="mono muted">{c.tag.token}</span>
                      </span>
                      <span className="dna-code-bar" aria-label={`${c.skus.length} of ${c.of} ${FAMILY[family].noun}`}>
                        <i style={{ width: pct(c.share) }} />
                      </span>
                      <span className="dna-code-figures num">
                        <span>
                          {c.skus.length}/{c.of} {FAMILY[family].noun}
                        </span>
                        <span data-tone={c.lift >= 0.02 ? "ok" : c.lift <= -0.02 ? "bad" : undefined}>
                          sell-through {pct(c.sellThrough)} · {points(c.lift)}
                        </span>
                      </span>
                      <span className="dna-code-note">{c.tag.loraNote}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )
        })}
      </section>
    </>
  )
}
