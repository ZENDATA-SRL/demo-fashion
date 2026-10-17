import type { Candidate } from "./garment"
import { newId } from "./store"
import type { JobView } from "./workspace-types"

/**
 * Long generations run inside the Next server process and are polled by the UI.
 * Kept on globalThis so they survive dev hot reloads; lost on a server restart, like any in-flight request.
 */

type Job = JobView & { garmentId: string }
type Ctx = { phase: (text: string) => void; slots: (ids: string[]) => void }

const g = globalThis as { __jobs?: Map<string, Job> }
const jobs = (g.__jobs ??= new Map())

export function jobsFor(garmentId: string): JobView[] {
  const cutoff = Date.now() - 6 * 3600_000
  return [...jobs.values()]
    .filter((j) => j.garmentId === garmentId && (j.status === "running" || Date.parse(j.startedAt) > cutoff))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map(({ garmentId: _, ...j }) => j)
}

export function runningFor(garmentId: string, target: string): JobView | undefined {
  return [...jobs.values()].find((j) => j.garmentId === garmentId && j.target === target && j.status === "running")
}

export function startJob(
  garmentId: string,
  spec: Pick<JobView, "type" | "target" | "label"> & { models?: string[]; phase?: string; slots?: string[] },
  fn: (ctx: Ctx) => Promise<unknown>,
): JobView {
  const job: Job = {
    id: newId("j"),
    garmentId,
    type: spec.type,
    target: spec.target,
    slots: spec.slots,
    label: spec.label,
    phase: spec.phase,
    models: spec.models ?? [],
    errors: [],
    status: "running",
    startedAt: new Date().toISOString(),
  }
  jobs.set(job.id, job)
  const ctx: Ctx = {
    phase: (text) => void (job.phase = text),
    slots: (ids) => {
      const added = ids.some((id) => !job.slots?.includes(id))
      job.slots = ids
      if (added) job.since = new Date().toISOString()
    },
  }
  fn(ctx)
    .then((result) => {
      if (Array.isArray(result)) {
        const failed = (result as Candidate[]).filter((c) => c && typeof c === "object" && "error" in c && c.error)
        job.errors = failed.map((c) => ({ modelId: c.modelId, error: c.error! }))
        if (failed.length && failed.length === result.length) {
          job.status = "error"
          job.error = "No model produced a result"
        }
      }
      if (job.status === "running") job.status = "done"
    })
    .catch((err) => {
      job.status = "error"
      job.error = err instanceof Error ? err.message : String(err)
      console.error(`[job ${job.type}]`, err)
    })
    .finally(() => {
      job.endedAt = new Date().toISOString()
      job.phase = undefined
    })
  const { garmentId: _, ...view } = job
  return view
}
