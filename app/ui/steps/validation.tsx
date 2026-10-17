"use client"

import { useState } from "react"
import type { ArchiveLaunch, CampaignAnalysis, Forecast } from "@/lib/campaign-types"
import { running } from "@/lib/steps"
import { JobBanner } from "../bench"
import { Hint, Icon } from "../kit"
import { StepHead, useWs } from "../workspace"
import { eur, int } from "./campaign"

const VERDICT = {
  go: { label: "GO", tone: "ok", text: "Produce it" },
  iterate: { label: "ITERATE", tone: "warn", text: "Fix it and retest" },
  stop: { label: "STOP", tone: "bad", text: "Don't produce it" },
} as const
const AREA: Record<CampaignAnalysis["actions"][number]["area"], string> = {
  design: "Design",
  creative: "Content",
  audience: "Audience",
  production: "Production",
  pricing: "Pricing",
}
const SENT = { positive: ["ok", "positive"], neutral: ["outline", "neutral"], negative: ["bad", "critical"] } as const
const p0 = (v: number) => `${Math.round(v * 100)}%`
const p1 = (v: number) => `${(v * 100).toFixed(1)}%`
const n2 = (v: number) => v.toFixed(2)
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`

export function ValidationStep() {
  const { ws, act } = useWs()
  const c = ws.market.campaign
  if (!c) return <StepHead />
  const f = c.forecast
  const a = c.analysis
  const busy = running(ws, "campaign-analysis").length > 0
  const v = VERDICT[f.decision]
  const aiDiffers = a && a.verdict !== f.decision

  return (
    <>
      <StepHead
        actions={
          <button className={`btn sm ${a ? "secondary" : "primary"}`} disabled={busy} onClick={() => act({ type: "campaign-analysis" })}>
            {busy ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="spark" size={12} />}
            {a ? "Re-analyse" : "Analyse with AI"}
          </button>
        }
      />
      <JobBanner target="campaign-analysis" />
      <div className="mk-scroll fill scroll">
        <section className="card mk-verdict" data-t={v.tone}>
          <div className="mk-verdict-badge">
            <span className="caps">Decision</span>
            <b>{v.label}</b>
            <span>{v.text}</span>
          </div>
          <div className="mk-verdict-body">
            <p className="mk-headline">{a?.headline ?? f.reasons[0]}</p>
            <ul>
              {f.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
              {aiDiffers && <li>The AI analysis suggests “{VERDICT[a.verdict].label}” instead: see the summary.</li>}
            </ul>
          </div>
          <div className="mk-verdict-qty">
            <span className="caps">To order</span>
            <b className="num">{int(f.order.quantity)}</b>
            <span className="muted">pieces · MOQ {f.order.moq}</span>
          </div>
        </section>

        <div className="mk-grid2">
          <ForecastCard f={f} />
          <ScatterCard f={f} archive={ws.market.archive} />
        </div>

        <ImpactCard />

        {a?.brief && <BriefCard brief={a.brief} />}

        {a ? (
          <AnalysisCard a={a} />
        ) : (
          <div className="empty">
            <h3>{busy ? "Reading numbers, forecast and comments…" : "Reading the test"}</h3>
            <p>Gemma 4 on AMD Token Factory reads the numbers, the forecast and the comments in four languages, and proposes what to change in the design, the content and the order.</p>
          </div>
        )}
      </div>
    </>
  )
}

function ForecastCard({ f }: { f: Forecast }) {
  const st = f.sellThrough
  const at = (x: number) => `${Math.min(100, Math.max(0, ((x - 0.3) / 0.65) * 100))}%`
  return (
    <section className="card mk-card">
      <header>
        <h3>
          Forecast
          <span className="badge outline">statistics, not LLM</span>
        </h3>
        <Hint align="right">
          Sell-through: linear regression (least squares) on the brand&apos;s {st.n} past launches. Demand: pre-orders per €1,000 of media × historical multiplier,
          log-normal. Quantity: newsvendor, the demand quantile where a missing piece costs as much as an unsold one. The history is simulated.
        </Hint>
      </header>

      <div className="mk-metric">
        <span className="caps">Full-price sell-through, 8 weeks</span>
        <b className="num">{p1(st.predicted)}</b>
        <div className="mk-range" aria-label={`80% interval from ${p1(st.low)} to ${p1(st.high)}, target ${p0(st.target)}`}>
          <span className="mk-range-band" style={{ left: at(st.low), width: `calc(${at(st.high)} - ${at(st.low)})` }} />
          <span className="mk-range-dot" style={{ left: at(st.predicted) }} />
          <span className="mk-range-target" style={{ left: at(st.target) }}>
            <i>target {p0(st.target)}</i>
          </span>
        </div>
        <span className="muted num">
          80% interval: {p1(st.low)} – {p1(st.high)}
        </span>
      </div>

      <code className="mk-formula">
        ST = {n2(st.coef.intercept)} + {st.coef.saveRate.toFixed(3)} × save% + {st.coef.conversion.toFixed(3)} × conv% · R² {n2(st.r2)}
      </code>

      <table className="mk-table compact">
        <tbody>
          <tr>
            <td>Save rate</td>
            <td className="r num">{n2(f.signals.saveRate)}%</td>
            <td className="r muted num">{ord(f.percentile.saveRate)} percentile</td>
          </tr>
          <tr>
            <td>Pre-order conversion</td>
            <td className="r num">{n2(f.signals.conversion)}%</td>
            <td className="r muted num">{ord(f.percentile.conversion)} percentile</td>
          </tr>
          <tr>
            <td>Pre-orders per €1,000</td>
            <td className="r num">{f.signals.preordersPer1k.toFixed(1)}</td>
            <td className="r muted num">{ord(f.percentile.preordersPer1k)} percentile</td>
          </tr>
          <tr>
            <td>Season demand</td>
            <td className="r num">{int(f.demand.median)} pcs</td>
            <td className="r muted num">
              80%: {int(f.demand.low)}–{int(f.demand.high)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mk-order">
        <div>
          <span className="caps">Recommended order</span>
          <b className="num">{int(f.order.quantity)} pcs</b>
          <span className="muted num">
            expected margin {eur(f.order.expected.margin)} · unsold {int(f.order.expected.markdownUnits)} pcs
          </span>
        </div>
        <div>
          <span className="caps">Buyer&apos;s usual order</span>
          <b className="num">{int(f.order.baseline)} pcs</b>
          <span className="muted num">
            expected margin {eur(f.order.baselineExpected.margin)} · unsold {int(f.order.baselineExpected.markdownUnits)} pcs
          </span>
        </div>
      </div>
    </section>
  )
}

/** The brand's past launches: test conversion against the sell-through they reached; this product sits at its prediction. */
function ScatterCard({ f, archive }: { f: Forecast; archive: ArchiveLaunch[] }) {
  const [hover, setHover] = useState<string | null>(null)
  const W = 420
  const H = 260
  const pad = { l: 40, r: 12, t: 12, b: 34 }
  const xs = [...archive.map((a) => a.test.conversion), f.signals.conversion]
  const x0 = Math.floor(Math.min(...xs) * 2) / 2
  const x1 = Math.ceil(Math.max(...xs) * 2) / 2
  const y0 = 0.4
  const y1 = 0.9
  const x = (v: number) => pad.l + ((v - x0) / (x1 - x0)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b)
  const xticks = Array.from({ length: Math.round((x1 - x0) / 0.5) + 1 }, (_, i) => x0 + i * 0.5)
  const st = f.sellThrough
  const h = archive.find((a) => a.sku === hover)
  return (
    <section className="card mk-card">
      <header>
        <h3>Past launches</h3>
        <span className="muted">test conversion → actual sell-through</span>
      </header>
      <div className="mk-chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Test conversion and sell-through of past launches">
          {[0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="mk-grid" />
              <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" className="mk-axis">
                {p0(v)}
              </text>
            </g>
          ))}
          {xticks.map((v) => (
            <text key={v} x={x(v)} y={H - pad.b + 14} textAnchor="middle" className="mk-axis">
              {v.toFixed(1)}%
            </text>
          ))}
          <text x={(pad.l + W - pad.r) / 2} y={H - 4} textAnchor="middle" className="mk-axis">
            pre-order conversion in the test
          </text>
          <line x1={pad.l} x2={W - pad.r} y1={y(st.target)} y2={y(st.target)} className="mk-target" />
          {archive.map((a) => (
            <circle
              key={a.sku}
              cx={x(a.test.conversion)}
              cy={y(a.outcome.sellThrough)}
              r={hover === a.sku ? 6 : 4.5}
              className="mk-dot"
              onMouseEnter={() => setHover(a.sku)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
          <line x1={x(f.signals.conversion)} x2={x(f.signals.conversion)} y1={y(st.low)} y2={y(st.high)} className="mk-whisker" />
          <circle cx={x(f.signals.conversion)} cy={y(st.predicted)} r={6.5} className="mk-dot-now" />
          <text
            x={x(f.signals.conversion) + (x(f.signals.conversion) > W * 0.7 ? -12 : 12)}
            y={y(st.predicted) + 4}
            textAnchor={x(f.signals.conversion) > W * 0.7 ? "end" : "start"}
            className="mk-label"
          >
            this product
          </text>
        </svg>
        {h && (
          <div className="mk-tip" style={{ left: `${(x(h.test.conversion) / W) * 100}%`, top: `${(y(h.outcome.sellThrough) / H) * 100}%` }}>
            <b>{h.name}</b>
            <span>
              {h.test.conversion}% conv. · save {h.test.saveRate}%
            </span>
            <span>
              {int(h.outcome.produced)} produced · ST {p0(h.outcome.sellThrough)}
            </span>
          </div>
        )}
      </div>
      <p className="muted mk-note">The dashed line is the sell-through target. The vertical segment is the forecast&apos;s 80% interval.</p>
    </section>
  )
}

function ImpactCard() {
  const { ws } = useWs()
  const c = ws.market.campaign!
  const i = c.impact
  const o = c.forecast.order
  const lost = o.baselineExpected.lostSales - o.expected.lostSales
  const margin = o.expected.margin - o.baselineExpected.margin
  const atRisk = i.traditional.cost + o.baseline * ws.market.economics.unitCost
  const rows = [
    { label: "Capital committed before the signal", old: eur(atRisk), now: eur(i.ours.mediaEur + i.ours.generationUsd) },
    { label: "First market signal", old: `${i.traditional.signalWeeks} weeks`, now: `${i.ours.signalDays} days` },
    { label: "From concept to content", old: `${i.traditional.weeks} weeks`, now: `${i.ours.machineHours.toFixed(1)} machine hours` },
    { label: "Samples and shoots", old: eur(i.traditional.cost), now: `$${i.ours.generationUsd.toFixed(2)} of generations` },
    { label: "Test media", old: "—", now: eur(i.ours.mediaEur) },
  ]
  return (
    <section className="card mk-card">
      <header>
        <h3>Impact</h3>
        <span className="muted">traditional flow versus this prototype</span>
      </header>
      <div className="mk-impact">
        <table className="mk-table">
          <thead>
            <tr>
              <th />
              <th className="r">Traditional</th>
              <th className="r">With the prototype</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="r muted num">{r.old}</td>
                <td className="r num">
                  <b>{r.now}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mk-impact-kpis">
          <div className="mk-kpi">
            <span className="caps">Expected margin</span>
            <b className="num">{margin >= 0 ? "+" : ""}{eur(margin)}</b>
            <span className="muted">ordering {int(o.quantity)} pcs instead of the usual {int(o.baseline)}</span>
          </div>
          <div className="mk-kpi">
            <span className="caps">Capital at risk</span>
            <b className="num">−{Math.round((1 - (i.ours.mediaEur + i.ours.generationUsd) / atRisk) * 100)}%</b>
            <span className="muted">samples, shoots and first order committed only after the test</span>
          </div>
          <div className="mk-kpi">
            <span className="caps">Lost sales avoided</span>
            <b className="num">{lost >= 0 ? "" : "−"}{int(Math.abs(lost))} pcs</b>
            <span className="muted">compared with the usual order</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/** The whole reading in a few bullets, by Evolus: what to take away from the test. */
function BriefCard({ brief }: { brief: NonNullable<CampaignAnalysis["brief"]> }) {
  const lines = brief.text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean)
  return (
    <section className="card mk-card mk-brief">
      <header>
        <h3>
          Summary
          <span className="badge outline">{brief.by}</span>
        </h3>
      </header>
      <ul>
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </section>
  )
}

function AnalysisCard({ a }: { a: CampaignAnalysis }) {
  const { ws, patch, go } = useWs()
  const fields = ws.garment.dna?.fields ?? []
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const model = a.model.replace(/^.*anthropic\./, "").replace(/-/g, " ")
  return (
    <section className="card mk-card mk-ai">
      <header>
        <h3>
          AI analysis
          <span className="badge outline">{model}</span>
        </h3>
        <span className="muted num">{new Date(a.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
      </header>
      <p className="mk-summary">{a.summary}</p>

      <div className="mk-insights">
        {a.insights.map((x) => (
          <div key={x.title}>
            <b>{x.title}</b>
            <span>{x.evidence}</span>
          </div>
        ))}
      </div>

      <h4 className="caps">Actions</h4>
      <ul className="mk-actions">
        {a.actions.map((x) => (
          <li key={x.action}>
            <span className="badge">{AREA[x.area] ?? x.area}</span>
            <div>
              <b>{x.action}</b>
              <span>{x.why}</span>
              <span className="mk-impact-line">
                <Icon name="arrow" size={11} /> {x.impact}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {a.dnaChanges.length > 0 && (
        <>
          <h4 className="caps">Product DNA changes</h4>
          <ul className="mk-dna">
            {a.dnaChanges.map((d) => {
              const field = fields.find((f) => f.key === d.field)
              const done = applied.has(d.field) || field?.value === d.to
              return (
                <li key={d.field}>
                  <div>
                    <b>{field?.label ?? d.field}</b>
                    {field && <s className="muted">{field.value}</s>}
                    <span>{d.to}</span>
                    <span className="muted">{d.why}</span>
                  </div>
                  {field && (
                    <button
                      className={`btn sm ${done ? "ghost" : "secondary"}`}
                      disabled={done}
                      onClick={async () => {
                        await patch({ field: { key: d.field, value: d.to } })
                        setApplied((s) => new Set(s).add(d.field))
                      }}
                    >
                      {done ? (
                        <>
                          <Icon name="check" size={11} /> In the DNA
                        </>
                      ) : (
                        "Apply"
                      )}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {applied.size > 0 && (
            <div className="banner">
              <Icon name="info" />
              <div className="grow">DNA updated: the next iteration regenerates the concept and the content with the changes, then retests.</div>
              <button className="btn sm secondary" onClick={() => go("concept")}>
                To the concept <Icon name="right" size={12} />
              </button>
            </div>
          )}
        </>
      )}

      <h4 className="caps">What the comments say</h4>
      <ul className="mk-themes">
        {a.themes.map((t) => (
          <li key={t.theme}>
            <span className={`badge ${SENT[t.sentiment][0]}`}>{SENT[t.sentiment][1]}</span>
            <b>{t.label}</b>
            <span className="num muted">{Math.round(t.share * 100)}%</span>
            <q>{t.quote}</q>
            <span>{t.action}</span>
          </li>
        ))}
      </ul>

      {a.risks.length > 0 && (
        <>
          <h4 className="caps">Risks</h4>
          <ul className="mk-risks">
            {a.risks.map((r) => (
              <li key={r}>
                <Icon name="alert" size={12} /> {r}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
