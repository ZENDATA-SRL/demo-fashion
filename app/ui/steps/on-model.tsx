"use client"
/* eslint-disable @next/next/no-img-element */

import { useState } from "react"
import { DEFAULT_MODELS } from "@/lib/steps"
import type { AssetView, CastMemberView } from "@/lib/workspace-types"
import { GenerateButton, Icon } from "../kit"
import { Bench } from "../bench"
import { StepHead, useWs } from "../workspace"

const ofModel = (assets: AssetView[], m: CastMemberView) => {
  const ids = new Set(Object.values(m.views))
  return assets.filter((a) => a.kind === "on-model" && a.refIds.some((id) => ids.has(id)))
}

export function OnModelStep() {
  const { ws, act } = useWs()
  const models = DEFAULT_MODELS.onmodel!
  const assets = ws.assets.filter((a) => a.kind === "on-model")
  const job = ws.jobs.find((j) => j.status === "running" && j.target === "on-model")
  const slotBusy = (id: string) => !!job && (!job.slots || job.slots.includes(id))

  // the model this garment is already worn on, so the step opens on her and not on the first of the cast
  const worn = assets.filter((a) => a.status !== "rejected").at(-1)
  const shotOn = (m: CastMemberView) => Object.values(m.views).some((id) => worn?.refIds.includes(id))
  const [sel, setSel] = useState(() => (ws.cast.find(shotOn) ?? ws.cast[0]).id)
  const model = ws.cast.find((m) => m.id === sel) ?? ws.cast[0]
  const mine = ofModel(ws.assets, model)
  const busy = slotBusy(model.id)

  const generate = () => act({ type: "onmodel", models, model: model.id })

  return (
    <>
      <StepHead />

      <div className="slots" aria-label="Modelle">
        {ws.cast.map((m) => {
          const front = ws.assets.find((a) => a.id === m.views.front)
          const hers = ofModel(ws.assets, m)
          const approved = hers.some((a) => a.status === "approved")
          return (
            <button
              key={m.id}
              className="slot"
              aria-pressed={m.id === model.id}
              onClick={() => setSel(m.id)}
            >
              <div className="slot-media">
                {front ? <img src={front.src} alt="" /> : <span className="ph"><Icon name="image" /></span>}
              </div>
              <div className="slot-meta">
                <b>{m.label}</b>
                <span className="slot-state">
                  {slotBusy(m.id) ? (
                    <span className="spinner" style={{ width: 11, height: 11 }} />
                  ) : approved ? (
                    <span className="slot-check">
                      <Icon name="check" size={10} />
                    </span>
                  ) : hers.length ? (
                    `${hers.length} da scegliere`
                  ) : (
                    m.note
                  )}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <Bench
        key={model.id}
        target="on-model"
        slot={model.id}
        assets={mine}
        toolbar={mine.length > 0 && <GenerateButton label="Nuova versione" models={ws.models} modelIds={models} onRun={generate} busy={busy} disabled={!!job && !busy} quiet />}
        empty={
          <div className="empty">
            <GenerateButton label="Genera l'indossato" models={ws.models} modelIds={models} onRun={generate} busy={busy} disabled={!!job && !busy} />
          </div>
        }
      />
    </>
  )
}
