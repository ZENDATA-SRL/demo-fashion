"use client"
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react"
import { creatorName, renderSlots, scoreTone, slotLabel } from "@/lib/steps"
import type { AssetView } from "@/lib/workspace-types"
import { Hint, Icon, Section, TapVideo, secs, usd, useLightbox } from "./kit"
import { MeshView } from "./mesh-view"
import { useWs } from "./workspace"

type Section = "viste" | "3d" | "indossato" | "studio" | "fotogrammi" | "video"
type Row = { key: string; section: Section; title: string; sub?: string; assets: AssetView[] }

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: "viste", label: "Concept & Packshot" },
  { id: "3d", label: "Digital Prototype" },
  { id: "indossato", label: "On-Model" },
  { id: "studio", label: "Editorial" },
  { id: "fotogrammi", label: "UGC Frames" },
  { id: "video", label: "UGC Clips" },
]

const SIZES = [
  { id: "s", label: "S", h: 220 },
  { id: "m", label: "M", h: 340 },
  { id: "l", label: "L", h: 520 },
] as const

const byModel = (a: AssetView, b: AssetView) => a.model.localeCompare(b.model, "en") || a.createdAt.localeCompare(b.createdAt, "en")

/** All generated candidates, one row per slot, side by side at the same height: the model choice is made by eye here. */
export function CompareView() {
  const { ws } = useWs()
  const light = useLightbox()
  const [sections, setSections] = useState<Set<Section>>(new Set(SECTIONS.map((s) => s.id)))
  const [hideRejected, setHideRejected] = useState(true)
  const [size, setSize] = useState<(typeof SIZES)[number]["id"]>("m")
  const height = SIZES.find((s) => s.id === size)!.h

  const generated = useMemo(() => ws.assets.filter((a) => a.modelId && (!hideRejected || a.status !== "rejected")), [ws.assets, hideRejected])

  const rows = useMemo(() => {
    const out: Row[] = []
    out.push({ key: "ghost-front", section: "viste", title: "Concept Visualization", assets: generated.filter((a) => a.kind === "ghost-front") })
    out.push({ key: "mesh", section: "3d", title: "Image-to-3D", sub: "Drag to rotate", assets: generated.filter((a) => a.kind === "mesh") })
    for (const s of renderSlots(ws.garment.shoot).filter((v) => v.kind !== "ghost-front"))
      out.push({ key: s.kind, section: "viste", title: slotLabel(ws.garment.shoot, s.kind), assets: generated.filter((a) => a.kind === s.kind) })
    out.push({ key: "on-model", section: "indossato", title: "On-Model", assets: generated.filter((a) => a.kind === "on-model") })
    for (const l of ws.looks) {
      out.push({ key: `lookbook:${l.id}`, section: "studio", title: l.label, sub: "Editorial", assets: generated.filter((a) => a.kind === "lookbook" && a.label === l.id) })
    }
    for (const kind of ["ugc-frame", "ugc-clip"] as const) {
      for (const p of ws.plan) {
        const format = ws.formats.find((f) => f.id === p.format)
        for (const shot of format?.shots ?? []) {
          out.push({
            key: `${kind}:${p.creator}:${p.format}:${shot.id}`,
            section: kind === "ugc-frame" ? "fotogrammi" : "video",
            title: `${format?.label ?? p.format} · ${shot.label}`,
            sub: creatorName(ws, p.creator),
            assets: generated.filter((a) => a.kind === kind && a.creator === p.creator && a.format === p.format && a.shot === shot.id),
          })
        }
      }
    }
    return out.filter((r) => sections.has(r.section) && r.assets.length).map((r) => ({ ...r, assets: [...r.assets].sort(byModel) }))
  }, [generated, ws, sections])

  const summary = useMemo(() => {
    const visible = rows.flatMap((r) => r.assets)
    const models = [...new Set(visible.map((a) => a.modelId))]
    return models
      .map((id) => {
        const mine = visible.filter((a) => a.modelId === id)
        const scored = mine.filter((a) => a.qa)
        return {
          id,
          label: mine[0].model,
          weights: mine[0].weights,
          count: mine.length,
          approved: mine.filter((a) => a.status === "approved").length,
          score: scored.length ? Math.round(scored.reduce((t, a) => t + a.qa!.score, 0) / scored.length) : undefined,
          seconds: Math.round(mine.reduce((t, a) => t + a.seconds, 0) / mine.length),
          usd: mine.some((a) => a.usd !== undefined) ? mine.reduce((t, a) => t + (a.usd ?? 0), 0) : undefined,
        }
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  }, [rows])

  const toggle = (id: Section) =>
    setSections((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <>
      <header className="step-head">
        <div className="step-title">
          <span className="caps">Compare</span>
          <h1>Models side by side</h1>
          <Hint>Every generated image and video, side by side by section. Each row is the same shot asked of different models.</Hint>
        </div>
      </header>

      <div className="compare-bar">
        <div className="seg" role="group" aria-label="Sections">
          {SECTIONS.map((s) => (
            <button key={s.id} aria-pressed={sections.has(s.id)} onClick={() => toggle(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="compare-check">
          <input type="checkbox" checked={hideRejected} onChange={(e) => setHideRejected(e.target.checked)} /> Hide discarded
        </label>
        <div className="seg" role="group" aria-label="Size">
          {SIZES.map((s) => (
            <button key={s.id} aria-pressed={size === s.id} onClick={() => setSize(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="fill scroll compare-scroll">
        {summary.length > 0 && (
          <div className="card compare-summary">
            <Section title="Summary by model" meta={`${summary.length} models`}>
              <table>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Generated</th>
                    <th>Approved</th>
                    <th>Avg QA</th>
                    <th>Avg time</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((m) => (
                    <tr key={m.id}>
                      <td>
                        {m.label} {m.weights === "open" && <span className="badge ok">open</span>}
                      </td>
                      <td className="num">{m.count}</td>
                      <td className="num">{m.approved}</td>
                      <td>
                        <span className="score" data-t={scoreTone(m.score)}>
                          {m.score ?? "—"}
                        </span>
                      </td>
                      <td className="num">{secs(m.seconds)}</td>
                      <td className="num">{usd(m.usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="empty">
            <h3>Nothing to compare</h3>
            <p>Concepts, 3D models, renders, on-model, studio and UGC shots show up here, side by side by model.</p>
          </div>
        ) : (
          rows.map((r) => (
            <section key={r.key} className="compare-row">
              <div className="compare-row-head">
                <h3>{r.title}</h3>
                {r.sub && <span className="muted">{r.sub}</span>}
                <span className="caps">{r.assets.length} candidates</span>
              </div>
              <div className="compare-strip" data-tall={r.section === "fotogrammi" || r.section === "video"} style={{ "--h": `${height}px` } as React.CSSProperties}>
                {r.assets.map((a) => (
                  <figure key={a.id} className="compare-item" data-status={a.status}>
                    {a.mesh ? (
                      <MeshView src={a.src} />
                    ) : a.video ? (
                      <TapVideo src={a.src} poster={a.poster} preload="none" />
                    ) : (
                      <button onClick={() => light({ src: a.src, alt: a.model })} aria-label={`Enlarge ${a.model}`}>
                        <img src={a.src} alt={a.model} loading="lazy" />
                      </button>
                    )}
                    <figcaption>
                      <b>{a.model}</b>
                      <span className="compare-tags">
                        {a.status === "approved" && (
                          <span className="badge ink">
                            <Icon name="check" size={10} /> Approved
                          </span>
                        )}
                        {a.status === "rejected" && <span className="badge">Discarded</span>}
                        <span className="score" data-t={scoreTone(a.qa?.score)}>
                          {a.qa?.score ?? "—"}
                        </span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  )
}
