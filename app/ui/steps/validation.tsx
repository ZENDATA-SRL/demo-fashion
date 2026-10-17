"use client"

import { useState } from "react"
import type { ArchiveLaunch, CampaignAnalysis, Forecast } from "@/lib/campaign-types"
import { running } from "@/lib/steps"
import { JobBanner } from "../bench"
import { Hint, Icon } from "../kit"
import { StepHead, useWs } from "../workspace"
import { eur, int } from "./campaign"

const VERDICT = {
  go: { label: "GO", tone: "ok", text: "Si produce" },
  iterate: { label: "ITERARE", tone: "warn", text: "Si corregge e si ritesta" },
  stop: { label: "STOP", tone: "bad", text: "Non si produce" },
} as const
const AREA: Record<CampaignAnalysis["actions"][number]["area"], string> = {
  design: "Design",
  creative: "Contenuti",
  audience: "Pubblico",
  production: "Produzione",
  pricing: "Prezzo",
}
const SENT = { positive: ["ok", "positivo"], neutral: ["outline", "neutro"], negative: ["bad", "critico"] } as const
const p0 = (v: number) => `${Math.round(v * 100)}%`
const p1 = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`
const n2 = (v: number) => v.toFixed(2).replace(".", ",")

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
            {a ? "Rianalizza" : "Analizza con AI"}
          </button>
        }
      />
      <JobBanner target="campaign-analysis" />
      <div className="mk-scroll fill scroll">
        <section className="card mk-verdict" data-t={v.tone}>
          <div className="mk-verdict-badge">
            <span className="caps">Decisione</span>
            <b>{v.label}</b>
            <span>{v.text}</span>
          </div>
          <div className="mk-verdict-body">
            <p className="mk-headline">{a?.headline ?? f.reasons[0]}</p>
            <ul>
              {f.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
              {aiDiffers && <li>L&apos;analisi AI suggerisce invece «{VERDICT[a.verdict].label}»: vedi la sintesi.</li>}
            </ul>
          </div>
          <div className="mk-verdict-qty">
            <span className="caps">Da ordinare</span>
            <b className="num">{int(f.order.quantity)}</b>
            <span className="muted">pezzi · MOQ {f.order.moq}</span>
          </div>
        </section>

        <div className="mk-grid2">
          <ForecastCard f={f} />
          <ScatterCard f={f} archive={ws.market.archive} />
        </div>

        <ImpactCard />

        {a ? (
          <AnalysisCard a={a} />
        ) : (
          <div className="empty">
            <h3>{busy ? "Leggo numeri, previsione e commenti…" : "La lettura del test"}</h3>
            <p>Un LLM su Amazon Bedrock legge i numeri, la previsione e i commenti in quattro lingue, e propone cosa cambiare nel design, nei contenuti e nell&apos;ordine.</p>
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
          Previsione
          <span className="badge outline">statistica, non LLM</span>
        </h3>
        <Hint align="right">
          Sell-through: regressione lineare (minimi quadrati) sui {st.n} lanci passati del brand. Domanda: pre-ordini per €1.000 di media × moltiplicatore storico,
          log-normale. Quantità: newsvendor, il quantile della domanda dove un pezzo mancante costa quanto uno invenduto. Lo storico è simulato.
        </Hint>
      </header>

      <div className="mk-metric">
        <span className="caps">Sell-through a prezzo pieno, 8 settimane</span>
        <b className="num">{p1(st.predicted)}</b>
        <div className="mk-range" aria-label={`Intervallo 80% da ${p1(st.low)} a ${p1(st.high)}, obiettivo ${p0(st.target)}`}>
          <span className="mk-range-band" style={{ left: at(st.low), width: `calc(${at(st.high)} - ${at(st.low)})` }} />
          <span className="mk-range-dot" style={{ left: at(st.predicted) }} />
          <span className="mk-range-target" style={{ left: at(st.target) }}>
            <i>obiettivo {p0(st.target)}</i>
          </span>
        </div>
        <span className="muted num">
          intervallo 80%: {p1(st.low)} – {p1(st.high)}
        </span>
      </div>

      <code className="mk-formula">
        ST = {n2(st.coef.intercept)} + {st.coef.saveRate.toFixed(3).replace(".", ",")} × save% + {st.coef.conversion.toFixed(3).replace(".", ",")} × conv% · R² {n2(st.r2)}
      </code>

      <table className="mk-table compact">
        <tbody>
          <tr>
            <td>Save rate</td>
            <td className="r num">{n2(f.signals.saveRate)}%</td>
            <td className="r muted num">{f.percentile.saveRate}° percentile</td>
          </tr>
          <tr>
            <td>Conversione al pre-ordine</td>
            <td className="r num">{n2(f.signals.conversion)}%</td>
            <td className="r muted num">{f.percentile.conversion}° percentile</td>
          </tr>
          <tr>
            <td>Pre-ordini per €1.000</td>
            <td className="r num">{f.signals.preordersPer1k.toFixed(1).replace(".", ",")}</td>
            <td className="r muted num">{f.percentile.preordersPer1k}° percentile</td>
          </tr>
          <tr>
            <td>Domanda di stagione</td>
            <td className="r num">{int(f.demand.median)} pz</td>
            <td className="r muted num">
              80%: {int(f.demand.low)}–{int(f.demand.high)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mk-order">
        <div>
          <span className="caps">Ordine consigliato</span>
          <b className="num">{int(f.order.quantity)} pz</b>
          <span className="muted num">
            margine atteso {eur(f.order.expected.margin)} · invenduto {int(f.order.expected.markdownUnits)} pz
          </span>
        </div>
        <div>
          <span className="caps">Ordine abituale del buyer</span>
          <b className="num">{int(f.order.baseline)} pz</b>
          <span className="muted num">
            margine atteso {eur(f.order.baselineExpected.margin)} · invenduto {int(f.order.baselineExpected.markdownUnits)} pz
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
        <h3>Lanci passati</h3>
        <span className="muted">conversione nel test → sell-through reale</span>
      </header>
      <div className="mk-chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Conversione nel test e sell-through dei lanci passati">
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
              {v.toFixed(1).replace(".", ",")}%
            </text>
          ))}
          <text x={(pad.l + W - pad.r) / 2} y={H - 4} textAnchor="middle" className="mk-axis">
            conversione al pre-ordine nel test
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
            questo prodotto
          </text>
        </svg>
        {h && (
          <div className="mk-tip" style={{ left: `${(x(h.test.conversion) / W) * 100}%`, top: `${(y(h.outcome.sellThrough) / H) * 100}%` }}>
            <b>{h.name}</b>
            <span>
              {h.test.conversion.toString().replace(".", ",")}% conv. · save {h.test.saveRate.toString().replace(".", ",")}%
            </span>
            <span>
              {int(h.outcome.produced)} prodotti · ST {p0(h.outcome.sellThrough)}
            </span>
          </div>
        )}
      </div>
      <p className="muted mk-note">La linea tratteggiata è l&apos;obiettivo di sell-through. Il segmento verticale è l&apos;intervallo all&apos;80% della previsione.</p>
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
    { label: "Capitale impegnato prima del segnale", old: eur(atRisk), now: eur(i.ours.mediaEur + i.ours.generationUsd) },
    { label: "Primo segnale dal mercato", old: `${i.traditional.signalWeeks} settimane`, now: `${i.ours.signalDays} giorni` },
    { label: "Dal concept ai contenuti", old: `${i.traditional.weeks} settimane`, now: `${i.ours.machineHours.toFixed(1).replace(".", ",")} ore macchina` },
    { label: "Campioni e shooting", old: eur(i.traditional.cost), now: `$${i.ours.generationUsd.toFixed(2)} di generazioni` },
    { label: "Media per il test", old: "—", now: eur(i.ours.mediaEur) },
  ]
  return (
    <section className="card mk-card">
      <header>
        <h3>Impatto</h3>
        <span className="muted">flusso tradizionale contro questo prototipo</span>
      </header>
      <div className="mk-impact">
        <table className="mk-table">
          <thead>
            <tr>
              <th />
              <th className="r">Tradizionale</th>
              <th className="r">Con il prototipo</th>
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
            <span className="caps">Margine atteso</span>
            <b className="num">{margin >= 0 ? "+" : ""}{eur(margin)}</b>
            <span className="muted">ordinando {int(o.quantity)} pz invece dei {int(o.baseline)} abituali</span>
          </div>
          <div className="mk-kpi">
            <span className="caps">Capitale a rischio</span>
            <b className="num">−{Math.round((1 - (i.ours.mediaEur + i.ours.generationUsd) / atRisk) * 100)}%</b>
            <span className="muted">campioni, shooting e primo ordine impegnati solo dopo il test</span>
          </div>
          <div className="mk-kpi">
            <span className="caps">Vendite perse evitate</span>
            <b className="num">{lost >= 0 ? "" : "−"}{int(Math.abs(lost))} pz</b>
            <span className="muted">rispetto all&apos;ordine abituale</span>
          </div>
        </div>
      </div>
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
          Analisi AI
          <span className="badge outline">{model}</span>
        </h3>
        <span className="muted num">{new Date(a.at).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}</span>
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

      <h4 className="caps">Azioni</h4>
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
          <h4 className="caps">Modifiche al DNA del prodotto</h4>
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
                          <Icon name="check" size={11} /> Nel DNA
                        </>
                      ) : (
                        "Applica"
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
              <div className="grow">DNA aggiornato: la prossima iterazione rigenera il concept e i contenuti con le modifiche, poi si ritesta.</div>
              <button className="btn sm secondary" onClick={() => go("concept")}>
                Al concept <Icon name="right" size={12} />
              </button>
            </div>
          )}
        </>
      )}

      <h4 className="caps">Cosa dicono i commenti</h4>
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
          <h4 className="caps">Rischi</h4>
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
