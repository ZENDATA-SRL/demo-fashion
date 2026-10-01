"use client"
/* eslint-disable @next/next/no-img-element */

import { useState } from "react"
import { DEFAULT_MODELS, currentOf } from "@/lib/steps"
import type { AssetView } from "@/lib/workspace-types"
import { BrandDnaWriteButton } from "../brand-dna-dialog"
import { Icon, paceEstimate, remaining, useLightbox, useNow, usePopover } from "../kit"
import { JobBanner } from "../bench"
import { StepHead, useWs } from "../workspace"
import { DnaStep } from "./dna"

export function InputStep() {
  const { ws, act, states } = useWs()
  const light = useLightbox()
  const archive = ws.assets.filter((a) => a.kind === "archive").at(-1)
  const sketches = ws.assets.filter((a) => a.kind === "sketch" && a.status !== "rejected")
  const sketch = currentOf(ws.assets, "sketch")
  const job = ws.jobs.find((j) => j.target === "input" && j.status === "running")
  const busy = states[0].status === "running" && !!job
  const g = ws.garment
  const [tab, setTab] = useState<"bozzetto" | "vincoli">(g.dna && !g.dnaConfirmed ? "vincoli" : "bozzetto")
  const critical = g.dna?.fields.filter((f) => f.critical).length ?? 0
  const pictured = !!(sketch || archive || job)
  const dnaBusy = ws.jobs.some((j) => j.status === "running" && (j.target === "dna" || j.type === "brand-dna"))

  return (
    <div className="col fill">
      <StepHead
        actions={
          !sketch && archive && !busy ? (
            <button className="btn primary" onClick={() => act({ type: "prepare" })}>
              <Icon name="spark" /> Crea il prodotto e leggilo
            </button>
          ) : undefined
        }
      />
      <JobBanner target="input" />
      {g.dna && pictured && (
        <div className="step-tabs-row">
          <div className="seg step-tabs step-tabs-icons" role="tablist" aria-label="Sezione">
            <button role="tab" aria-pressed={tab === "bozzetto"} onClick={() => setTab("bozzetto")} title="Bozzetto" aria-label="Bozzetto">
              <Icon name="pen" size={14} />
            </button>
            <button role="tab" aria-pressed={tab === "vincoli"} onClick={() => setTab("vincoli")} title={`Vincoli (${critical})`} aria-label={`Vincoli, ${critical} critici`}>
              <Icon name="lock" size={14} />
              {critical > 0 && <span className="mono tab-count">{critical}</span>}
            </button>
          </div>
          {tab === "vincoli" && <BrandDnaWriteButton disabled={dnaBusy} className="btn secondary sm" />}
        </div>
      )}
      {g.dna && (tab === "vincoli" || !pictured) ? (
        <DnaStep embedded />
      ) : (
      <div className="inputs fill" data-count={1}>
        {!sketch && !job && archive ? (
          <InputCard title="Foto d'archivio" asset={archive} cover empty="" onOpen={light} />
        ) : (
          <FlatCard sketch={sketch} archive={archive} versions={sketches.length} busy={!!job} correcting={job?.type === "refine"} phase={job?.phase} wait={job ? (job.since ?? job.startedAt) : undefined} dna={!!g.dna} onOpen={light} />
        )}
      </div>
      )}
    </div>
  )
}

function FlatCard({
  sketch,
  archive,
  versions,
  busy,
  correcting,
  phase,
  wait,
  dna,
  onOpen,
}: {
  sketch?: AssetView
  archive?: AssetView
  versions: number
  busy: boolean
  correcting: boolean
  phase?: string
  wait?: string
  dna: boolean
  onOpen: (l: { src: string; alt: string }) => void
}) {
  const { ws, act, setStatus } = useWs()
  const now = useNow(busy && !sketch)
  const [fixing, setFixing] = useState(false)
  const [fix, setFix] = useState("")
  const [sending, setSending] = useState(false)
  const more = usePopover()

  const correct = async () => {
    if (!sketch || !fix.trim()) return
    setSending(true)
    await act({ type: "refine", assetId: sketch.id, instruction: fix.trim(), models: DEFAULT_MODELS.refine! })
    setFix("")
    setSending(false)
    setFixing(false)
  }

  const discard = async () => {
    if (!sketch) return
    await setStatus(sketch.id, "rejected")
    if (dna) await act({ type: "dna" })
  }

  return (
    <div className="card input-card">
      <div className={`media ${busy && !sketch ? "skeleton" : ""}`}>
        {sketch ? (
          <button onClick={() => onOpen({ src: sketch.src, alt: "Bozzetto" })} aria-label="Ingrandisci Bozzetto">
            <img src={sketch.src} alt="Bozzetto" />
          </button>
        ) : (
          <span className="muted" style={{ fontSize: 12.5, padding: 24, textAlign: "center", display: "grid", gap: 10, justifyItems: "center" }}>
            {busy ? <span className="spinner lg" /> : <Icon name="image" size={22} />}
            {busy ? "Lo sto disegnando…" : dna ? "Il prodotto è arrivato già definito. Il bozzetto non serve." : "Nessun bozzetto."}
            {busy && wait && (
              <span className="mono" title="Stima dalla media delle generazioni già fatte">
                {remaining(wait, now, paceEstimate(ws.pace, "sketch"))}
              </span>
            )}
          </span>
        )}
      </div>
      {sketch && (
        <div className="input-foot">
          {correcting && phase && <p className="input-edit-note">{phase}</p>}
          {fixing ? (
            <form
              className="input-fix stage-fix"
              onSubmit={(e) => {
                e.preventDefault()
                correct()
              }}
            >
              <input
                autoFocus
                className="field-input"
                placeholder="Cosa cambiare? es. togli le tasche"
                value={fix}
                onChange={(e) => setFix(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setFixing(false)}
                aria-label="Cosa cambiare nel bozzetto"
                title="Cambia solo quello che scrivi. Il resto del disegno resta."
                disabled={busy || sending}
              />
              <button className="icon-btn bordered" disabled={!fix.trim() || busy || sending} type="submit" aria-label="Invia correzione">
                {sending ? <span className="spinner" style={{ width: 11, height: 11 }} /> : <Icon name="pen" size={13} />}
              </button>
              <button type="button" className="icon-btn" onClick={() => setFixing(false)} aria-label="Annulla">
                <Icon name="x" size={13} />
              </button>
            </form>
          ) : (
            <div className="input-bar stage-bar" ref={more.ref}>
              {busy ? (
                <span className="input-bar-status" aria-live="polite" title={correcting ? "Correzione in corso" : "Lettura in corso"}>
                  <span className="spinner" style={{ width: 11, height: 11 }} />
                </span>
              ) : (
                <span
                  className="icon-btn input-bar-status"
                  title={sketch.modelId ? `Disegnato da ${sketch.model}` : "Caricato manualmente"}
                  aria-label={sketch.modelId ? `Disegnato da ${sketch.model}` : "Caricato manualmente"}
                >
                  <Icon name={sketch.modelId ? "spark" : "upload"} size={13} />
                </span>
              )}
              <button
                className="icon-btn bordered"
                aria-expanded={fixing}
                aria-label="Correggi il bozzetto"
                onClick={() => setFixing(true)}
                disabled={busy}
              >
                <Icon name="pen" size={13} />
              </button>
              {(archive || versions > 1 || sketch.modelId) && (
                <span className="more">
                  <button className="icon-btn" aria-label="Altre azioni" aria-expanded={more.open} onClick={() => more.setOpen((o) => !o)}>
                    <Icon name="more" size={14} />
                  </button>
                  {more.open && (
                    <>
                      <div className="more-scrim" onClick={() => more.setOpen(false)} />
                      <div className="more-menu card" onClick={(e) => (e.target as HTMLElement).closest("button") && more.setOpen(false)}>
                        {archive && (
                          <button type="button" onClick={() => onOpen({ src: archive.src, alt: "Foto d'archivio" })}>
                            <Icon name="folder" size={12} /> Foto d&apos;archivio
                          </button>
                        )}
                        {sketch.modelId && <p className="input-menu-meta muted">{sketch.model}</p>}
                        {versions > 1 && (
                          <button type="button" onClick={discard} disabled={busy}>
                            <Icon name="trash" size={12} /> Scarta versione
                          </button>
                        )}
                        {dna && (
                          <p className="input-menu-note">Dopo una correzione il DNA va ricontrollato.</p>
                        )}
                      </div>
                    </>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InputCard({
  title,
  asset,
  empty,
  cover,
  onOpen,
}: {
  title: string
  asset?: { src: string }
  empty: string
  cover?: boolean
  onOpen: (l: { src: string; alt: string }) => void
}) {
  return (
    <div className="card input-card">
      <div className="media" data-fit={cover ? "cover" : undefined}>
        {asset ? (
          <button onClick={() => onOpen({ src: asset.src, alt: title })} aria-label={`Ingrandisci ${title}`}>
            <img src={asset.src} alt={title} />
          </button>
        ) : (
          <span className="muted" style={{ fontSize: 12.5, padding: 24, textAlign: "center", display: "grid", gap: 10, justifyItems: "center" }}>
            <Icon name="image" size={22} />
            {empty}
          </span>
        )}
      </div>
      {asset && (
        <div className="input-foot">
          <div className="input-bar stage-bar">
            <span className="icon-btn input-bar-status" title="Caricato" aria-label="Caricato">
              <Icon name="upload" size={13} />
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
