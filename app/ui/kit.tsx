"use client"
/* eslint-disable @next/next/no-img-element */

import Link from "next/link"
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import type { JobView, ModelOption } from "@/lib/workspace-types"

/* ---------------- icons ---------------- */

const PATHS = {
  check: <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />,
  x: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" strokeLinecap="round" />,
  plus: <path d="M8 3v10M3 8h10" strokeLinecap="round" />,
  left: <path d="M10 3.5L5.5 8l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />,
  right: <path d="M6 3.5L10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />,
  down: <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />,
  more: <path d="M3.5 8h.01M8 8h.01M12.5 8h.01" strokeLinecap="round" strokeWidth="2.4" />,
  upload: <path d="M8 10.5V2.5M4.5 6L8 2.5 11.5 6M2.5 10v2.5a1 1 0 001 1h9a1 1 0 001-1V10" strokeLinecap="round" strokeLinejoin="round" />,
  image: (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <circle cx="6" cy="6.5" r="1.2" />
      <path d="M2.5 12l3.5-3.5 2.5 2.5 2-2 3 3" strokeLinejoin="round" />
    </>
  ),
  pen: <path d="M10.5 2.5l3 3L6 13H3v-3z" strokeLinejoin="round" />,
  spark: <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" strokeLinecap="round" />,
  lock: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
    </>
  ),
  file: <path d="M4 2h5l3 3v9H4zM9 2v3h3" strokeLinejoin="round" />,
  folder: <path d="M2 4.5a1 1 0 011-1h3l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1z" strokeLinejoin="round" />,
  download: <path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10" strokeLinecap="round" strokeLinejoin="round" />,
  play: <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" stroke="none" />,
  video: (
    <>
      <rect x="2" y="4" width="8.5" height="8" rx="1.5" />
      <path d="M10.5 7l3.5-2v6l-3.5-2" strokeLinejoin="round" />
    </>
  ),
  alert: <path d="M8 5v3.5M8 11h.01M7.1 2.6L1.8 12a1 1 0 00.9 1.5h10.6a1 1 0 00.9-1.5L8.9 2.6a1 1 0 00-1.8 0z" strokeLinecap="round" strokeLinejoin="round" />,
  arrow: <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />,
  info: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.3v3.7M8 5.1h.01" strokeLinecap="round" />
    </>
  ),
  trash: (
    <>
      <path d="M3.5 4h9M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 4v8.5M10 4v8.5" strokeLinecap="round" />
      <path d="M4.5 4.5l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9" strokeLinejoin="round" />
    </>
  ),
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden>
      {PATHS[name]}
    </svg>
  )
}

/** Secondary explanation, shown on hover or focus instead of taking room on the page. */
export function Hint({ children, label = "Informazioni", align = "left" }: { children: ReactNode; label?: string; align?: "left" | "right" }) {
  return (
    <span className="tip" tabIndex={0} role="button" aria-label={label} data-align={align}>
      <Icon name="info" size={13} />
      <span className="tip-body" role="tooltip">
        {children}
      </span>
    </span>
  )
}

/** Collapsible block for details that are useful but not needed at a glance. */
export function Section({ title, meta, open, children }: { title: ReactNode; meta?: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="sec" open={open}>
      <summary>
        <span className="sec-title">{title}</span>
        {meta !== undefined && <span className="sec-meta">{meta}</span>}
        <Icon name="down" size={12} />
      </summary>
      <div className="sec-body">{children}</div>
    </details>
  )
}

/* ---------------- formatting ---------------- */

export const pad2 = (n: number) => String(n).padStart(2, "0")
export const usd = (n?: number) => (n === undefined ? "—" : `$${n.toFixed(2)}`)
export const secs = (n: number) => (n >= 60 ? `${Math.floor(n / 60)}m ${pad2(n % 60)}s` : `${n}s`)

export function elapsed(since: string, now: number) {
  return secs(Math.max(0, Math.round((now - Date.parse(since)) / 1000)))
}

/**
 * Countdown toward the average duration of this kind of image. Kinds with no history yet borrow the
 * average of the same step (a first back view uses the other packshots). With no history at all, the time already spent.
 */
const PACE_FAMILY: Record<string, string[]> = {
  "ghost-front": ["ghost-front", "ghost-back", "ghost-side", "detail-button", "detail-fabric"],
  "ghost-back": ["ghost-front", "ghost-back", "ghost-side", "detail-button", "detail-fabric"],
  "ghost-side": ["ghost-front", "ghost-back", "ghost-side", "detail-button", "detail-fabric"],
  "detail-button": ["ghost-front", "ghost-back", "ghost-side", "detail-button", "detail-fabric"],
  "detail-fabric": ["ghost-front", "ghost-back", "ghost-side", "detail-button", "detail-fabric"],
}

export function paceEstimate(pace: Record<string, { seconds: number; n: number }>, kind: string): number | undefined {
  const own = pace[kind]
  if (own?.n) return own.seconds
  const family = PACE_FAMILY[kind]
  if (!family) return undefined
  let n = 0
  let total = 0
  for (const key of family) {
    const row = pace[key]
    if (!row?.n) continue
    n += row.n
    total += row.seconds * row.n
  }
  return n ? Math.round(total / n) : undefined
}

export function remaining(since: string, now: number, estimate?: number) {
  const gone = Math.max(0, Math.round((now - Date.parse(since)) / 1000))
  if (!estimate) return secs(gone)
  return `~${secs(Math.max(0, estimate - gone))}`
}

export function useNow(active = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json" } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Errore ${res.status}`)
  return data
}

/* ---------------- toasts ---------------- */

type Toast = { id: number; title: string; body?: string; tone?: "ok" | "error"; action?: { label: string; run: () => void } }
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random()
    setToasts((all) => [...all.slice(-2), { ...t, id }])
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), t.tone === "error" ? 9000 : 5500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone ?? ""}`} role="status">
            <i style={{ fontStyle: "normal" }}>
              <Icon name={t.tone === "error" ? "alert" : "check"} />
            </i>
            <div>
              <div>{t.title}</div>
              {t.body && <p>{t.body}</p>}
            </div>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.run()
                  setToasts((all) => all.filter((x) => x.id !== t.id))
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------------- tap video ---------------- */

export function TapVideo({
  src,
  poster,
  autoPlay,
  loop = true,
  preload = "metadata",
  className,
}: {
  src: string
  poster?: string
  autoPlay?: boolean
  loop?: boolean
  preload?: "" | "none" | "metadata" | "auto"
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)

  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) void v.play().catch(() => {})
    else v.pause()
  }

  return (
    <video
      ref={ref}
      className={className ? `tap-video ${className}` : "tap-video"}
      src={src}
      poster={poster}
      playsInline
      loop={loop}
      autoPlay={autoPlay}
      preload={preload}
      onClick={toggle}
      aria-label="Play o pausa"
    />
  )
}

/* ---------------- lightbox ---------------- */

type Light = { src: string; video?: boolean; disclosure?: boolean; alt: string }
const LightCtx = createContext<(l: Light) => void>(() => {})
export const useLightbox = () => useContext(LightCtx)

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<Light | null>(null)
  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setItem(null)
    addEventListener("keydown", onKey)
    document.documentElement.style.overflow = "hidden"
    return () => {
      removeEventListener("keydown", onKey)
      document.documentElement.style.overflow = ""
    }
  }, [item])
  return (
    <LightCtx.Provider value={setItem}>
      {children}
      {item && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={item.alt} onClick={(e) => e.target === e.currentTarget && setItem(null)}>
          <button className="icon-btn lightbox-close" onClick={() => setItem(null)} aria-label="Chiudi" autoFocus>
            <Icon name="x" size={16} />
          </button>
          <div className="lightbox-media">
            {item.video ? <TapVideo src={item.src} autoPlay preload="auto" /> : <img src={item.src} alt={item.alt} />}
            {item.disclosure && <span className="disclosure">Pubblicità · Generato con IA · Creator virtuale</span>}
          </div>
        </div>
      )}
    </LightCtx.Provider>
  )
}

/* ---------------- popover ---------------- */

export function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    addEventListener("mousedown", onDown)
    addEventListener("keydown", onKey)
    return () => {
      removeEventListener("mousedown", onDown)
      removeEventListener("keydown", onKey)
    }
  }, [open])
  return { open, setOpen, ref }
}

/* ---------------- top bar ---------------- */

export function Topbar({ crumbs, right }: { crumbs?: Array<{ label: string; href?: string }>; right?: ReactNode }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Sartoria, tutti i capi">
        <span className="brand-mark">S</span>
        <span className="brand-name">Sartoria</span>
      </Link>
      {crumbs && crumbs.length > 0 && (
        <nav className="crumbs" aria-label="Percorso">
          {crumbs.map((c, i) => (
            <span key={c.label} style={{ display: "contents" }}>
              <span className="sep">/</span>
              {c.href && i < crumbs.length - 1 ? <Link href={c.href}>{c.label}</Link> : <span className="current">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="topbar-right">{right}</div>
    </header>
  )
}

export function Activity({ jobs, models, onOpenJob }: { jobs: JobView[]; models: ModelOption[]; onOpenJob?: (j: JobView) => void }) {
  const { open, setOpen, ref } = usePopover()
  const now = useNow(jobs.some((j) => j.status === "running"))
  const active = jobs.filter((j) => j.status === "running")
  const recent = [...jobs].reverse().slice(0, 12)
  const modelLabel = (id: string) => models.find((m) => m.id === id)?.label ?? id
  return (
    <div className="activity" ref={ref}>
      <button className="activity-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {active.length ? <span className="spinner" style={{ width: 11, height: 11 }} /> : <span className="dot" />}
        {active.length ? `${active.length} in corso` : "Tutto pronto"}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Attività">
          <div className="popover-head">
            <span>Attività</span>
            <span className="muted mono">{jobs.length} lavori</span>
          </div>
          {recent.length === 0 && <p style={{ padding: 16, color: "var(--muted)", fontSize: 12.5 }}>Nessuna generazione in questa sessione.</p>}
          {recent.map((j) => (
            <button
              key={j.id}
              className="job-row"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => {
                onOpenJob?.(j)
                setOpen(false)
              }}
            >
              <span style={{ paddingTop: 2 }}>
                {j.status === "running" ? <span className="spinner" style={{ width: 12, height: 12 }} /> : j.status === "error" ? <Icon name="alert" /> : <Icon name="check" />}
              </span>
              <div>
                <b>{j.label}</b>
                {j.status === "running" && j.phase && <p>{j.phase}</p>}
                {j.models.length > 0 && <p>{j.models.map(modelLabel).join(", ")}</p>}
                {j.status === "error" && <p className="err">{j.error}</p>}
                {j.errors.map((e) => (
                  <p key={e.modelId} className="err">
                    {modelLabel(e.modelId)}: {e.error.slice(0, 90)}
                  </p>
                ))}
              </div>
              <span className="mono muted">{elapsed(j.startedAt, j.endedAt ? Date.parse(j.endedAt) : now)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The action that runs a model, with the model named underneath instead of inside the
 * target: only one button per view is filled, so the eye always has a single anchor.
 */
export function GenerateButton({
  label,
  models,
  modelIds,
  onRun,
  busy,
  disabled,
  quiet,
}: {
  label: string
  models: ModelOption[]
  modelIds: string[]
  onRun: () => void
  busy?: boolean
  disabled?: boolean
  /** another button on screen already carries the primary weight */
  quiet?: boolean
}) {
  const names = modelIds.map((id) => models.find((m) => m.id === id)?.label ?? id).join(" · ")
  return (
    <span className="gen">
      <button className={`btn ${quiet ? "secondary" : "primary"}`} onClick={onRun} disabled={busy || disabled} title={names}>
        {busy ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="spark" />}
        {label}
      </button>
    </span>
  )
}
