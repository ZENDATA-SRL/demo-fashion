/** Serialisable shapes of the simulated market test, shared by the db, the API and the client. No runtime imports here. */

export type ChannelId = "instagram" | "tiktok" | "pinterest"
export type MarketId = "IT" | "FR" | "DE" | "UK"
export type CreativeType = "ugc" | "editorial" | "onmodel" | "lifestyle" | "packshot"
export type Sentiment = "positive" | "neutral" | "negative"

export type CampaignPlan = {
  /** total paid media, EUR */
  budget: number
  days: number
  channels: ChannelId[]
  markets: MarketId[]
  /** retail price shown on the pre-order page, EUR */
  price: number
}

export type Funnel = {
  spend: number
  impressions: number
  reach: number
  likes: number
  comments: number
  saves: number
  shares: number
  clicks: number
  /** visits to the pre-order page */
  sessions: number
  waitlist: number
  /** pre-orders with a refundable deposit */
  preorders: number
}

/** One ad of the test: an approved asset of the garment run on the channels its type suits. */
export type CreativeSpec = { id: string; assetId: string; type: CreativeType; label: string; channels: ChannelId[] }

export type CreativeResult = CreativeSpec & Funnel
export type DayResult = Funnel & { day: number }
export type SegmentResult = Funnel & { id: string; label: string }

export type CampaignComment = {
  id: string
  creativeId: string
  market: MarketId
  lang: string
  theme: string
  sentiment: Sentiment
  text: string
  likes: number
  day: number
}

export type CampaignResult = {
  plan: CampaignPlan
  seed: number
  ranAt: string
  totals: Funnel
  days: DayResult[]
  creatives: CreativeResult[]
  markets: SegmentResult[]
  ages: SegmentResult[]
  /** a sample of the written comments, the rest are only counted */
  comments: CampaignComment[]
}

export type CampaignAnalysis = {
  verdict: "go" | "iterate" | "stop"
  headline: string
  summary: string
  insights: Array<{ title: string; evidence: string }>
  themes: Array<{ theme: string; label: string; sentiment: Sentiment; share: number; quote: string; action: string }>
  actions: Array<{ area: "design" | "creative" | "audience" | "production" | "pricing"; action: string; why: string; impact: string }>
  dnaChanges: Array<{ field: string; to: string; why: string }>
  risks: string[]
  /** the whole reading in a few bullets, by Evolus summarize, for the end of the flow */
  brief?: { text: string; by: string }
  model: string
  at: string
}

/** `analyses` keeps the reading of every plan tried, by its seed, so going back to a plan brings its analysis back. */
export type Campaign = { result: CampaignResult; analysis?: CampaignAnalysis; analyses?: Record<string, CampaignAnalysis> }

/** The statistical part of the validation: no language model involved. */
export type Forecast = {
  signals: { saveRate: number; conversion: number; ctr: number; preordersPer1k: number }
  /** where each signal sits among the brand's past launches, 0-100 */
  percentile: { saveRate: number; conversion: number; preordersPer1k: number }
  sellThrough: {
    predicted: number
    low: number
    high: number
    target: number
    coef: { intercept: number; saveRate: number; conversion: number }
    r2: number
    n: number
  }
  demand: { median: number; low: number; high: number; multiplier: number; sigma: number }
  order: {
    quantity: number
    criticalRatio: number
    moq: number
    baseline: number
    expected: { margin: number; markdownUnits: number; lostSales: number }
    baselineExpected: { margin: number; markdownUnits: number; lostSales: number }
  }
  decision: "go" | "iterate" | "stop"
  reasons: string[]
}

export type Impact = {
  traditional: { cost: number; weeks: number; signalWeeks: number }
  ours: { generationUsd: number; mediaEur: number; machineHours: number; signalDays: number }
}

export type ArchiveLaunch = {
  sku: string
  name: string
  category: string
  /** leather goods or knitwear: a product is forecast against the past launches of its own family */
  family: "leather" | "knit"
  price: number
  test: { budget: number; days: number; saveRate: number; ctr: number; conversion: number; preorders: number; preordersPer1k: number }
  outcome: { produced: number; soldFullPrice: number; sellThrough: number; markdownUnits: number }
}
