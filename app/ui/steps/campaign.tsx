"use client"
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react"
import type { CampaignPlan, ChannelId, DayResult, Funnel, MarketId, SegmentResult } from "@/lib/campaign-types"
import type { Workspace } from "@/lib/workspace-types"
import { Hint, Icon, api, useToast } from "../kit"
import { StepHead, useWs } from "../workspace"

export const eur = (n: number, digits = 0) => n.toLocaleString("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: digits, minimumFractionDigits: digits })
export const int = (n: number) => Math.round(n).toLocaleString("en-GB")
export const pct = (n: number, of: number, digits = 2) => (of ? `${((n / of) * 100).toFixed(digits)}%` : "—")

const BUDGETS = [1000, 2500, 5000]
const DURATIONS = [7, 10, 14]
const TYPE_LABEL: Record<string, string> = { ugc: "UGC reel", editorial: "Editorial", onmodel: "On-model", lifestyle: "Lifestyle", packshot: "Packshot" }
const SENTIMENT = { positive: { label: "positive", tone: "ok" }, neutral: { label: "neutral", tone: "outline" }, negative: { label: "critical", tone: "bad" } } as const

function sum(days: DayResult[]): Funnel {
  const out: Funnel = { spend: 0, impressions: 0, reach: 0, likes: 0, comments: 0, saves: 0, shares: 0, clicks: 0, sessions: 0, waitlist: 0, preorders: 0 }
  for (const d of days) for (const k of Object.keys(out) as Array<keyof Funnel>) out[k] += d[k]
  return out
}

export function CampaignStep() {
  const { ws, setWs, go } = useWs()
  const toast = useToast()
  const m = ws.market
  const c = m.campaign
  const [plan, setPlan] = useState<CampaignPlan>(m.plan)
  const [sending, setSending] = useState(false)
  const [day, setDay] = useState(c ? c.result.plan.days : 0)
  const [playing, setPlaying] = useState(false)
  const total = c?.result.plan.days ?? 0

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setDay((d) => (d >= total ? d : d + 1)), 380)
    return () => clearInterval(t)
  }, [playing, total])
  useEffect(() => {
    if (playing && day >= total) setPlaying(false)
  }, [day, total, playing])

  const launch = async () => {
    setSending(true)
    try {
      const next = await api<Workspace>(`/api/garments/${ws.garment.id}/campaign`, { method: "POST", json: plan })
      setWs(next)
      setDay(1)
      setPlaying(true)
    } catch (err) {
      toast({ title: "Test not launched", body: err instanceof Error ? err.message : String(err), tone: "error" })
    } finally {
      setSending(false)
    }
  }

  const toggle = <K extends "channels" | "markets">(key: K, id: CampaignPlan[K][number]) =>
    setPlan((p) => {
      const list = p[key] as string[]
      return { ...p, [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] }
    })

  const changed = !c || JSON.stringify(plan) !== JSON.stringify(c.result.plan)
  const thumb = (assetId: string) => {
    const a = ws.assets.find((x) => x.id === assetId)
    return a ? (a.video ? a.poster : a.src) : undefined
  }

  return (
    <>
      <StepHead
        actions={
          c && !changed ? (
            <button className="btn primary sm" onClick={() => go("validazione")}>
              Read the results <Icon name="right" size={12} />
            </button>
          ) : undefined
        }
      />
      <div className="mk fill">
        <section className="card mk-card mk-plan scroll">
          <header>
            <h3>Test plan</h3>
            <Hint align="right">
              The audience is simulated: a funnel model (CPM → impressions → clicks → pre-order page → pre-order) with rates per content, market and age
              taken from the brand&apos;s history. Same plan, same numbers.
            </Hint>
          </header>
          <div className="mk-field">
            <span className="label">Media budget</span>
            <div className="seg" role="group" aria-label="Budget">
              {BUDGETS.map((b) => (
                <button key={b} aria-pressed={plan.budget === b} onClick={() => setPlan({ ...plan, budget: b })}>
                  {eur(b)}
                </button>
              ))}
            </div>
          </div>
          <div className="mk-field">
            <span className="label">Duration</span>
            <div className="seg" role="group" aria-label="Duration">
              {DURATIONS.map((d) => (
                <button key={d} aria-pressed={plan.days === d} onClick={() => setPlan({ ...plan, days: d })}>
                  {d} days
                </button>
              ))}
            </div>
          </div>
          <div className="mk-field">
            <span className="label">Channels</span>
            <div className="mk-chips">
              {m.channels.map((ch) => (
                <button key={ch.id} className="mk-chip" aria-pressed={plan.channels.includes(ch.id)} onClick={() => toggle("channels", ch.id as ChannelId)}>
                  {ch.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mk-field">
            <span className="label">Markets</span>
            <div className="mk-chips">
              {m.markets.map((mk) => (
                <button key={mk.id} className="mk-chip" aria-pressed={plan.markets.includes(mk.id)} onClick={() => toggle("markets", mk.id as MarketId)}>
                  {mk.label}
                </button>
              ))}
            </div>
          </div>
          <label className="mk-field">
            <span className="label">Pre-order price</span>
            <input
              className="field-input num"
              type="number"
              min={50}
              step={10}
              value={plan.price}
              onChange={(e) => setPlan({ ...plan, price: Number(e.target.value) || 0 })}
            />
          </label>
          <div className="mk-field">
            <span className="label">
              Content in the campaign <span className="muted">· {m.creatives.length}</span>
            </span>
            <ul className="mk-ads">
              {m.creatives.map((cr) => (
                <li key={cr.id}>
                  <span className="mk-ad-thumb">{thumb(cr.assetId) && <img src={thumb(cr.assetId)} alt="" />}</span>
                  <span className="mk-ad-text">
                    <b>{cr.label}</b>
                    <span>{cr.channels.map((x) => m.channels.find((ch) => ch.id === x)?.label).join(" · ")}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <button className="btn primary" disabled={sending || !plan.channels.length || !plan.markets.length || !changed} onClick={launch}>
            {sending ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="play" size={12} />}
            {c ? (changed ? "Relaunch with this plan" : "Test launched") : "Launch the test"}
          </button>
        </section>

        <div className="mk-results scroll">
          {c ? (
            <Results day={day} setDay={(d) => (setPlaying(false), setDay(d))} playing={playing} play={() => (setDay((d) => (d >= total ? 1 : d)), setPlaying(true))} thumb={thumb} />
          ) : (
            <div className="empty" style={{ height: "100%" }}>
              <h3>No physical sample, already a market signal</h3>
              <p>
                The {m.creatives.length} approved assets go into a paid campaign with a pre-order page. After {plan.days} days you know whether to produce,
                and how much.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Results({ day, setDay, playing, play, thumb }: { day: number; setDay: (d: number) => void; playing: boolean; play: () => void; thumb: (id: string) => string | undefined }) {
  const { ws } = useWs()
  const c = ws.market.campaign!
  const r = c.result
  const shown = useMemo(() => sum(r.days.slice(0, day)), [r.days, day])
  const done = day >= r.plan.days
  const [theme, setTheme] = useState<string | null>(null)
  const themes = useMemo(() => {
    const by = new Map<string, { n: number; sentiment: keyof typeof SENTIMENT; label: string }>()
    for (const x of r.comments) {
      const row = by.get(x.theme) ?? { n: 0, sentiment: x.sentiment, label: ws.market.themes[x.theme] ?? x.theme }
      row.n++
      by.set(x.theme, row)
    }
    return [...by].sort((a, b) => b[1].n - a[1].n)
  }, [r.comments, ws.market.themes])
  const creatives = [...r.creatives].sort((a, b) => b.preorders - a.preorders)
  const label = (id: string) => r.creatives.find((x) => x.id === id)?.label ?? ""

  const kpis = [
    { label: "Spend", value: eur(shown.spend), sub: `of ${eur(r.plan.budget)}` },
    { label: "Reach", value: int(shown.reach), sub: `${int(shown.impressions)} impressions` },
    { label: "Save rate", value: pct(shown.saves, shown.reach), sub: `${int(shown.saves)} saves` },
    { label: "CTR", value: pct(shown.clicks, shown.impressions), sub: `${int(shown.sessions)} pre-order visits` },
    { label: "Pre-orders", value: int(shown.preorders), sub: `conv. ${pct(shown.preorders, shown.sessions)}`, hero: true },
    { label: "Waitlist", value: int(shown.waitlist), sub: `${int(shown.comments)} comments` },
  ]

  return (
    <>
      <section className="card mk-card">
        <header>
          <h3>
            Day {day} of {r.plan.days}
            <span className="badge outline">Simulated audience</span>
          </h3>
          <div className="mk-play">
            <button className="icon-btn" onClick={play} disabled={playing} aria-label="Replay the test day by day">
              <Icon name="play" size={12} />
            </button>
            <input type="range" min={1} max={r.plan.days} value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Test day" />
          </div>
        </header>
        <div className="mk-kpis">
          {kpis.map((k) => (
            <div className="mk-kpi" key={k.label} data-hero={k.hero}>
              <span className="caps">{k.label}</span>
              <b className="num">{k.value}</b>
              <span className="muted num">{k.sub}</span>
            </div>
          ))}
        </div>
        <DailyBars days={r.days} day={day} />
      </section>

      <section className="card mk-card" data-dim={!done}>
        <header>
          <h3>Content</h3>
          <span className="muted">{done ? "at the end of the test · budget shifts to what converts from day 3" : "at the end of the test"}</span>
        </header>
        <div className="mk-table-wrap">
          <table className="mk-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th className="r">Spend</th>
                <th className="r">CTR</th>
                <th className="r">Save</th>
                <th className="r">Pre-orders</th>
                <th className="r">€ / pre-order</th>
              </tr>
            </thead>
            <tbody>
              {creatives.map((cr, i) => (
                <tr key={cr.id}>
                  <td>
                    <span className="mk-ad">
                      <span className="mk-ad-thumb">{thumb(cr.assetId) && <img src={thumb(cr.assetId)} alt="" />}</span>
                      <span className="mk-ad-text">
                        <b>
                          {cr.label} {i === 0 && <span className="badge ok">best</span>}
                        </b>
                        <span>{TYPE_LABEL[cr.type]} · {cr.channels.join(" + ")}</span>
                      </span>
                    </span>
                  </td>
                  <td className="r num">{eur(cr.spend)}</td>
                  <td className="r num">{pct(cr.clicks, cr.impressions)}</td>
                  <td className="r num">{pct(cr.saves, cr.reach)}</td>
                  <td className="r num">
                    <b>{cr.preorders}</b>
                  </td>
                  <td className="r num">{cr.preorders ? eur(cr.spend / cr.preorders) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mk-pair" data-dim={!done}>
        <Segments title="Markets" rows={r.markets} />
        <Segments title="Age" rows={r.ages} />
      </div>

      <section className="card mk-card" data-dim={!done}>
        <header>
          <h3>
            Comments <span className="muted num">{r.comments.length} read of {int(r.totals.comments)}</span>
          </h3>
        </header>
        <div className="mk-chips">
          <button className="mk-chip" aria-pressed={theme === null} onClick={() => setTheme(null)}>
            All
          </button>
          {themes.map(([id, t]) => (
            <button key={id} className="mk-chip" aria-pressed={theme === id} onClick={() => setTheme(theme === id ? null : id)} data-s={t.sentiment}>
              {t.label} <span className="num muted">{t.n}</span>
            </button>
          ))}
        </div>
        <ul className="mk-comments">
          {r.comments
            .filter((x) => !theme || x.theme === theme)
            .map((x) => (
              <li key={x.id}>
                <span className="mk-lang mono">{x.lang}</span>
                <span className="mk-comment-text">
                  {x.text}
                  <span className="muted">
                    {label(x.creativeId)} · day {x.day} · {x.likes} likes
                  </span>
                </span>
                <span className={`badge ${SENTIMENT[x.sentiment].tone}`}>{SENTIMENT[x.sentiment].label}</span>
              </li>
            ))}
        </ul>
      </section>
    </>
  )
}

/** Pre-orders per day; the days still to come in the replay stay as empty slots. */
function DailyBars({ days, day }: { days: DayResult[]; day: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 150
  const pad = { l: 28, r: 8, t: 10, b: 22 }
  const max = Math.max(4, ...days.map((d) => d.preorders))
  const top = Math.ceil(max / 4) * 4
  const bw = (W - pad.l - pad.r) / days.length
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top)
  const h = hover !== null ? days[hover] : undefined
  return (
    <figure className="mk-chart">
      <figcaption className="caps">Pre-orders per day</figcaption>
      <div className="mk-chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pre-orders per day" onMouseLeave={() => setHover(null)}>
          {[0, top / 2, top].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="mk-grid" />
              <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" className="mk-axis">
                {v}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const x = pad.l + i * bw
            const shown = d.day <= day
            const bh = Math.max(shown && d.preorders ? 2 : 0, H - pad.b - y(d.preorders))
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)}>
                <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
                {shown ? (
                  <path d={roundTop(x + bw * 0.18, H - pad.b - bh, bw * 0.64, bh, 3)} className="mk-bar" data-on={hover === i} />
                ) : (
                  <rect x={x + bw * 0.18} y={H - pad.b - 2} width={bw * 0.64} height={2} className="mk-bar-empty" />
                )}
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="mk-axis">
                  {d.day}
                </text>
              </g>
            )
          })}
        </svg>
        {h && h.day <= day && (
          <div className="mk-tip" style={{ left: `${((pad.l + (hover! + 0.5) * bw) / W) * 100}%` }}>
            <b>Day {h.day}</b>
            <span>
              {h.preorders} pre-orders · {int(h.sessions)} visits
            </span>
            <span>
              {eur(h.spend)} spent · {int(h.saves)} saves
            </span>
          </div>
        )}
      </div>
    </figure>
  )
}

/** Bar with rounded top corners and a square base on the axis. */
function roundTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

function Segments({ title, rows }: { title: string; rows: SegmentResult[] }) {
  const conv = (s: SegmentResult) => (s.sessions ? s.preorders / s.sessions : 0)
  const max = Math.max(...rows.map(conv), 0.0001)
  return (
    <section className="card mk-card">
      <header>
        <h3>{title}</h3>
        <span className="muted">pre-order conversion</span>
      </header>
      <ul className="mk-bars">
        {rows.map((s) => (
          <li key={s.id} title={`${s.preorders} pre-orders from ${int(s.sessions)} visits · ${eur(s.spend)}`}>
            <span>{s.label}</span>
            <span className="mk-track">
              <span style={{ width: `${(conv(s) / max) * 100}%` }} />
            </span>
            <span className="num">{pct(s.preorders, s.sessions)}</span>
            <span className="num muted">{s.preorders} pcs</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
