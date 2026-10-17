import market from "../data/market.json"
import type {
  ArchiveLaunch,
  Campaign,
  CampaignAnalysis,
  CampaignComment,
  CampaignPlan,
  CampaignResult,
  ChannelId,
  CreativeResult,
  CreativeSpec,
  CreativeType,
  DayResult,
  Forecast,
  Funnel,
  Impact,
  MarketId,
  SegmentResult,
  Sentiment,
} from "./campaign-types"
import { askJsonWith } from "./generate"
import { getGarment } from "./garment"
import { evolusReady, evolusText } from "./providers/evolus"
import { bedrockModelId } from "./providers/text"
import { CAMPAIGN_SYSTEM, campaignPrompt } from "./prompts/campaign"
import { STUDIO_LOOKS } from "./prompts/studio"
import { UGC_FORMATS } from "./prompts/ugc"
import { CAST_ID, updateDb } from "./store"
import type { Asset, Garment } from "./types"

/**
 * The market test of a garment, before any physical sample exists.
 *
 * 1. `simulateCampaign` runs the approved content as paid social ads for a few days. The audience is simulated: a seeded
 *    funnel model (CPM → impressions → clicks → pre-order page → pre-orders) with per-creative, per-market and
 *    per-age rates taken from data/market.json. Same garment and plan, same numbers.
 * 2. `forecastFrom` turns the test signals into a production decision with plain statistics on the brand's past
 *    launches (also simulated, in data/market.json): a linear regression for the sell-through, a log-normal demand
 *    multiplier for the units, and the newsvendor quantile for how many to make. No language model in this part.
 * 3. `analyzeCampaign` hands numbers, forecast and comments to the text model, which explains them and proposes actions.
 */

const ARCHIVE = market.archive as ArchiveLaunch[]
const ECON = market.economics
const CHANNELS = market.channels as Record<ChannelId, { label: string; cpm: number; frequency: number }>
const MARKETS = market.markets as Record<MarketId, { label: string; lang: string; cpm: number; intent: number }>
const TYPES = market.creativeTypes as Record<CreativeType, { label: string; channels: ChannelId[]; ctr: number; save: number; er: number; conv: number }>
const COMMENTS = market.comments as Record<string, { sentiment: Sentiment; label: string; text: Record<string, string[]> }>
type Product = { price: number; appeal: number; themes: Record<string, number>; family?: ArchiveLaunch["family"] }
const PRODUCTS = market.products as Record<string, Product>

export const CHANNEL_IDS = Object.keys(CHANNELS) as ChannelId[]
export const MARKET_IDS = Object.keys(MARKETS) as MarketId[]
export const channelLabel = (id: ChannelId) => CHANNELS[id].label
export const marketLabel = (id: MarketId) => MARKETS[id].label
export const themeLabel = (id: string) => COMMENTS[id]?.label ?? id
export const themeLabels = () => Object.fromEntries(Object.entries(COMMENTS).map(([id, c]) => [id, c.label]))

export function defaultPlan(garment: Garment): CampaignPlan {
  return { budget: 2500, days: 10, channels: [...CHANNEL_IDS], markets: [...MARKET_IDS], price: productOf(garment).price }
}

function productOf(garment: Garment): Product {
  const known = PRODUCTS[garment.sku]
  if (known) return known
  const r = rng(hash(garment.id))
  return { price: ECON.defaultPrice, appeal: 0.85 + r() * 0.3, themes: market.defaultThemes }
}

// ---------------------------------------------------------------- random

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** mulberry32: small, fast and the same on every machine */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r())

/** Binomial draw: Poisson for rare events, normal approximation otherwise. */
function draw(r: () => number, n: number, p: number): number {
  const mean = n * p
  if (mean <= 0) return 0
  if (mean < 30) {
    const l = Math.exp(-mean)
    let k = 0
    let prod = r()
    while (prod > l) {
      k++
      prod *= r()
    }
    return k
  }
  return Math.max(0, Math.round(mean + gauss(r) * Math.sqrt(mean * (1 - p))))
}

const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)]

function weighted<K extends string>(r: () => number, weights: Record<K, number>): K {
  const entries = Object.entries(weights) as Array<[K, number]>
  const total = entries.reduce((t, [, w]) => t + w, 0)
  let x = r() * total
  for (const [k, w] of entries) if ((x -= w) <= 0) return k
  return entries[entries.length - 1][0]
}

// ---------------------------------------------------------------- creatives

/** The ads of the test: what the garment has approved, one per reel and editorial look, one of each other kind. */
export function creativesOf(assets: Asset[]): CreativeSpec[] {
  const ok = assets.filter((a) => a.status === "approved" && a.garmentId !== CAST_ID)
  const spec = (a: Asset, type: CreativeType, label: string): CreativeSpec => ({ id: `cr_${a.id}`, assetId: a.id, type, label, channels: TYPES[type].channels })
  const first = (kind: Asset["kind"]) => ok.filter((a) => a.kind === kind).at(-1)
  const out: CreativeSpec[] = []
  for (const a of ok.filter((x) => x.kind === "ugc-video")) {
    const format = UGC_FORMATS.find((f) => f.id === (a.label ?? "").split(":")[0])
    out.push(spec(a, "ugc", `UGC reel · ${format?.label ?? "creator"}`))
  }
  for (const a of ok.filter((x) => x.kind === "lookbook")) {
    out.push(spec(a, "editorial", `Editorial · ${STUDIO_LOOKS.find((l) => l.id === a.label)?.label ?? a.label ?? "look"}`))
  }
  const onModel = first("on-model")
  if (onModel) out.push(spec(onModel, "onmodel", "On-model"))
  const scene = first("scene")
  if (scene) out.push(spec(scene, "lifestyle", "Lifestyle"))
  const front = first("ghost-front")
  if (front) out.push(spec(front, "packshot", "Packshot carousel"))
  return out
}

// ---------------------------------------------------------------- simulation

const zero = (): Funnel => ({ spend: 0, impressions: 0, reach: 0, likes: 0, comments: 0, saves: 0, shares: 0, clicks: 0, sessions: 0, waitlist: 0, preorders: 0 })

const FUNNEL_KEYS = Object.keys(zero()) as Array<keyof Funnel>

/** Adds the funnel counts only, so a day or a segment keeps its own id. */
function add(into: Funnel, f: Funnel) {
  for (const k of FUNNEL_KEYS) into[k] += f[k]
}

/** Base rates of the brand's paid social, before the creative, market, age and product multipliers. */
const BASE = { ctr: 0.0085, save: 0.028, like: 0.045, comment: 0.0025, share: 0.004, landing: 0.8, waitlist: 0.055, conv: 0.0125 }

export function simulateCampaign(garment: Garment, assets: Asset[], plan: CampaignPlan): CampaignResult {
  const creatives = creativesOf(assets)
  if (!creatives.length) throw new Error("Approved content is needed to launch the test")
  const channels = plan.channels.filter((c) => c in CHANNELS)
  const markets = plan.markets.filter((m) => m in MARKETS)
  if (!channels.length || !markets.length) throw new Error("Pick at least one channel and one market")

  const seed = hash(`${garment.id}|${JSON.stringify(plan)}`)
  const r = rng(seed)
  const product = productOf(garment)
  const appeal = product.appeal
  const priceFactor = Math.pow(product.price / plan.price, 1.2)
  // each creative is a little better or worse than its type, for the whole test
  const luck = new Map(creatives.map((c) => [c.id, Math.exp(gauss(r) * 0.16)]))
  const live = creatives.map((c) => ({ ...c, channels: c.channels.filter((ch) => channels.includes(ch)) })).filter((c) => c.channels.length)
  if (!live.length) throw new Error("No content suits the chosen channels")

  const byCreative = new Map(live.map((c) => [c.id, zero()]))
  const byMarket = new Map(markets.map((m) => [m, zero()]))
  const byAge = new Map(market.ages.map((a) => [a.id, zero()]))
  const days: DayResult[] = []
  const commentsBy: Array<{ creativeId: string; market: MarketId; day: number; n: number }> = []
  const daily = plan.budget / plan.days

  for (let day = 1; day <= plan.days; day++) {
    // the ad platform shifts budget towards what converts from day 3, like automatic placement does
    const score = live.map((c) => {
      const f = byCreative.get(c.id)!
      return day <= 2 ? 1 : Math.pow(1 + f.preorders * 4 + f.clicks * 0.02, 0.6)
    })
    const total = score.reduce((t, s) => t + s, 0)
    const today = { ...zero(), day }
    live.forEach((c, ci) => {
      const t = TYPES[c.type]
      const share = 0.5 / live.length + (0.5 * score[ci]) / total
      const fatigue = Math.max(0.6, 1 - 0.028 * (day - 1))
      for (const ch of c.channels) {
        for (const m of markets) {
          for (const age of market.ages) {
            const spend = (daily * share * age.share) / c.channels.length / markets.length
            const impressions = Math.round((spend / (CHANNELS[ch].cpm * MARKETS[m].cpm)) * 1000 * (0.9 + r() * 0.2))
            const reach = Math.round(impressions / CHANNELS[ch].frequency)
            const k = luck.get(c.id)!
            const clicks = draw(r, impressions, BASE.ctr * t.ctr * Math.sqrt(appeal) * fatigue * k * (age.id === "18-24" ? 1.2 : 1))
            const sessions = draw(r, clicks, BASE.landing)
            const f: Funnel = {
              spend,
              impressions,
              reach,
              likes: draw(r, reach, BASE.like * t.er * appeal * k),
              comments: draw(r, reach, BASE.comment * t.er * appeal),
              saves: draw(r, reach, BASE.save * t.save * appeal * k),
              shares: draw(r, reach, BASE.share * t.er * appeal),
              clicks,
              sessions,
              waitlist: draw(r, sessions, BASE.waitlist * appeal),
              preorders: draw(r, sessions, Math.min(0.2, BASE.conv * t.conv * appeal * MARKETS[m].intent * age.intent * priceFactor * k)),
            }
            add(byCreative.get(c.id)!, f)
            add(byMarket.get(m)!, f)
            add(byAge.get(age.id)!, f)
            add(today, f)
            if (f.comments) commentsBy.push({ creativeId: c.id, market: m, day, n: f.comments })
          }
        }
      }
    })
    days.push(today)
  }

  const totals = zero()
  for (const d of days) add(totals, d)
  const round = <T extends Funnel>(f: T): T => ({ ...f, spend: Math.round(f.spend * 100) / 100 })

  return {
    plan,
    seed,
    ranAt: new Date().toISOString(),
    totals: round(totals),
    days: days.map(round),
    creatives: live.map((c): CreativeResult => round({ ...c, ...byCreative.get(c.id)! })),
    markets: markets.map((m): SegmentResult => round({ id: m, label: MARKETS[m].label, ...byMarket.get(m)! })),
    ages: market.ages.map((a): SegmentResult => round({ id: a.id, label: a.id, ...byAge.get(a.id)! })),
    comments: sampleComments(r, commentsBy, product.themes, 60),
  }
}

/** A readable sample of what people wrote: themes by the product's weights, languages by where the comments came from. */
function sampleComments(r: () => number, by: Array<{ creativeId: string; market: MarketId; day: number; n: number }>, themes: Record<string, number>, max: number): CampaignComment[] {
  const total = by.reduce((t, c) => t + c.n, 0)
  if (!total) return []
  const out: CampaignComment[] = []
  const used = new Set<string>()
  for (let i = 0; i < Math.min(max, total); i++) {
    let x = r() * total
    const cell = by.find((c) => (x -= c.n) <= 0) ?? by[by.length - 1]
    const theme = weighted(r, themes)
    const lang = MARKETS[cell.market].lang
    const pool = COMMENTS[theme]?.text[lang] ?? COMMENTS[theme]?.text.en ?? []
    const fresh = pool.filter((t) => !used.has(t))
    const text = pick(r, fresh.length ? fresh : pool)
    if (!text) continue
    used.add(text)
    out.push({ id: `c${i}`, creativeId: cell.creativeId, market: cell.market, lang, theme, sentiment: COMMENTS[theme].sentiment, text, likes: Math.floor(Math.pow(r(), 3) * 140), day: cell.day })
  }
  return out.sort((a, b) => b.likes - a.likes)
}

// ---------------------------------------------------------------- forecast

const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length
const sd = (xs: number[]) => Math.sqrt(xs.reduce((t, x) => t + (x - mean(xs)) ** 2, 0) / (xs.length - 1))
const percentile = (xs: number[], v: number) => Math.round((xs.filter((x) => x < v).length / xs.length) * 100)

function inverse3(m: number[][]): number[][] {
  const [[a, b, c], [d, e, f], [g, h, i]] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ]
}

/** Inverse standard normal CDF (Acklam), enough digits for a quantile. */
function zOf(p: number): number {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924]
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857]
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878]
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742]
  const lo = 0.02425
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > 1 - lo) return -zOf(1 - p)
  const q = p - 0.5
  const r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

/** Expected margin, unsold units and lost sales of making `q` units against a log-normal demand, by quadrature. */
function outcomeOf(q: number, median: number, sigma: number, price: number) {
  let margin = 0
  let markdown = 0
  let lost = 0
  const n = 400
  for (let i = 0; i < n; i++) {
    const demand = median * Math.exp(sigma * zOf((i + 0.5) / n))
    const sold = Math.min(q, demand)
    margin += sold * price + (q - sold) * ECON.salvage - q * ECON.unitCost
    markdown += q - sold
    lost += Math.max(0, demand - q)
  }
  return { margin: Math.round(margin / n), markdownUnits: Math.round(markdown / n), lostSales: Math.round(lost / n) }
}

/** Leather goods or knitwear, from the product's entry in data/market.json; unknown products count as leather goods. */
export const familyOf = (sku: string): ArchiveLaunch["family"] => PRODUCTS[sku]?.family ?? "leather"

/** The past launches a product is read against: its own family, so a cardigan is not forecast on bags. */
export const archiveFor = (family: ArchiveLaunch["family"]) => ARCHIVE.filter((a) => a.family === family)

/** Student t at 0.90 by degrees of freedom: the half-width of an 80% prediction interval on a small archive. */
const T90 = [3.078, 1.886, 1.638, 1.533, 1.476, 1.44, 1.415, 1.397, 1.383, 1.372, 1.363, 1.356, 1.35, 1.345, 1.341]
const t90 = (df: number) => T90.at(Math.min(df, T90.length) - 1) ?? 1.282

export function forecastFrom(result: CampaignResult, family: ArchiveLaunch["family"] = "leather"): Forecast {
  const past = archiveFor(family)
  const t = result.totals
  const signals = {
    saveRate: (t.saves / Math.max(1, t.reach)) * 100,
    conversion: (t.preorders / Math.max(1, t.sessions)) * 100,
    ctr: (t.clicks / Math.max(1, t.impressions)) * 100,
    preordersPer1k: t.preorders / Math.max(0.001, t.spend / 1000),
  }

  // sell-through at full price ~ save rate + pre-order conversion, ordinary least squares on the past launches
  const X = past.map((a) => [1, a.test.saveRate, a.test.conversion])
  const y = past.map((a) => a.outcome.sellThrough)
  const XtX = [0, 1, 2].map((i) => [0, 1, 2].map((j) => X.reduce((s, row) => s + row[i] * row[j], 0)))
  const Xty = [0, 1, 2].map((i) => X.reduce((s, row, k) => s + row[i] * y[k], 0))
  const inv = inverse3(XtX)
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0))
  const fit = X.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0))
  const sse = y.reduce((s, v, i) => s + (v - fit[i]) ** 2, 0)
  const sst = y.reduce((s, v) => s + (v - mean(y)) ** 2, 0)
  const n = past.length
  const s2 = sse / (n - 3)
  const x0 = [1, signals.saveRate, signals.conversion]
  const lever = x0.reduce((s, xi, i) => s + xi * x0.reduce((u, xj, j) => u + inv[i][j] * xj, 0), 0)
  const predicted = x0.reduce((s, v, j) => s + v * beta[j], 0)
  const half = t90(n - 3) * Math.sqrt(s2 * (1 + lever)) // an 80% prediction interval
  const clamp = (v: number) => Math.min(0.98, Math.max(0.05, v))

  // season units = pre-orders per €1k of media × the brand's multiplier, log-normal across past launches
  const logs = past.map((a) => Math.log(a.outcome.soldFullPrice / a.test.preordersPer1k))
  const mu = mean(logs)
  const sigma = sd(logs) * Math.sqrt(1 + 1 / n)
  const median = Math.exp(mu) * signals.preordersPer1k

  // newsvendor: make up to the demand quantile where a missed sale costs as much as an unsold unit
  const price = result.plan.price
  const criticalRatio = (price - ECON.unitCost) / (price - ECON.salvage)
  const raw = median * Math.exp(sigma * zOf(criticalRatio))
  const quantity = Math.max(0, Math.round(raw / 10) * 10)
  const baseline = Math.round(mean(past.map((a) => a.outcome.produced)) / 10) * 10

  const st = { predicted: clamp(predicted), low: clamp(predicted - half), high: clamp(predicted + half) }
  const target = ECON.targetSellThrough
  const reasons: string[] = []
  reasons.push(`Predicted sell-through ${pct(st.predicted)} (80%: ${pct(st.low)}–${pct(st.high)}) against a ${pct(target)} target`)
  reasons.push(`Optimal quantity ${quantity} units against a manufacturer minimum order of ${ECON.moq}`)
  const decision: Forecast["decision"] =
    st.predicted >= target && quantity >= ECON.moq ? "go" : st.predicted >= target - 0.1 && quantity >= ECON.moq * 0.6 ? "iterate" : "stop"

  const saves = past.map((a) => a.test.saveRate)
  const convs = past.map((a) => a.test.conversion)
  const per1k = past.map((a) => a.test.preordersPer1k)
  return {
    signals,
    percentile: { saveRate: percentile(saves, signals.saveRate), conversion: percentile(convs, signals.conversion), preordersPer1k: percentile(per1k, signals.preordersPer1k) },
    sellThrough: { ...st, target, coef: { intercept: beta[0], saveRate: beta[1], conversion: beta[2] }, r2: 1 - sse / sst, n },
    demand: { median: Math.round(median), low: Math.round(median * Math.exp(-1.2816 * sigma)), high: Math.round(median * Math.exp(1.2816 * sigma)), multiplier: Math.exp(mu), sigma },
    order: {
      quantity,
      criticalRatio,
      moq: ECON.moq,
      baseline,
      expected: outcomeOf(quantity, median, sigma, price),
      baselineExpected: outcomeOf(baseline, median, sigma, price),
    },
    decision,
    reasons,
  }
}

const pct = (v: number) => `${Math.round(v * 100)}%`

export function impactOf(assets: Asset[], result: CampaignResult): Impact {
  const t = market.traditional
  const own = assets.filter((a) => a.garmentId !== CAST_ID)
  return {
    traditional: { cost: t.sampleRounds * t.sampleCost + t.shootCost, weeks: t.sampleRounds * t.sampleWeeks + t.shootWeeks, signalWeeks: t.signalWeeks },
    ours: {
      generationUsd: own.reduce((s, a) => s + (a.gen?.usd ?? 0), 0),
      mediaEur: result.totals.spend,
      machineHours: own.reduce((s, a) => s + (a.gen?.ms ?? 0), 0) / 3_600_000,
      signalDays: result.plan.days,
    },
  }
}

export const archive = (family?: ArchiveLaunch["family"]) => (family ? archiveFor(family) : ARCHIVE)
export const economics = () => ECON

// ---------------------------------------------------------------- persistence and analysis

/** An analysis holds for the same plan on the same ads: the seed alone stays the same when new content is approved. */
export const analysisKey = (result: CampaignResult) => `${result.seed}|${result.creatives.map((c) => c.assetId).join(",")}`

export async function runCampaign(garmentId: string, plan: CampaignPlan): Promise<Campaign> {
  const { garment, assets } = await getGarment(garmentId)
  const result = simulateCampaign(garment, assets, plan)
  return updateDb((db) => {
    const g = db.garments.find((x) => x.id === garmentId)
    if (!g) throw new Error("garment not found")
    // the same plan gives the same numbers, so its analysis still holds
    const analyses = g.campaign?.analyses ?? {}
    g.campaign = { result, analyses }
    return { ...g.campaign, analysis: analyses[analysisKey(result)] }
  })
}

export async function clearCampaign(garmentId: string) {
  await updateDb((db) => {
    const g = db.garments.find((x) => x.id === garmentId)
    if (g) delete g.campaign
  })
}

export async function analyzeCampaign(garmentId: string): Promise<CampaignAnalysis> {
  const { garment, assets } = await getGarment(garmentId)
  const campaign = garment.campaign
  if (!campaign) throw new Error("Launch the market test first")
  const family = familyOf(garment.sku)
  const forecast = forecastFrom(campaign.result, family)
  // Gemma 4 on AMD Token Factory reads the test; the fallback is CAMPAIGN_TEXT_MODEL, else TEXT_MODEL
  const amdModel = process.env.CAMPAIGN_AMD_MODEL ?? "Gemma-4-31B-IT"
  const { data, model } = await askJsonWith<Omit<CampaignAnalysis, "model" | "at">>(process.env.CAMPAIGN_TEXT_MODEL, {
    system: CAMPAIGN_SYSTEM,
    prompt: campaignPrompt({ garment, result: campaign.result, forecast, impact: impactOf(assets, campaign.result), archive: archiveFor(family), themeLabel }),
    temperature: 0.3,
    amdModel,
  })
  const analysis: CampaignAnalysis = { ...data, model: model === "bedrock" ? bedrockModelId() : model === "amd" ? amdModel : model, at: new Date().toISOString() }
  const brief = await briefOf(analysis, forecast)
  if (brief) analysis.brief = brief
  await updateDb((db) => {
    const g = db.garments.find((x) => x.id === garmentId)
    if (g?.campaign) g.campaign.analyses = { ...g.campaign.analyses, [analysisKey(campaign.result)]: analysis }
  })
  return analysis
}

/** The analysis and the forecast as one text, summarised by Evolus; without Evolus the analysis keeps its own summary. */
async function briefOf(a: CampaignAnalysis, f: Forecast): Promise<CampaignAnalysis["brief"]> {
  if (!evolusReady()) return undefined
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`
  const text = [
    `Decision: ${f.decision.toUpperCase()}. Forecast full-price sell-through ${pct(f.sellThrough.predicted)} (80% interval ${pct(f.sellThrough.low)}-${pct(f.sellThrough.high)}, target ${pct(f.sellThrough.target)}). Units to order: ${f.order.quantity}.`,
    ...f.reasons,
    `${a.headline}. ${a.summary}`,
    ...a.insights.map((x) => `${x.title}: ${x.evidence}`),
    ...a.themes.map((t) => `Customers (${Math.round(t.share * 100)}%, ${t.sentiment}) on ${t.label}: "${t.quote}". Action: ${t.action}`),
    ...a.actions.map((x) => `Action on ${x.area}: ${x.action}. ${x.why} Impact: ${x.impact}`),
    ...a.risks.map((r) => `Risk: ${r}`),
  ].join("\n")
  try {
    const out = await evolusText("summarize", text, { length: "short", style: "bullets" })
    // summarize answers in the workspace's language (Italian), the app is in English
    const en = await evolusText("translate", out.output, { target: "en" })
    return { text: en.output.trim(), by: "Evolus summarize" }
  } catch (err) {
    console.warn(`Evolus summary skipped: ${(err as Error).message}`)
    return undefined
  }
}
