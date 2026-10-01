"use client"
/* eslint-disable @next/next/no-img-element */

import { Fragment } from "react"
import { VIEW_SLOTS, approvedOf, running } from "@/lib/steps"
import { Icon, Section, useLightbox } from "../kit"
import { JobBanner } from "../bench"
import { StepHead, useWs } from "../workspace"
import { SOURCE_LABEL } from "./dna"

/** Policy numbers the copy must not invent stay as visible [PLACEHOLDER] tokens. */
function Tokens({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]{2,40}\])/g)
  return (
    <>
      {parts.map((p, i) =>
        /^\[.*\]$/.test(p) ? (
          <span className="ph-token" key={i}>
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}

export function TextsStep() {
  const { ws, act } = useWs()
  const light = useLightbox()
  const pdp = ws.garment.pdp
  const busy = running(ws, "pdp").length > 0
  const gallery = [...VIEW_SLOTS.map((s) => approvedOf(ws, s.kind)), approvedOf(ws, "on-model")].filter((a) => !!a)
  const toSign = pdp?.claims.filter((c) => c.needsSignOff) ?? []

  const head = <StepHead />

  if (!pdp) {
    return (
      <>
        {head}
        <JobBanner target="pdp" />
        {busy ? (
          <div className="card pdp fill">
            <div className="pdp-gallery scroll">
              {gallery.slice(0, 4).map((a) => (
                <img key={a.id} src={a.src} alt="" />
              ))}
            </div>
            <div className="pdp-info" style={{ display: "grid", gap: 12, alignContent: "start" }}>
              {[40, 90, 70, 100, 95, 60, 85].map((w, i) => (
                <span key={i} className="skeleton" style={{ height: i === 1 ? 26 : 12, width: `${w}%`, borderRadius: 4 }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="empty">
            <button className="btn primary" onClick={() => act({ type: "pdp" })}>
              <Icon name="pen" /> Scrivi la pagina prodotto
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {head}
      <JobBanner target="pdp" />
      <div className="card pdp fill">
        <div className="pdp-gallery scroll">
          {gallery.map((a) => (
            <button key={a.id} onClick={() => light({ src: a.src, alt: a.label ?? a.kind })} style={{ cursor: "zoom-in" }}>
              <img src={a.src} alt={a.label ?? a.kind} />
            </button>
          ))}
        </div>
        <div className="pdp-info scroll">
          <span className="caps">{ws.garment.maison}</span>
          <h2 className="pdp-title">{pdp.title}</h2>
          <p className="pdp-sub">{pdp.subtitle}</p>
          <p className="pdp-desc">
            <Tokens text={pdp.description} />
          </p>
          <div className="secs pdp-secs">
            <Section title="Dettagli" meta={pdp.details.length}>
              <ul>
                {pdp.details.map((d) => (
                  <li key={d}>
                    <Tokens text={d} />
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Vestibilità">
              <Tokens text={pdp.fit} />
            </Section>
            <Section title="Composizione e cura">
              <Tokens text={pdp.composition} />
              <ul style={{ marginTop: 6 }}>
                {pdp.care.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Section>
            <Section title="Pre-ordine">
              <Tokens text={pdp.preorder} />
            </Section>
            <Section title="Domande" meta={pdp.faq.length}>
              {pdp.faq.map((f) => (
                <p key={f.q} style={{ marginBottom: 8 }}>
                  <b style={{ fontWeight: 500, color: "var(--ink)" }}>{f.q}</b>
                  <br />
                  <Tokens text={f.a} />
                </p>
              ))}
            </Section>
            {toSign.length > 0 && (
              <Section title="Affermazioni da firmare" meta={`${toSign.length} su ${pdp.claims.length}`}>
                {toSign.map((c) => (
                  <div className="claim" key={c.text}>
                    <span>{c.text}</span>
                    <span className="src" data-s={c.source}>
                      {SOURCE_LABEL[c.source]}
                    </span>
                  </div>
                ))}
              </Section>
            )}
          </div>
          {!busy && (
            <button className="link-btn" onClick={() => act({ type: "pdp" })}>
              Riscrivi
            </button>
          )}
        </div>
      </div>
    </>
  )
}
