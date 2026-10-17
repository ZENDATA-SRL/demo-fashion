"use client"
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { approvedOf, currentOf, running } from "@/lib/steps"
import type { AssetView, Box, Workspace } from "@/lib/workspace-types"
import { Icon, Section, useLightbox } from "../kit"
import { JobBanner } from "../bench"
import { StepHead, useWs } from "../workspace"

/** "intero" first, then the zones of the garment's shoot plan. */
const zoomsOf = (ws: Workspace) => [{ key: "intero", label: "Full" }, ...ws.zones]
type ZoomKey = string

/** Context kept around each region, relative to the region's size; tuned for the demo coat, the rest gets the default. */
const PAD: Record<string, number> = { intero: 1.06, bottone: 4.4, revers: 1.35, polsino: 2.2 }
const padOf = (key: ZoomKey) => PAD[key] ?? 2

type Role = "sketch" | "front" | "worn"
type Hero = { role: Role; asset: AssetView; caption: string }
type Size = { w: number; h: number }

function heroes(ws: Workspace): Hero[] {
  const wears = (a: AssetView) => ws.formats.find((f) => f.id === a.format)?.shots.find((s) => s.id === a.shot)?.garment === "wears"
  const frames = ws.assets.filter((a) => a.kind === "ugc-frame" && a.status === "approved" && wears(a))
  const full = frames.filter((f) => f.format === ws.plan[0]?.format && f.shot === "on")
  const worn = full.find((f) => f.creator === ws.plan[0]?.creator) ?? full[0] ?? frames[0] ?? approvedOf(ws, "on-model")
  const sketch = currentOf(ws.assets, "sketch")
  const front = approvedOf(ws, "ghost-front")
  return [
    sketch && { role: "sketch" as const, asset: sketch, caption: "Technical flat" },
    front && { role: "front" as const, asset: front, caption: "Site packshot" },
    worn && { role: "worn" as const, asset: worn, caption: worn.kind === "ugc-frame" ? "UGC Frame" : "On-Model" },
  ].filter((h): h is Hero => !!h)
}

function transformFor(box: Box | undefined, key: ZoomKey, img: Size, frame: Size) {
  const { w, h } = img
  const { w: W, h: H } = frame
  if (!box) {
    const s = Math.max(W / w, H / h)
    return { s, tx: (W - s * w) / 2, ty: (H - s * h) / 2 }
  }
  const [y0, x0, y1, x1] = box.map((v) => v / 1000)
  const cx = ((x0 + x1) / 2) * w
  const cy = ((y0 + y1) / 2) * h
  const min = key === "intero" ? 0 : 0.14 * Math.min(w, h)
  let bw = Math.max((x1 - x0) * w * padOf(key), min)
  let bh = Math.max((y1 - y0) * h * padOf(key), min)
  if (bw / bh > W / H) bh = (bw * H) / W
  else bw = (bh * W) / H
  const s = Math.min(W / bw, H / bh)
  const clamp = (t: number, size: number, frameSize: number) => (size * s <= frameSize ? (frameSize - size * s) / 2 : Math.min(0, Math.max(frameSize - size * s, t)))
  return { s, tx: clamp(W / 2 - s * cx, w, W), ty: clamp(H / 2 - s * cy, h, H) }
}

function ZoomPanel({ hero, zoom, onNext }: { hero: Hero; zoom: ZoomKey; onNext: () => void }) {
  const frameRef = useRef<HTMLButtonElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [frame, setFrame] = useState<Size | null>(null)
  const [img, setImg] = useState<Size | null>(null)

  useLayoutEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setFrame({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onLoad = useCallback(() => {
    const el = imgRef.current
    if (el?.naturalWidth) setImg({ w: el.naturalWidth, h: el.naturalHeight })
  }, [])
  useEffect(() => {
    if (imgRef.current?.complete) onLoad()
  }, [onLoad])

  const t = img && frame ? transformFor(hero.asset.focus?.[zoom], zoom, img, frame) : null
  return (
    <figure>
      <button ref={frameRef} className="zoom" data-role={hero.role} data-ready={!!t} onClick={onNext} aria-label={`${hero.caption}: next detail`}>
        <img
          ref={imgRef}
          src={hero.asset.src}
          alt={hero.caption}
          onLoad={onLoad}
          draggable={false}
          style={t && img ? { width: img.w, height: img.h, transform: `translate3d(${t.tx}px, ${t.ty}px, 0) scale(${t.s})` } : undefined}
        />
      </button>
      <figcaption>{hero.caption}</figcaption>
    </figure>
  )
}

type Item = { id: string; label: string; note?: string }

function checklist(ws: Workspace): Array<{ title: string; items: Item[] }> {
  const dna = ws.garment.dna?.fields.filter((f) => f.source === "invented") ?? []
  const claims = ws.garment.pdp?.claims.filter((c) => c.needsSignOff) ?? []
  const videos = ws.assets.filter((a) => a.kind === "ugc-video" && a.status === "approved").length
  return [
    {
      title: "Details inferred by the system",
      items: dna.map((f) => ({ id: `dna:${f.key}`, label: `${f.label}: ${f.value}`, note: "Not from the sketch, archive or note" })),
    },
    {
      title: "Claims on the page",
      items: claims.map((c, i) => ({ id: `claim:${i}`, label: c.text })),
    },
    {
      title: "Publishing",
      items: [
        { id: "pub:watermark", label: "Internal watermark on every image", note: "Removed only after the physical sample is approved" },
        { id: "pub:disclosure", label: `“Virtual creator” label on ${videos === 1 ? "1 video" : `${videos || "all"} videos`}`, note: "Required on every ad" },
        { id: "pub:faces", label: "No real faces, no third-party brands" },
        { id: "pub:placeholders", label: "[ ] placeholders to fill in the CMS", note: "Shipping date, return days" },
      ],
    },
  ].filter((g) => g.items.length)
}

export function PublishStep() {
  const { ws, act, patch } = useWs()
  const light = useLightbox()
  const hero = useMemo(() => heroes(ws), [ws])
  const zooms = useMemo(() => zoomsOf(ws), [ws])
  const [zoom, setZoom] = useState<ZoomKey>("intero")
  const groups = useMemo(() => checklist(ws), [ws])
  const all = groups.flatMap((g) => g.items.map((i) => i.id))
  const signed = ws.garment.signoff
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(signed?.items ?? []))
  const exporting = running(ws, "export").length > 0
  const focusing = running(ws, "focus").length > 0

  const next = useCallback((by = 1) => setZoom((z) => zooms[(zooms.findIndex((x) => x.key === z) + by + zooms.length) % zooms.length].key), [zooms])

  const toggle = (id: string) =>
    setTicked((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const files = ws.exportFiles
  const dirs = [...new Set(files.map((f) => (f.includes("/") ? f.split("/")[0] : "")))]

  return (
    <>
      <StepHead />
      <div className="pub fill" data-hero={hero.length >= 2}>
        {hero.length >= 2 && (
          <section className="card pub-card pub-hero">
            <header>
              <h3>Same product, three contexts</h3>
              {focusing && (
                <span className="badge">
                  <span className="spinner" style={{ width: 10, height: 10 }} /> Locating the details
                </span>
              )}
            </header>
            <div className="seg" role="group" aria-label="Detail" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
              {zooms.map((z) => (
                <button key={z.key} aria-pressed={zoom === z.key} onClick={() => setZoom(z.key)}>
                  {z.label}
                </button>
              ))}
            </div>
            <div className="triptych">
              {hero.map((h) => (
                <ZoomPanel key={h.role} hero={h} zoom={zoom} onNext={() => next(1)} />
              ))}
            </div>
          </section>
        )}

        <div className="pub-side">
          <section className="card pub-card pub-sign">
            <header>
              <h3>To check</h3>
            </header>
            <div className="sign-list scroll">
              {groups.map((g) => (
                <div className="sign-group" key={g.title}>
                  <span className="caps">{g.title}</span>
                  {g.items.map((it) => (
                    <button
                      key={it.id}
                      className="tick"
                      role="checkbox"
                      aria-checked={!!signed || ticked.has(it.id)}
                      onClick={() => !signed && toggle(it.id)}
                      disabled={!!signed}
                      title={it.note}
                    >
                      <span className="box">
                        <Icon name="check" size={11} />
                      </span>
                      <span>{it.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <footer className="pub-foot">
              {signed ? (
                <>
                  <span className="muted">Signed · {new Date(signed.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                  <button className="link-btn" onClick={() => patch({ signoff: null })}>
                    Withdraw
                  </button>
                </>
              ) : (
                <button className="btn primary" style={{ marginInline: "auto" }} onClick={() => patch({ signoff: { by: "creative director", items: all } })}>
                  <Icon name="pen" size={12} /> Checked, I sign off
                </button>
              )}
            </footer>
          </section>

          {signed && (
          <section className="card pub-card pub-export">
            <header>
              <h3>CMS package</h3>
              <button className={`btn sm ${ws.garment.exportedAt ? "secondary" : "primary"}`} disabled={!signed || exporting} onClick={() => act({ type: "export" })}>
                {exporting ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="folder" size={12} />}
                {ws.garment.exportedAt ? "Export again" : "Export"}
              </button>
            </header>
            <JobBanner target="export" />
            {files.length > 0 && (
              <Section title="Package files" meta={files.length}>
                <ul className="files scroll">
                  {dirs.map((d) => (
                    <FileGroup key={d || "root"} dir={d} files={files.filter((f) => (d ? f.startsWith(`${d}/`) : !f.includes("/")))} sku={ws.garment.sku} onOpen={light} />
                  ))}
                </ul>
              </Section>
            )}
          </section>
          )}
        </div>
      </div>
    </>
  )
}

function FileGroup({ dir, files, sku, onOpen }: { dir: string; files: string[]; sku: string; onOpen: (l: { src: string; video?: boolean; disclosure?: boolean; alt: string }) => void }) {
  return (
    <>
      <li className="file dir">
        <Icon name="folder" />
        <span className="mono">{sku}/{dir}</span>
        <span>{files.length} {files.length === 1 ? "file" : "files"}</span>
      </li>
      {files.map((f) => {
        const url = `/api/export/${sku}/${f}`
        const name = f.split("/").pop()!
        const media = /\.(jpe?g|png|webp)$/i.test(f) ? "image" : /\.mp4$/i.test(f) ? "video" : null
        return (
          <li className="file" key={f}>
            <Icon name={media === "video" ? "video" : media === "image" ? "image" : "file"} />
            {media ? (
              <button className="mono link" style={{ textAlign: "left" }} onClick={() => onOpen({ src: url, video: media === "video", disclosure: media === "video", alt: name })}>
                {name}
              </button>
            ) : (
              <a className="mono link" href={url} target="_blank" rel="noreferrer">
                {name}
              </a>
            )}
            <a className="icon-btn" href={`${url}?download`} aria-label={`Download ${name}`}>
              <Icon name="download" size={12} />
            </a>
          </li>
        )
      })}
    </>
  )
}
