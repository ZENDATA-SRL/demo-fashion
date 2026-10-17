import type { ArchiveLaunch, CampaignResult, Forecast, Impact } from "../campaign-types"
import type { Garment } from "../types"

export const CAMPAIGN_SYSTEM = `Sei il responsabile merchandising di una maison italiana di pelletteria. Leggi i risultati di un test di mercato fatto
con contenuti generati (nessun campione fisico esiste ancora) e decidi cosa fare del prodotto.

Regole:
- La previsione numerica (sell-through, domanda, quantità) è già calcolata con statistica classica sui lanci passati: non ricalcolarla e non
  inventarne un'altra. Puoi interpretarla, dire quanto è solida e dove l'intervallo è largo.
- Ogni affermazione cita un numero dei dati forniti (tasso, conteggio, quota) o una frase dei commenti.
- "verdict" segue la decisione statistica, salvo motivi forti nei commenti; in quel caso spiegali in "summary".
- I commenti sono in più lingue: raggruppali per tema e riporta la citazione più rappresentativa nella lingua originale.
- Le azioni sono concrete ed eseguibili entro la prossima iterazione: modifica al design (che torna nel DNA del prodotto), quale
  contenuto scalare o tagliare, su quale pubblico concentrare il budget, quanti pezzi ordinare al produttore, prezzo.
- "dnaChanges" propone modifiche ai campi del DNA del prodotto solo se i commenti le giustificano, con il nome del campo esistente.
- Scrivi in italiano, frasi brevi, niente enfasi da marketing.

Schema JSON:
{
  "verdict": "go" | "iterate" | "stop",
  "headline": "una frase, la decisione e il perché",
  "summary": "3-4 frasi",
  "insights": [{ "title": "...", "evidence": "il dato che lo dimostra" }],
  "themes": [{ "theme": "id del tema", "label": "...", "sentiment": "positive" | "neutral" | "negative", "share": 0-1, "quote": "...", "action": "..." }],
  "actions": [{ "area": "design" | "creative" | "audience" | "production" | "pricing", "action": "...", "why": "...", "impact": "effetto atteso, con un numero" }],
  "dnaChanges": [{ "field": "chiave del campo DNA", "to": "nuovo valore", "why": "..." }],
  "risks": ["..."]
}
3-5 insights, un tema per ogni tema presente nei commenti, 4-6 azioni.`

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
    `- ${label}: spesa €${x.spend.toFixed(0)}, reach ${x.reach}, CTR ${rate(x.clicks, x.impressions)}, save ${rate(x.saves, x.reach)}, sessioni ${x.sessions}, pre-ordini ${x.preorders} (conv. ${rate(x.preorders, x.sessions)}), lista d'attesa ${x.waitlist}`
  const themes = new Map<string, number>()
  for (const c of result.comments) themes.set(c.theme, (themes.get(c.theme) ?? 0) + 1)

  return `PRODOTTO
${garment.name} (${garment.sku}), ${garment.maison}. Prezzo di pre-ordine €${result.plan.price}.
Brief: ${garment.brief}
DNA: ${garment.dna?.summary ?? "—"}
Campi DNA: ${(garment.dna?.fields ?? []).filter((x) => x.value !== "none").map((x) => `${x.key}=${x.value}`).join("; ")}

PIANO DEL TEST
Budget €${result.plan.budget} in ${result.plan.days} giorni, canali ${result.plan.channels.join(", ")}, mercati ${result.plan.markets.join(", ")}.

RISULTATI TOTALI
${row("Totale", t)}
Like ${t.likes}, commenti ${t.comments}, condivisioni ${t.shares}, impression ${t.impressions}.

PER CONTENUTO
${result.creatives.map((c) => row(`${c.label} [${c.type}, ${c.channels.join("+")}]`, c)).join("\n")}

PER MERCATO
${result.markets.map((m) => row(m.label, m)).join("\n")}

PER ETÀ
${result.ages.map((a) => row(a.label, a)).join("\n")}

ANDAMENTO GIORNALIERO (pre-ordini)
${result.days.map((d) => `g${d.day}: ${d.preorders} pre-ordini, ${d.sessions} sessioni, €${d.spend.toFixed(0)}`).join("; ")}

PREVISIONE STATISTICA (già calcolata, non LLM)
- Sell-through a prezzo pieno a 8 settimane: ${pct(f.sellThrough.predicted)} (intervallo 80%: ${pct(f.sellThrough.low)}–${pct(f.sellThrough.high)}), obiettivo ${pct(f.sellThrough.target, 0)}.
  Regressione lineare su ${f.sellThrough.n} lanci passati: ST = ${f.sellThrough.coef.intercept.toFixed(3)} + ${f.sellThrough.coef.saveRate.toFixed(3)}×save rate% + ${f.sellThrough.coef.conversion.toFixed(3)}×conversione%, R² ${f.sellThrough.r2.toFixed(2)}.
- Segnali: save rate ${f.signals.saveRate.toFixed(2)}% (percentile ${f.percentile.saveRate} sull'archivio), conversione ${f.signals.conversion.toFixed(2)}% (percentile ${f.percentile.conversion}), pre-ordini per €1k ${f.signals.preordersPer1k.toFixed(1)} (percentile ${f.percentile.preordersPer1k}).
- Domanda di stagione: mediana ${f.demand.median} pezzi (80%: ${f.demand.low}–${f.demand.high}), moltiplicatore storico ${f.demand.multiplier.toFixed(1)}× pre-ordini per €1k.
- Quantità consigliata (newsvendor, rapporto critico ${f.order.criticalRatio.toFixed(2)}): ${f.order.quantity} pezzi. MOQ produttore ${f.order.moq}.
  Margine atteso €${f.order.expected.margin}, invenduto atteso ${f.order.expected.markdownUnits} pz, vendite perse ${f.order.expected.lostSales} pz.
  Ordine abituale del buyer (media archivio ${f.order.baseline} pz): margine €${f.order.baselineExpected.margin}, invenduto ${f.order.baselineExpected.markdownUnits} pz.
- Decisione statistica: ${f.decision.toUpperCase()}. ${f.reasons.join(". ")}.

COSTO E TEMPO
Flusso tradizionale: ${impact.traditional.weeks} settimane e €${impact.traditional.cost} tra campioni e shooting, primo segnale dal mercato dopo ${impact.traditional.signalWeeks} settimane.
Qui: $${impact.ours.generationUsd.toFixed(2)} di generazioni, ${impact.ours.machineHours.toFixed(1)} ore macchina, €${impact.ours.mediaEur.toFixed(0)} di media, segnale in ${impact.ours.signalDays} giorni.

LANCI PASSATI SIMILI (archivio)
${archive.map((a) => `- ${a.name} (${a.category}, €${a.price}): save ${a.test.saveRate}%, conv ${a.test.conversion}%, prodotti ${a.outcome.produced}, venduti a prezzo pieno ${a.outcome.soldFullPrice}, ST ${pct(a.outcome.sellThrough, 0)}`).join("\n")}

COMMENTI (campione di ${result.comments.length} su ${t.comments}; temi: ${[...themes].map(([k, n]) => `${themeLabel(k)} ${n}`).join(", ")})
${result.comments.map((c) => `- [${c.market}, ${c.theme}, ${c.likes} like] ${c.text}`).join("\n")}`
}
