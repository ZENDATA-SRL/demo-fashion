"use client"
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react"
import { DEFAULT_MODELS, currentOf } from "@/lib/steps"
import type { AssetView } from "@/lib/workspace-types"
import { BrandDnaWriteButton } from "../brand-dna-dialog"
import { Icon, paceEstimate, remaining, useLightbox, useNow, usePopover } from "../kit"
import { JobBanner } from "../bench"
import { StepHead, useWs } from "../workspace"
import { DnaStep } from "./dna"

export function InputStep() {
  const { ws, act, states, patch } = useWs()
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
  const toConfirm = !!g.dna && !g.dnaConfirmed

  // the DNA lands while the sketch tab is open: the next thing to do is on the other tab
  useEffect(() => {
    if (toConfirm) setTab("vincoli")
  }, [toConfirm])

  return (
    <div className="col fill">
      <StepHead
        actions={
          !sketch && archive && !busy ? (
            <button className="btn primary" onClick={() => act({ type: "prepare" })}>
              <Icon name="spark" /> Create the product and read it
            </button>
          ) : toConfirm && tab === "bozzetto" && !busy ? (
            <button className="btn primary" onClick={() => setTab("vincoli")}>
              <Icon name="lock" /> Review and confirm the constraints
            </button>
          ) : undefined
        }
      />
      <JobBanner target="input" />
      {g.dna && pictured && (
        <div className="step-tabs-row">
          <div className="seg step-tabs step-tabs-icons" role="tablist" aria-label="Section">
            <button role="tab" aria-pressed={tab === "bozzetto"} onClick={() => setTab("bozzetto")} title="Sketch" aria-label="Sketch">
              <Icon name="pen" size={14} />
            </button>
            <button role="tab" aria-pressed={tab === "vincoli"} onClick={() => setTab("vincoli")} title={`Constraints (${critical})`} aria-label={`Constraints, ${critical} critical`}>
              <Icon name="lock" size={14} />
              {critical > 0 && <span className="mono tab-count">{critical}</span>}
            </button>
          </div>
          {tab === "vincoli" && <BrandDnaWriteButton disabled={dnaBusy} className="btn secondary sm" />}
          {tab === "vincoli" &&
            (toConfirm ? (
              <button className="btn primary sm" disabled={dnaBusy} onClick={() => patch({ confirmDna: true })}>
                <Icon name="check" /> Confirm the constraints
              </button>
            ) : (
              <span className="badge ok">
                <Icon name="check" size={10} /> Confirmed
              </span>
            ))}
        </div>
      )}
      {g.dna && (tab === "vincoli" || !pictured) ? (
        <DnaStep embedded />
      ) : (
      <div className="inputs fill" data-count={1}>
        {!sketch && !job && archive ? (
          <InputCard title="Archive photo" asset={archive} cover empty="" onOpen={light} />
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
          <button onClick={() => onOpen({ src: sketch.src, alt: "Sketch" })} aria-label="Enlarge sketch">
            <img src={sketch.src} alt="Sketch" />
          </button>
        ) : (
          <span className="muted" style={{ fontSize: 12.5, padding: 24, textAlign: "center", display: "grid", gap: 10, justifyItems: "center" }}>
            {busy ? <span className="spinner lg" /> : <Icon name="image" size={22} />}
            {busy ? "Drawing it…" : dna ? "The product arrived already defined. No sketch needed." : "No sketch."}
            {busy && wait && (
              <span className="mono" title="Estimate from the average of past generations">
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
                placeholder="What should change? e.g. remove the pockets"
                value={fix}
                onChange={(e) => setFix(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setFixing(false)}
                aria-label="What to change in the sketch"
                title="Only what you write changes. The rest of the drawing stays."
                disabled={busy || sending}
              />
              <button className="icon-btn bordered" disabled={!fix.trim() || busy || sending} type="submit" aria-label="Send correction">
                {sending ? <span className="spinner" style={{ width: 11, height: 11 }} /> : <Icon name="pen" size={13} />}
              </button>
              <button type="button" className="icon-btn" onClick={() => setFixing(false)} aria-label="Cancel">
                <Icon name="x" size={13} />
              </button>
            </form>
          ) : (
            <div className="input-bar stage-bar" ref={more.ref}>
              {busy ? (
                <span className="input-bar-status" aria-live="polite" title={correcting ? "Correcting" : "Reading"}>
                  <span className="spinner" style={{ width: 11, height: 11 }} />
                </span>
              ) : (
                <span
                  className="icon-btn input-bar-status"
                  title={sketch.modelId ? `Drawn by ${sketch.model}` : "Uploaded manually"}
                  aria-label={sketch.modelId ? `Drawn by ${sketch.model}` : "Uploaded manually"}
                >
                  <Icon name={sketch.modelId ? "spark" : "upload"} size={13} />
                </span>
              )}
              <button
                className="icon-btn bordered"
                aria-expanded={fixing}
                aria-label="Correct the sketch"
                onClick={() => setFixing(true)}
                disabled={busy}
              >
                <Icon name="pen" size={13} />
              </button>
              {(archive || versions > 1 || sketch.modelId) && (
                <span className="more">
                  <button className="icon-btn" aria-label="More actions" aria-expanded={more.open} onClick={() => more.setOpen((o) => !o)}>
                    <Icon name="more" size={14} />
                  </button>
                  {more.open && (
                    <>
                      <div className="more-scrim" onClick={() => more.setOpen(false)} />
                      <div className="more-menu card" onClick={(e) => (e.target as HTMLElement).closest("button") && more.setOpen(false)}>
                        {archive && (
                          <button type="button" onClick={() => onOpen({ src: archive.src, alt: "Archive photo" })}>
                            <Icon name="folder" size={12} /> Archive photo
                          </button>
                        )}
                        {sketch.modelId && <p className="input-menu-meta muted">{sketch.model}</p>}
                        {versions > 1 && (
                          <button type="button" onClick={discard} disabled={busy}>
                            <Icon name="trash" size={12} /> Discard version
                          </button>
                        )}
                        {dna && (
                          <p className="input-menu-note">After a correction, check the DNA again.</p>
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
          <button onClick={() => onOpen({ src: asset.src, alt: title })} aria-label={`Enlarge ${title}`}>
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
            <span className="icon-btn input-bar-status" title="Uploaded" aria-label="Uploaded">
              <Icon name="upload" size={13} />
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
