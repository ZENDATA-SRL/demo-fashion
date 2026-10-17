import type { ArchiveLaunch, CampaignResult, Forecast, Impact } from "../campaign-types"
import type { Garment } from "../types"

export const CAMPAIGN_SYSTEM = `You are the head of merchandising at an Italian fashion and accessories house. You read the results of a market test run
with generated content (no physical sample exists yet) and decide what to do with the product.

Rules:
- The numeric forecast (sell-through, demand, quantity) is already computed with classical statistics on past launches: do not recompute it and
  do not invent another one. You may interpret it, say how solid it is and where the interval is wide.
- Every claim cites a number from the data provided (rate, count, share) or a sentence from the comments.
- "verdict" follows the statistical decision, unless the comments give strong reasons not to; in that case explain them in "summary".
- Comments come in several languages: group them by theme and quote the most representative one in its original language.
- Actions are concrete and doable within the next iteration: a design change (which goes back into the product DNA), which
  content to scale or cut, which audience to focus the budget on, how many units to order from the manufacturer, price.
- "dnaChanges" proposes changes to product DNA fields only when the comments justify them, using the existing field key.
- Write in English, short sentences, no marketing hype.

JSON schema:
{
  "verdict": "go" | "iterate" | "stop",
  "headline": "one sentence: the decision and why",
  "summary": "3-4 sentences",
  "insights": [{ "title": "...", "evidence": "the figure that proves it" }],
  "themes": [{ "theme": "theme id", "label": "...", "sentiment": "positive" | "neutral" | "negative", "share": 0-1, "quote": "...", "action": "..." }],
  "actions": [{ "area": "design" | "creative" | "audience" | "production" | "pricing", "action": "...", "why": "...", "impact": "expected effect, with a number" }],
  "dnaChanges": [{ "field": "DNA field key", "to": "new value", "why": "..." }],
  "risks": ["..."]
}
3-5 insights, one theme for each theme present in the comments, 4-6 actions.`

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`
const rate = (n: number, of: number) => (of ? pct(n / of, 2) : "—")

export function campaignPrompt(input: {
  garment: Garment
  result: CampaignResult
  forecast: Forecast
  impact: Impact
  archive: ArchiveLaunch[]
  themeLabel: (id: string) => string
}): string {
  const { garment, result, forecast: f, impact, archive, themeLabel } = input
  const t = result.totals
  const row = (label: string, x: typeof t) =>
    `- ${label}: spend €${x.spend.toFixed(0)}, reach ${x.reach}, CTR ${rate(x.clicks, x.impressions)}, save ${rate(x.saves, x.reach)}, sessions ${x.sessions}, pre-orders ${x.preorders} (conv. ${rate(x.preorders, x.sessions)}), waitlist ${x.waitlist}`
  const themes = new Map<string, number>()
  for (const c of result.comments) themes.set(c.theme, (themes.get(c.theme) ?? 0) + 1)

  return `PRODUCT
${garment.name} (${garment.sku}), ${garment.maison}. Pre-order price €${result.plan.price}.
Brief: ${garment.brief}
DNA: ${garment.dna?.summary ?? "—"}
DNA fields: ${(garment.dna?.fields ?? []).filter((x) => x.value !== "none").map((x) => `${x.key}=${x.value}`).join("; ")}

TEST PLAN
Budget €${result.plan.budget} over ${result.plan.days} days, channels ${result.plan.channels.join(", ")}, markets ${result.plan.markets.join(", ")}.

TOTALS
${row("Total", t)}
Likes ${t.likes}, comments ${t.comments}, shares ${t.shares}, impressions ${t.impressions}.

BY CONTENT
${result.creatives.map((c) => row(`${c.label} [${c.type}, ${c.channels.join("+")}]`, c)).join("\n")}

BY MARKET
${result.markets.map((m) => row(m.label, m)).join("\n")}

BY AGE
${result.ages.map((a) => row(a.label, a)).join("\n")}

DAILY TREND (pre-orders)
${result.days.map((d) => `d${d.day}: ${d.preorders} pre-orders, ${d.sessions} sessions, €${d.spend.toFixed(0)}`).join("; ")}

STATISTICAL FORECAST (already computed, not by an LLM)
- Full-price sell-through at 8 weeks: ${pct(f.sellThrough.predicted)} (80% interval: ${pct(f.sellThrough.low)}–${pct(f.sellThrough.high)}), target ${pct(f.sellThrough.target, 0)}.
  Linear regression on ${f.sellThrough.n} past launches of the same product family: ST = ${f.sellThrough.coef.intercept.toFixed(3)} + ${f.sellThrough.coef.saveRate.toFixed(3)}×save rate% + ${f.sellThrough.coef.conversion.toFixed(3)}×conversion%, R² ${f.sellThrough.r2.toFixed(2)}.
- Signals: save rate ${f.signals.saveRate.toFixed(2)}% (percentile ${f.percentile.saveRate} in the archive), conversion ${f.signals.conversion.toFixed(2)}% (percentile ${f.percentile.conversion}), pre-orders per €1k ${f.signals.preordersPer1k.toFixed(1)} (percentile ${f.percentile.preordersPer1k}).
- Season demand: median ${f.demand.median} units (80%: ${f.demand.low}–${f.demand.high}), historical multiplier ${f.demand.multiplier.toFixed(1)}× pre-orders per €1k.
- Recommended quantity (newsvendor, critical ratio ${f.order.criticalRatio.toFixed(2)}): ${f.order.quantity} units. Manufacturer MOQ ${f.order.moq}.
  Expected margin €${f.order.expected.margin}, expected unsold ${f.order.expected.markdownUnits} units, lost sales ${f.order.expected.lostSales} units.
  The buyer's usual order (archive average ${f.order.baseline} units): margin €${f.order.baselineExpected.margin}, unsold ${f.order.baselineExpected.markdownUnits} units.
- Statistical decision: ${f.decision.toUpperCase()}. ${f.reasons.join(". ")}.

COST AND TIME
Traditional flow: ${impact.traditional.weeks} weeks and €${impact.traditional.cost} for samples and shoot, first market signal after ${impact.traditional.signalWeeks} weeks.
Here: $${impact.ours.generationUsd.toFixed(2)} of generations, ${impact.ours.machineHours.toFixed(1)} machine hours, €${impact.ours.mediaEur.toFixed(0)} of media, signal in ${impact.ours.signalDays} days.

PAST LAUNCHES OF THE SAME FAMILY (archive)
${archive.map((a) => `- ${a.name} (${a.category}, €${a.price}): save ${a.test.saveRate}%, conv ${a.test.conversion}%, produced ${a.outcome.produced}, sold at full price ${a.outcome.soldFullPrice}, ST ${pct(a.outcome.sellThrough, 0)}`).join("\n")}

COMMENTS (sample of ${result.comments.length} out of ${t.comments}; themes: ${[...themes].map(([k, n]) => `${themeLabel(k)} ${n}`).join(", ")})
${result.comments.map((c) => `- [${c.market}, ${c.theme}, ${c.likes} likes] ${c.text}`).join("\n")}`
}
