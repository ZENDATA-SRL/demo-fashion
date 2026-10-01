"use client"
/* eslint-disable @next/next/no-img-element */

import { useState, type ReactNode } from "react"
import { DEFAULT_MODELS, creatorName, ugcCell, ugcKey } from "@/lib/steps"
import type { JobView, PresetView } from "@/lib/workspace-types"
import { GenerateButton, Icon } from "../kit"
import { Bench } from "../bench"
import { StepHead, useWs } from "../workspace"

type Cell = ReturnType<typeof ugcCell>
type Shot = Cell["shots"][number]
/** What the bench shows: the frames or the clips of one shot, or the edited reels. */
type View = { shot: string; layer: "frame" | "clip" } | { shot: "reel" }

const REEL = "reel"
const JOB_KIND: Record<"frame" | "clip" | "reel", JobView["type"][]> = {
  frame: ["ugc-frame", "refine", "ugc-auto"],
  clip: ["ugc-clip", "ugc-auto"],
  reel: ["ugc-reel", "ugc-auto"],
}

/** Where an ad is at: the first shot without a frame, then the first without a clip, then the reel. */
function viewOf(cell: Cell): View {
  const noFrame = cell.shots.find((s) => !s.frame)
  if (noFrame) return { shot: noFrame.id, layer: "frame" }
  const noClip = cell.shots.find((s) => !s.clip)
  if (noClip) return { shot: noClip.id, layer: "clip" }
  return { shot: REEL }
}

const secs = (n: number) => `${n.toFixed(1).replace(".", ",").replace(",0", "")} s`

/**
 * Left, the brief of the ad (which ad, who, which voice) and the one button that makes the whole reel. Right, the
 * reel as a storyboard: one card per shot and the edit at the end; a card opens its frames or clips below, with the
 * manual controls, for when one shot needs another try.
 */
export function UgcStep() {
  const { ws, act } = useWs()
  const preset =
    ws.plan.find((p) => p.creator === "giulia" && p.format === "street-check") ??
    ws.plan.find((p) => p.format === "street-check") ??
    ws.plan[0]
  const [sel, setSel] = useState(preset)
  const cell = ugcCell(ws, sel.creator, sel.format)
  const [view, setView] = useState<View>(viewOf(cell))
  const [voice, setVoice] = useState(ws.ugcVoices[0].id)
  const [music, setMusic] = useState("")
  const frameModels = DEFAULT_MODELS["ugc-frame"]!
  const clipModels = DEFAULT_MODELS["ugc-clip"]!
  const format = ws.formats.find((f) => f.id === sel.format)
  const target = ugcKey(sel.creator, sel.format)
  const busy = cell.jobs.length > 0
  const autoRunning = cell.jobs.some((j) => j.type === "ugc-auto")
  const avatar = (id: string) => ws.assets.findLast((a) => a.kind === "person" && a.creator === id)
  const n = cell.shots.length
  const shot = view.shot === REEL ? undefined : cell.shots.find((s) => s.id === view.shot) ?? cell.shots[0]
  const layer: keyof typeof JOB_KIND = "layer" in view ? view.layer : "reel"

  const formats = ws.formats
  // every creator can shoot every template; the plan's creator for it comes first
  const creatorsFor = (formatId: string) => {
    const planned = ws.plan.find((p) => p.format === formatId)?.creator
    return [...ws.creators].sort((a, b) => Number(b.id === planned) - Number(a.id === planned))
  }
  const open = (creator: string, formatId: string) => {
    setSel({ creator, format: formatId })
    setView(viewOf(ugcCell(ws, creator, formatId)))
  }
  // switching template opens the creator already working on it, otherwise the planned one
  const pickFormat = (formatId: string) => {
    const creators = creatorsFor(formatId)
    const started = (c: (typeof creators)[number]) => ugcCell(ws, c.id, formatId).framesDone > 0
    const next = creators.find((c) => ugcCell(ws, c.id, formatId).video) ?? creators.find(started) ?? creators[0]
    if (next) open(next.id, formatId)
  }
  // a shot opens on its clips once its frame is approved
  const pickShot = (s: Shot) => setView({ shot: s.id, layer: s.frame ? "clip" : "frame" })

  const base = { creator: sel.creator, format: sel.format }
  const genFrames = (shots: Shot[]) => act({ type: "ugc-frame", ...base, models: frameModels, shots: shots.map((s) => s.id) })
  const genClips = (shots: Shot[]) => act({ type: "ugc-clip", ...base, models: clipModels, voice, shots: shots.map((s) => s.id) })
  const assemble = () => act({ type: "ugc-reel", ...base, ...(music ? { music } : {}) })
  const auto = () => {
    setView({ shot: REEL })
    act({ type: "ugc-auto", ...base, voice, ...(music ? { music } : {}) })
  }
  const allClips = cell.clipsDone === n

  return (
    <>
      <StepHead />

      <div className="ugc-layout">
        <aside className="ugc-setup" aria-label="Regia">
          <div className="ugc-setup-body scroll">
            <Field n={1} label="Template">
              <div className="ugc-list">
                {formats.map((f) => {
                  const done = ws.creators.filter((c) => ugcCell(ws, c.id, f.id).video).length
                  return (
                    <button key={f.id} className="ugc-choice" aria-pressed={f.id === sel.format} onClick={() => pickFormat(f.id)}>
                      <span className="ugc-choice-text">
                        <b>{f.label}</b>
                        <small>
                          {f.shots.length} clip · {Math.round(f.seconds)} s{f.speaks ? "" : " · musica"}
                        </small>
                      </span>
                      <span className="ugc-count" data-done={done > 0}>
                        {done ? `${done} reel` : "Da fare"}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field n={2} label="Creator">
              <div className="ugc-list">
                {creatorsFor(sel.format).map((c) => {
                  const x = ugcCell(ws, c.id, sel.format)
                  const a = avatar(c.id)
                  const state = x.video ? "Reel approvato" : x.jobs.length ? "In lavorazione" : x.clipsDone ? `${x.clipsDone}/${x.shots.length} clip` : x.framesDone ? `${x.framesDone}/${x.shots.length} fotogrammi` : "Da fare"
                  return (
                    <button key={c.id} className="ugc-choice" aria-pressed={c.id === sel.creator} onClick={() => open(c.id, sel.format)}>
                      <span className="avatar">{a ? <img src={a.src} alt="" /> : c.name[0]}</span>
                      <span className="ugc-choice-text">
                        <b>{c.name}</b>
                        <small>
                          {c.age} anni · {c.city}
                        </small>
                      </span>
                      <span className="ugc-state" data-s={x.video ? "done" : x.jobs.length ? "busy" : undefined}>
                        {state}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Field>

            <details className="advanced ugc-more">
              <summary>{format?.speaks ? "Voce" : "Musica"}</summary>
            {format?.speaks ? (
              <Field n={3} label="Voce">
                <Options options={ws.ugcVoices} value={voice} onChange={setVoice} />
              </Field>
            ) : (
              <Field n={3} label="Musica">
                <Options
                  options={[{ id: "", label: "Del formato", note: "La base di questo template, sul suo tempo." }, ...ws.ugcTracks]}
                  value={music}
                  onChange={setMusic}
                />
              </Field>
            )}
            </details>
          </div>

          <div className="ugc-setup-foot">
            <button className="btn primary ugc-go" onClick={auto} disabled={busy}>
              {autoRunning ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="spark" />}
              {autoRunning ? "Sto facendo il reel…" : allClips ? "Rimonta il reel" : "Fai il reel"}
            </button>
            {autoRunning && <p className="ugc-help">{cell.jobs.find((j) => j.type === "ugc-auto")?.phase ?? "In corso"}</p>}
          </div>
        </aside>

        <div className="ugc-main">
          <div className="ugc-head">
            <div>
              <h3>
                {format?.label} <span className="muted">· {creatorName(ws, sel.creator)}</span>
              </h3>
            </div>
          </div>

          <ol className="ugc-board" aria-label="Scatti del reel">
            {cell.shots.map((s, i) => {
              const thumb = s.clip?.poster ?? s.frame?.src ?? s.frames.at(-1)?.src
              return (
                <li key={s.id}>
                  <button className="ugc-card" aria-pressed={view.shot === s.id} onClick={() => pickShot(s)}>
                    <span className="ugc-card-thumb">{thumb ? <img src={thumb} alt="" /> : <b>{i + 1}</b>}</span>
                    <span className="ugc-card-text">
                      <b>
                        {i + 1}. {s.label}
                      </b>
                      <span className="ugc-marks">
                        <Mark done={!!s.frame} label="Foto" />
                        <Mark done={!!s.clip} label="Clip" />
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
            <li>
              <button className="ugc-card ugc-card-reel" aria-pressed={view.shot === REEL} onClick={() => setView({ shot: REEL })}>
                <span className="ugc-card-thumb">{cell.video?.poster ? <img src={cell.video.poster} alt="" /> : <Icon name="spark" size={14} />}</span>
                <span className="ugc-card-text">
                  <b>Reel</b>
                  <small>{secs(format?.seconds ?? 0)}</small>
                  <span className="ugc-marks">
                    <Mark done={!!cell.video} label={cell.video ? "Approvato" : cell.reels.length ? "Da approvare" : "Da montare"} />
                  </span>
                </span>
              </button>
            </li>
          </ol>

          <Bench
            key={`${target}-${view.shot}-${layer}`}
            target={target}
            jobKind={JOB_KIND[layer]}
            tall
            assets={shot ? (layer === "frame" ? shot.frames : shot.clips) : cell.reels}
            toolbar={
              <div className="bench-bar">
                {shot && view.shot !== REEL ? (
                  <>
                    <div className="ugc-bar-left">
                      <div className="seg" role="group" aria-label="Livello">
                        <button aria-pressed={layer === "frame"} onClick={() => setView({ shot: shot.id, layer: "frame" })}>
                          {shot.frame && <Icon name="check" size={10} />} Fotogramma
                        </button>
                        <button aria-pressed={layer === "clip"} onClick={() => setView({ shot: shot.id, layer: "clip" })} disabled={!shot.frame}>
                          {shot.clip && <Icon name="check" size={10} />} Clip
                        </button>
                      </div>
                    </div>
                    <div className="ugc-bar-right">
                      {layer === "frame" ? (
                        <GenerateButton label={shot.frames.length ? "Altro fotogramma" : "Genera fotogramma"} models={ws.models} modelIds={frameModels} onRun={() => genFrames([shot])} busy={busy} quiet />
                      ) : (
                        <GenerateButton label={shot.clips.length ? "Altra clip" : "Genera clip"} models={ws.models} modelIds={clipModels} onRun={() => genClips([shot])} busy={busy} disabled={!shot.frame} quiet />
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <button className="btn secondary" onClick={assemble} disabled={busy || !allClips}>
                      {allClips ? (cell.reels.length ? "Rimonta" : "Monta") : `Mancano ${n - cell.clipsDone} clip approvate`}
                    </button>
                  </>
                )}
              </div>
            }
            empty={
              <div className="empty">
                {shot && layer === "frame" ? (
                  <button className="link-btn" onClick={() => genFrames([shot])} disabled={busy}>
                    Genera solo questo fotogramma
                  </button>
                ) : shot && layer === "clip" ? (
                  <button className="link-btn" onClick={() => genClips([shot])} disabled={busy || !shot.frame}>
                    Genera solo questa clip
                  </button>
                ) : (
                  <p className="muted">Il reel montato compare qui.</p>
                )}
              </div>
            }
          />
        </div>
      </div>
    </>
  )
}

function Field({ n, label, children }: { n: number; label: string; children: ReactNode }) {
  return (
    <section className="ugc-field">
      <h4>
        <i>{n}</i> {label}
      </h4>
      {children}
    </section>
  )
}

/** Chips for the choice, the note of the chosen one underneath: every option readable without a tooltip. */
function Options({ options, value, onChange }: { options: PresetView[]; value: string; onChange: (id: string) => void }) {
  const current = options.find((o) => o.id === value)
  return (
    <>
      <div className="ugc-options" role="group">
        {options.map((o) => (
          <button key={o.id} className="ugc-option" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
      {current && <p className="ugc-help">{current.note}</p>}
    </>
  )
}

function Mark({ done, label }: { done: boolean; label: string }) {
  return (
    <span className="ugc-mark" data-done={done}>
      <i />
      {label}
    </span>
  )
}
