"use client"
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { DEFAULT_MODELS, creatorName, scoreTone } from "@/lib/steps"
import type { AssetView, JobView } from "@/lib/workspace-types"
import { Icon, Section, TapVideo, paceEstimate, remaining, secs, usd, useLightbox, useNow } from "./kit"
import { MeshView, type MeshSize } from "./mesh-view"
import { useWs } from "./workspace"

const REFINABLE = new Set(["ghost-front", "ghost-back", "ghost-side", "detail-button", "detail-fabric", "on-model", "lookbook", "ugc-frame"])
const QA_ABLE = new Set(["ghost-front", "on-model", "lookbook", "ugc-frame"])

function isTyping(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
}

/** The asset kind a running job is producing, so its countdown uses that kind's history. */
function phaseKind(target: string, job: JobView, jobKind?: JobView["type"][]): string {
  const layer = jobKind?.find((k) => k === "ugc-frame" || k === "ugc-clip" || k === "ugc-reel")
  if (job.type === "ugc-frame" || (job.type === "ugc-auto" && layer === "ugc-frame") || (job.type === "refine" && layer === "ugc-frame")) return "ugc-frame"
  if (job.type === "ugc-clip" || (job.type === "ugc-auto" && layer === "ugc-clip") || (job.type === "refine" && layer === "ugc-clip")) return "ugc-clip"
  if (job.type === "ugc-reel" || (job.type === "ugc-auto" && layer === "ugc-reel") || (job.type === "refine" && layer === "ugc-reel")) return "ugc-video"
  if (job.type === "studio" || target.startsWith("studio:")) return "lookbook"
  if (target === "on-model" || job.type === "onmodel" || job.type === "onmodel-all") return "on-model"
  if (job.type === "canon") return job.target
  if (job.type === "canon-all") return target
  if (job.type === "prepare" || target === "input") return "sketch"
  return target
}

const covers = (j: JobView, target: string, slot?: string) =>
  (j.target === target || !!j.slots?.includes(target)) && (!slot || !j.slots || j.slots.includes(slot))

/** The outcome of the last job of a slot if it failed; running jobs are shown on the stage. */
export function JobBanner({ target, slot }: { target: string; slot?: string }) {
  const { ws } = useWs()
  const jobs = ws.jobs.filter((j) => covers(j, target, slot))
  const last = jobs.at(-1)
  if (last && last.status !== "running" && (last.status === "error" || last.errors.length)) {
    return (
      <div className="banner error banners">
        <Icon name="alert" />
        <div className="grow">
          <b>{last.label}: non riuscito</b>
          {last.error ? ` · ${last.error}` : ""}
        </div>
      </div>
    )
  }
  return null
}

/** Approved first, then the best scored, then the newest: the first one is what the stage shows. */
function order(assets: AssetView[]) {
  const live = assets.filter((a) => a.status !== "rejected")
  const rank = (a: AssetView) => (a.status === "approved" ? 0 : 1)
  return [...live].sort((a, b) => rank(a) - rank(b) || (b.qa?.score ?? 101) - (a.qa?.score ?? 101) || b.createdAt.localeCompare(a.createdAt))
}

function pendingOf(jobs: JobView[], assets: AssetView[]) {
  return jobs
    .filter((j) => j.status === "running")
    .flatMap((j) => j.models.filter((m) => !assets.some((a) => a.modelId === m && a.createdAt >= j.startedAt)).map((m) => ({ job: j, modelId: m })))
}

/** One result per step on a central stage. Earlier versions are a pager away; the details are a drawer away. */
export function Bench({
  target,
  assets,
  tall,
  toolbar,
  empty: emptyState,
  jobKind,
  slot,
  onMeshSize,
  noApprove,
}: {
  target: string
  assets: AssetView[]
  tall?: boolean
  /** the step's own actions (a new version, a variant); shown in the stage bar */
  toolbar: ReactNode
  empty: ReactNode
  /** only jobs of these types feed this bench (the video stage shares its target with the frame stage) */
  jobKind?: JobView["type"][]
  /** when a job names who it is filling, this bench only follows the ones that include it */
  slot?: string
  /** the bounding box of the 3D model on stage, once loaded */
  onMeshSize?: (size: MeshSize) => void
  /** mesh step: no approve chip, tools only */
  noApprove?: boolean
}) {
  const { ws, setStatus } = useWs()
  const jobs = ws.jobs.filter((j) => covers(j, target, slot) && (!jobKind || jobKind.includes(j.type)))
  const pending = pendingOf(jobs, assets)
  const sorted = useMemo(() => order(assets), [assets])
  const [selected, setSelected] = useState<string | undefined>(sorted[0]?.id)
  const [details, setDetails] = useState(false)
  const current = sorted.find((a) => a.id === selected) ?? sorted[0]
  const now = useNow(pending.length > 0)
  const root = useRef<HTMLDivElement>(null)
  const empty = sorted.length === 0 && pending.length === 0
  const i = Math.max(0, sorted.findIndex((a) => a.id === current?.id))
  const job = pending[0]?.job
  const wait = job ? remaining(job.since ?? job.startedAt, now, paceEstimate(ws.pace, phaseKind(target, job, jobKind))) : undefined

  useEffect(() => {
    if (!sorted.some((a) => a.id === selected)) setSelected(sorted[0]?.id)
  }, [sorted, selected])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".lightbox")) return
      const focus = document.activeElement
      if (focus && focus !== document.body && !root.current?.contains(focus)) return
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const next = sorted[Math.max(0, Math.min(sorted.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)))]
        if (next) setSelected(next.id)
      } else if (!noApprove && e.key === "a" && current && current.status !== "approved") setStatus(current.id, "approved")
      else if (e.key === "Escape" && details) setDetails(false)
      else return
      e.preventDefault()
    }
    addEventListener("keydown", onKey)
    return () => removeEventListener("keydown", onKey)
  }, [sorted, current, i, details, setStatus, noApprove])

  return (
    <div className="fill col stage-wrap" ref={root} data-mesh-step={noApprove || undefined}>
      <JobBanner target={target} slot={slot} />
      {empty ? (
        <div className="stage-empty">{emptyState}</div>
      ) : (
        <div className="stage" data-tall={tall}>
          {current && noApprove && (
            <div className="mesh-stage-tools">
              {toolbar}
              <button type="button" className="icon-btn bordered" onClick={() => setDetails(true)} aria-label="Dettagli">
                <Icon name="info" size={13} />
              </button>
            </div>
          )}
          <div className="stage-media" data-video={!!current?.video} data-mesh={!!current?.mesh}>
            {current ? <StageMedia key={current.id} asset={current} onMeshSize={onMeshSize} /> : <div className="stage-wait skeleton" />}
            {pending.length > 0 && (
              <span className={`stage-chip ${current ? "" : "center"}`}>
                <span className="spinner" style={{ width: 11, height: 11 }} />
                {current ? "Nuova versione in arrivo" : "Sto generando"}
                {wait && <span className="mono">{wait}</span>}
              </span>
            )}
            {sorted.length > 1 && (
              <div className="stage-pager" aria-label="Versioni">
                <button className="icon-btn" onClick={() => setSelected(sorted[i - 1]?.id)} disabled={i === 0} aria-label="Versione precedente">
                  <Icon name="left" size={13} />
                </button>
                <span className="mono">
                  {i + 1}/{sorted.length}
                </span>
                <button className="icon-btn" onClick={() => setSelected(sorted[i + 1]?.id)} disabled={i === sorted.length - 1} aria-label="Versione successiva">
                  <Icon name="right" size={13} />
                </button>
              </div>
            )}
          </div>
          {current && !noApprove && <StageBar asset={current} toolbar={toolbar} onDetails={() => setDetails(true)} />}
        </div>
      )}
      {details && current && <Details asset={current} onClose={() => setDetails(false)} />}
    </div>
  )
}

function StageMedia({ asset: a, onMeshSize }: { asset: AssetView; onMeshSize?: (size: MeshSize) => void }) {
  const light = useLightbox()
  if (a.mesh) return <MeshView src={a.src} onSize={onMeshSize} />
  if (a.video)
    return (
      <>
        <TapVideo src={a.src} poster={a.poster} />
        <span className="disclosure">Creator virtuale</span>
      </>
    )
  return (
    <button className="stage-img" onClick={() => light({ src: a.src, alt: "Risultato" })} aria-label="Ingrandisci">
      <img src={a.src} alt="Risultato" />
    </button>
  )
}

/** Under the stage: one action, approve. Everything else waits behind the "more" menu. */
function StageBar({ asset: a, toolbar, onDetails }: { asset: AssetView; toolbar: ReactNode; onDetails: () => void }) {
  const { setStatus, act } = useWs()
  const [more, setMore] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [fix, setFix] = useState("")
  const [busy, setBusy] = useState(false)
  const canRefine = REFINABLE.has(a.kind) && !a.video

  const refine = async () => {
    if (!fix.trim()) return
    setBusy(true)
    await act({ type: "refine", assetId: a.id, instruction: fix.trim(), models: DEFAULT_MODELS.refine! })
    setFix("")
    setBusy(false)
    setFixing(false)
  }

  if (fixing)
    return (
      <form
        className="stage-bar stage-fix"
        onSubmit={(e) => {
          e.preventDefault()
          refine()
        }}
      >
        <input
          autoFocus
          className="field-input"
          placeholder="Cosa cambiare? es. catena più corta"
          value={fix}
          onChange={(e) => setFix(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setFixing(false)}
          aria-label="Cosa correggere"
        />
        <button className="btn primary sm" disabled={!fix.trim() || busy} type="submit">
          {busy ? <span className="spinner" style={{ width: 11, height: 11 }} /> : <Icon name="pen" size={12} />}
          Correggi
        </button>
        <button type="button" className="icon-btn" onClick={() => setFixing(false)} aria-label="Annulla">
          <Icon name="x" size={13} />
        </button>
      </form>
    )

  return (
    <div className="stage-bar">
      {a.status === "approved" ? (
        <span className="stage-ok">
          <Icon name="check" size={12} /> Approvato
        </span>
      ) : (
        <button className="btn primary sm" onClick={() => setStatus(a.id, "approved")}>
          <Icon name="check" size={12} /> Approva
        </button>
      )}
      <span className="more">
        <button className="icon-btn" aria-label="Altre azioni" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          <Icon name="more" size={14} />
        </button>
        {more && (
          <>
            <div className="more-scrim" onClick={() => setMore(false)} />
            <div className="more-menu card" onClick={(e) => (e.target as HTMLElement).closest("button, a") && setMore(false)}>
              {canRefine && (
                <button onClick={() => setFixing(true)}>
                  <Icon name="pen" size={12} /> Correggi un dettaglio
                </button>
              )}
              {toolbar}
              <button onClick={onDetails}>
                <Icon name="info" size={12} /> Dettagli e controlli
              </button>
              {a.status === "approved" && <button onClick={() => setStatus(a.id, "draft")}>Rimetti in bozza</button>}
            </div>
          </>
        )}
      </span>
    </div>
  )
}

const DRIFT = [0.5, 5, 9.5]

/** Everything the stage leaves out: the model, the checks against the DNA, the references, the prompt. */
function Details({ asset: a, onClose }: { asset: AssetView; onClose: () => void }) {
  const { ws, act, setStatus } = useWs()
  const [checking, setChecking] = useState(false)
  const failed = a.qa?.checks.filter((c) => !c.pass).length ?? 0
  const checks = [...(a.qa?.checks ?? [])].sort((x, y) => Number(x.pass) - Number(y.pass))
  const qaRunning = ws.jobs.some((j) => j.type === "qa" && j.target === `qa:${a.id}` && j.status === "running")

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer card" aria-label="Dettagli del risultato">
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <h3>{a.model}</h3>
            <div className="inspector-sub">
              {[a.seconds ? secs(a.seconds) : undefined, usd(a.usd), a.creator ? creatorName(ws, a.creator, false) : undefined].filter(Boolean).join(" · ")}
            </div>
          </div>
          {a.qa && (
            <div className="big-score">
              <b data-t={scoreTone(a.qa.score)}>{a.qa.score}</b>
              <span className="caps">QA / 100</span>
            </div>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Chiudi">
            <Icon name="x" />
          </button>
        </div>

        <div className="secs">
          {checks.length > 0 && (
            <Section title="Controlli sul DNA" meta={<span data-t={failed ? "bad" : "ok"}>{`${checks.length - failed}/${checks.length}`}</span>} open>
              <ul className="checks">
                {checks.map((c) => (
                  <li className="check" data-pass={c.pass} key={c.key}>
                    <i>
                      <Icon name={c.pass ? "check" : "x"} size={10} />
                    </i>
                    <div>
                      <b>{c.label.charAt(0).toUpperCase() + c.label.slice(1)}</b>
                      {c.note && <p>{c.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {a.qa && a.qa.artifacts.length > 0 && (
            <Section title="Difetti" meta={a.qa.artifacts.length} open>
              <ul className="sec-list">
                {a.qa.artifacts.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Section>
          )}

          {a.video && (
            <Section title="Fotogrammi" meta={DRIFT.length}>
              <div className="drift">
                {DRIFT.map((t) => (
                  <figure key={t}>
                    <img src={`/api/frame/${a.src.split("/").pop()}?t=${t}`} alt={`Fotogramma a ${t} secondi`} loading="lazy" />
                    <figcaption>{t}s</figcaption>
                  </figure>
                ))}
              </div>
            </Section>
          )}

          {a.refs.length > 0 && (
            <Section title="Riferimenti usati" meta={a.refs.length}>
              <div className="refs">
                {a.refs.map((r) => (
                  <figure key={r.id}>
                    <img src={r.src} alt={r.label} loading="lazy" />
                    <figcaption>{r.label}</figcaption>
                  </figure>
                ))}
              </div>
            </Section>
          )}

          {a.mesh && (
            <Section title="File" open>
              <a className="mono link" href={a.src} download>
                Scarica il GLB
              </a>
            </Section>
          )}

          <Section title="Modello">
            <div className="tags">
              <span className={`badge ${a.weights === "open" ? "ok" : ""}`}>{a.weights === "open" ? "Pesi aperti" : "Pesi chiusi"}</span>
              <span className="badge outline">{a.hosting === "self-hosted" ? "Self-hosted" : "API gestita"}</span>
            </div>
            {a.prompt && <pre className="prompt">{a.prompt}</pre>}
          </Section>
        </div>

        <div className="drawer-foot">
          {QA_ABLE.has(a.kind) && (
            <button
              className="btn secondary sm"
              disabled={qaRunning || checking}
              onClick={async () => {
                setChecking(true)
                await act({ type: "qa", assetId: a.id })
                setChecking(false)
              }}
            >
              {(qaRunning || checking) && <span className="spinner" style={{ width: 11, height: 11 }} />}
              Controlla qualità
            </button>
          )}
          {a.status !== "approved" && (
            <button
              className="btn ghost sm"
              onClick={() => {
                setStatus(a.id, "rejected")
                onClose()
              }}
            >
              Scarta questa versione
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
