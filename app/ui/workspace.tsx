"use client"
/* eslint-disable @next/next/no-img-element */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { Action } from "@/lib/actions"
import { PHASES, STEPS, stepStates, type StepId, type StepState } from "@/lib/steps"
import type { AssetStatus, JobView, Workspace } from "@/lib/workspace-types"
import { Activity, Icon, Topbar, api, useToast } from "./kit"
import { InputStep } from "./steps/input"
import { ViewsStep } from "./steps/views"
import { OnModelStep } from "./steps/on-model"
import { StudioStep } from "./steps/studio"
import { UgcStep } from "./steps/ugc"
import { TextsStep } from "./steps/texts"
import { PublishStep } from "./steps/publish"
import { TryonStep } from "./steps/tryon"
import { MeshStep } from "./steps/mesh"
import { SceneStep } from "./steps/scene"
import { CompareView } from "./compare"

type Patch = {
  field?: { key: string; value?: string; source?: string; critical?: boolean }
  confirmDna?: boolean
  shoot?: { path: string; value: string }
  signoff?: { by: string; items: string[] } | null
}

type Ctx = {
  ws: Workspace
  states: StepState[]
  step: StepId
  /** state of the step on screen, so a view knows whether it still owns the primary action */
  state: StepState
  next?: { id: StepId; label: string; locked: boolean }
  go: (step: StepId | "confronto") => void
  refresh: () => Promise<void>
  act: (action: Action) => Promise<JobView | undefined>
  setStatus: (assetId: string, status: AssetStatus) => Promise<void>
  patch: (body: Patch) => Promise<void>
}

const WsCtx = createContext<Ctx | null>(null)

export function useWs() {
  const ctx = useContext(WsCtx)
  if (!ctx) throw new Error("useWs outside workspace")
  return ctx
}

export function stepOfTarget(target: string): StepId {
  if (target === "input") return "input"
  if (target === "dna" || target === "shoot") return "input"
  if (target === "on-model") return "indossato"
  if (target === "mesh" || target === "3d") return "3d"
  if (target === "scene") return "scena"
  if (target.startsWith("studio:")) return "studio"
  if (target.startsWith("ugc:")) return "ugc"
  if (target === "pdp") return "testi"
  if (target === "focus" || target === "export") return "pubblica"
  if (target === "ghost-front") return "concept"
  return "viste"
}

export function WorkspaceApp({ initial, initialStep }: { initial: Workspace; initialStep?: string }) {
  const toast = useToast()
  const [ws, setWs] = useState(initial)
  const states = useMemo(() => stepStates(ws), [ws])
  const [step, setStep] = useState<StepId>(() => {
    const valid = STEPS.find((s) => s.id === initialStep)?.id
    return valid ?? stepStates(initial).find((s) => s.status === "todo" || s.status === "running")?.id ?? "pubblica"
  })
  const [comparing, setComparing] = useState(initialStep === "confronto")
  const [menu, setMenu] = useState(false)
  const prevJobs = useRef(new Map(initial.jobs.map((j) => [j.id, j.status])))
  const mainRef = useRef<HTMLElement>(null)

  const go = useCallback((next: StepId | "confronto") => {
    setComparing(next === "confronto")
    if (next !== "confronto") setStep(next)
    const url = new URL(location.href)
    url.searchParams.set("step", next)
    history.replaceState(null, "", url)
  }, [])

  const refresh = useCallback(async () => {
    try {
      setWs(await api<Workspace>(`/api/garments/${initial.garment.id}`))
    } catch {
      /* transient: the next poll retries */
    }
  }, [initial.garment.id])

  const running = ws.jobs.some((j) => j.status === "running")
  useEffect(() => {
    const t = setInterval(refresh, running ? 1500 : 10000)
    return () => clearInterval(t)
  }, [refresh, running])

  useEffect(() => {
    for (const j of ws.jobs) {
      const before = prevJobs.current.get(j.id)
      if (before === "running" && j.status !== "running") {
        const where = j.type === "prepare" && j.status === "done" ? "input" : stepOfTarget(j.target)
        const view = where !== step ? { label: "Vedi", run: () => go(where) } : undefined
        if (j.status === "done") {
          const failed = j.errors.length ? `${j.errors.length} modelli non hanno risposto` : undefined
          toast({ title: `${j.label}: pronto`, body: failed, action: view })
        } else {
          toast({ title: `${j.label}: non riuscito`, body: j.error, tone: "error", action: view })
        }
      }
      prevJobs.current.set(j.id, j.status)
    }
  }, [ws.jobs, step, go, toast])

  const act = useCallback(
    async (action: Action) => {
      try {
        const job = await api<JobView | { offline: true }>(`/api/garments/${initial.garment.id}/jobs`, { method: "POST", json: action })
        if ("offline" in job) return
        prevJobs.current.set(job.id, "running")
        await refresh()
        return job
      } catch (err) {
        toast({ title: "Non avviato", body: err instanceof Error ? err.message : String(err), tone: "error" })
      }
    },
    [initial.garment.id, refresh, toast],
  )

  const setStatus = useCallback(
    async (assetId: string, status: AssetStatus) => {
      setWs((cur) => {
        const target = cur.assets.find((a) => a.id === assetId)
        return {
          ...cur,
          assets: cur.assets.map((a) =>
            a.id === assetId
              ? { ...a, status }
              : status === "approved" && target && a.status === "approved" && a.kind === target.kind && a.format === target.format && a.creator === target.creator && (a.label ?? "").replace(/\+lock$/, "") === (target.label ?? "").replace(/\+lock$/, "")
                ? { ...a, status: "draft" }
                : a,
          ),
        }
      })
      try {
        await api(`/api/assets/${assetId}`, { method: "POST", json: { status, by: "direzione creativa" } })
      } catch (err) {
        toast({ title: "Non salvato", body: err instanceof Error ? err.message : String(err), tone: "error" })
      }
      await refresh()
    },
    [refresh, toast],
  )

  const patch = useCallback(
    async (body: Patch) => {
      try {
        setWs(await api<Workspace>(`/api/garments/${initial.garment.id}`, { method: "PATCH", json: body }))
      } catch (err) {
        toast({ title: "Non salvato", body: err instanceof Error ? err.message : String(err), tone: "error" })
      }
    },
    [initial.garment.id, toast],
  )

  const at = STEPS.findIndex((s) => s.id === step)
  const after = STEPS[at + 1]
  const ctx: Ctx = {
    ws,
    states,
    step,
    state: states[at],
    next: after && { id: after.id, label: after.label, locked: states[at + 1].status === "locked" },
    go,
    refresh,
    act,
    setStatus,
    patch,
  }
  const g = ws.garment
  const i = STEPS.findIndex((s) => s.id === step)
  const thumb =
    ws.assets.find((a) => a.kind === "ghost-front" && a.status === "approved") ?? ws.assets.find((a) => a.kind === "sketch") ?? ws.assets.find((a) => a.kind === "archive")
  const generated = ws.assets.filter((a) => a.modelId)

  return (
    <WsCtx.Provider value={ctx}>
      <Topbar
        crumbs={[{ label: "Capi", href: "/" }, { label: g.name }]}
        right={
          <>
            <span className="mono muted" style={{ marginRight: 4 }}>
              {g.sku}
            </span>
            <Activity jobs={ws.jobs} models={ws.models} onOpenJob={(j) => go(stepOfTarget(j.target))} />
          </>
        }
      />
      <div className="ws">
        <button className="menu-btn" onClick={() => setMenu(true)} aria-label="Apri i passi" aria-expanded={menu}>
          <span className="menu-thumb">{thumb && <img src={thumb.src} alt="" />}</span>
          <span className="menu-text">
            <b>{g.name}</b>
            <span>
              {PHASES.find((p) => p.id === STEPS[i]?.phase)?.label} · {i + 1}/{STEPS.length}
            </span>
          </span>
          <Icon name="down" size={12} />
        </button>
        {menu && <div className="drawer-scrim" onClick={() => setMenu(false)} />}
        <aside className="rail" aria-label="Passi" data-open={menu} onClick={(e) => (e.target as HTMLElement).closest("button") && setMenu(false)}>
          <div className="rail-garment">
            <div className="rail-thumb">{thumb && <img src={thumb.src} alt="" />}</div>
            <div style={{ minWidth: 0 }}>
              <h2>{g.name}</h2>
              <span className="mono muted">{g.maison} · {g.line === "uomo" ? "Uomo" : "Donna"}</span>
            </div>
          </div>
          <ol className="steps">
            {STEPS.map((s, i) => {
              const st = states[i]
              const phase = i === 0 || STEPS[i - 1].phase !== s.phase ? PHASES.find((p) => p.id === s.phase)?.label : undefined
              return (
                <li key={s.id} className="step" data-s={st.status} data-phase={phase}>
                  <button aria-current={!comparing && step === s.id ? "step" : undefined} onClick={() => go(s.id)} disabled={st.status === "locked" && step !== s.id}>
                    <span className="step-dot">
                      {st.status === "done" ? (
                        <Icon name="check" size={11} />
                      ) : st.status === "running" ? (
                        <span className="spinner" style={{ width: 11, height: 11 }} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="step-text">
                      <b>{s.label}</b>
                      <span>{st.detail}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          <button className="rail-compare" aria-current={comparing ? "page" : undefined} onClick={() => go("confronto")} disabled={!generated.length}>
            <Icon name="image" />
            <span>
              <b>Confronto modelli</b>
              <span>{generated.length} generazioni affiancate</span>
            </span>
          </button>
          <div className="rail-foot">
            <div>
              <span>Generazioni</span>
              <b className="num">{generated.length}</b>
            </div>
            <div>
              <span>Costo generazioni</span>
              <b className="num">${ws.cost.toFixed(2)}</b>
            </div>
          </div>
        </aside>

        <main className="main" ref={mainRef}>
          {comparing ? (
            <div className="step-view" key="confronto">
              <CompareView />
            </div>
          ) : (
            <div className="step-view" key={step}>
              {step === "input" && <InputStep />}
              {step === "concept" && <ViewsStep concept />}
              {step === "viste" && <ViewsStep />}
              {step === "3d" && <MeshStep />}
              {step === "scena" && <SceneStep />}
              {step === "indossato" && <OnModelStep />}
              {step === "studio" && <StudioStep />}
              {step === "ugc" && <UgcStep />}
              {step === "testi" && <TextsStep />}
              {step === "pubblica" && <PublishStep />}
              {step === "prova" && <TryonStep />}
            </div>
          )}
        </main>
        {!comparing && <StepPill />}
      </div>
    </WsCtx.Provider>
  )
}

/** The step's title, one line of what happens here, and the step's own action. Navigation lives in the pill. */
export function StepHead({ actions }: { actions?: React.ReactNode }) {
  const { step } = useWs()
  const s = STEPS.find((x) => x.id === step)!
  return (
    <header className="step-head">
      <h1>{s.title}</h1>
      <p className="step-lede">{s.lede}</p>
      {actions && <div className="step-actions">{actions}</div>}
    </header>
  )
}

/** Floating at the bottom: back, one dot per step, forward. */
function StepPill() {
  const { step, state, states, go } = useWs()
  const i = STEPS.findIndex((s) => s.id === step)
  const prev = STEPS[i - 1]
  const nextIdx = states.findIndex((s, k) => k > i && s.status !== "locked")
  const next = nextIdx >= 0 ? STEPS[nextIdx] : undefined
  const skipped = nextIdx > i + 1 ? states[i + 1] : undefined
  return (
    <nav className="pill" aria-label="Passi">
      <button className="icon-btn" onClick={() => prev && go(prev.id)} disabled={!prev} aria-label={prev ? `Indietro: ${prev.label}` : "Indietro"}>
        <Icon name="left" />
      </button>
      <ol className="pill-dots">
        {STEPS.map((s, k) => (
          <li key={s.id}>
            <button
              data-s={states[k].status}
              aria-current={k === i ? "step" : undefined}
              disabled={states[k].status === "locked"}
              onClick={() => go(s.id)}
              aria-label={s.label}
              title={`${s.label} · ${states[k].detail}`}
            />
          </li>
        ))}
      </ol>
      <span className="pill-label">{STEPS[i].label}</span>
      <span className="pill-next">
        {next ? (
          <button className={`btn sm ${state.status === "done" ? "primary" : "ghost"}`} onClick={() => go(next.id)} title={skipped ? skipped.detail : undefined}>
            {next.label} <Icon name="right" size={12} />
          </button>
        ) : (
          <span className="pill-next-spacer" aria-hidden />
        )}
      </span>
    </nav>
  )
}
