"use client"
/* eslint-disable @next/next/no-img-element */

import { useState } from "react"
import { DEFAULT_MODELS, VIEW_SLOTS, approvedOf, renderSlots, running, slotLabel } from "@/lib/steps"
import type { AssetKind } from "@/lib/workspace-types"
import { GenerateButton, Icon } from "../kit"
import { Bench } from "../bench"
import { StepHead, useWs } from "../workspace"

/** The concept step shows the front only; the render step shows every other view of the approved product. */
export function ViewsStep({ concept = false }: { concept?: boolean }) {
  const { ws, act } = useWs()
  const slots = concept ? VIEW_SLOTS.filter((s) => s.kind === "ghost-front") : renderSlots(ws.garment.shoot)
  const front = approvedOf(ws, "ghost-front")
  const [kind, setKind] = useState<AssetKind>(slots.find((s) => !approvedOf(ws, s.kind))?.kind ?? slots[0].kind)
  const models = DEFAULT_MODELS.canon!
  const label = slotLabel(ws.garment.shoot, kind)
  const assets = ws.assets.filter((a) => a.kind === kind)
  const auto = ws.jobs.find((j) => j.status === "running" && j.type === "canon-all")
  const slotBusy = (slot: AssetKind) => running(ws, slot).length > 0 || !!auto?.slots?.includes(slot)
  const busy = slotBusy(kind)
  const locked = !concept && !front
  const missing = slots.filter((s) => !ws.assets.some((a) => a.kind === s.kind && a.status !== "rejected"))
  const generate = () => act({ type: "canon", kind, models })
  const generateAll = () => act({ type: "canon-all", models })

  return (
    <>
      <StepHead />

      {!concept && (
        <>
          <div className="slots" aria-label="Packshot">
            {slots.map((s) => {
              const ok = approvedOf(ws, s.kind)
              const best = ok ?? ws.assets.filter((a) => a.kind === s.kind && a.status !== "rejected").at(-1)
              const n = ws.assets.filter((a) => a.kind === s.kind).length
              const isBusy = slotBusy(s.kind)
              return (
                <button key={s.kind} className="slot" aria-pressed={kind === s.kind} onClick={() => setKind(s.kind)} disabled={locked}>
                  <div className="slot-media">
                    {best ? <img src={best.src} alt={slotLabel(ws.garment.shoot, s.kind)} style={ok ? undefined : { opacity: 0.55 }} /> : <span className="ph">{locked ? <Icon name="lock" /> : <Icon name="image" />}</span>}
                  </div>
                  <div className="slot-meta">
                    <b>{slotLabel(ws.garment.shoot, s.kind)}</b>
                    <span className="slot-state">
                      {isBusy ? (
                        <span className="spinner" style={{ width: 11, height: 11 }} />
                      ) : ok ? (
                        <span className="slot-check">
                          <Icon name="check" size={10} />
                        </span>
                      ) : n ? (
                        `${n} to choose from`
                      ) : locked ? (
                        "After the concept"
                      ) : (
                        "Not generated"
                      )}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      <Bench
        target={kind}
        assets={assets}
        toolbar={assets.length > 0 && <GenerateButton label="New version" models={ws.models} modelIds={models} onRun={generate} busy={busy} disabled={locked || !!auto} quiet />}
        empty={
          <div className="empty">
            {locked ? (
              <h3>Approve the concept first</h3>
            ) : concept ? (
              <GenerateButton label="Generate the concept" models={ws.models} modelIds={models} onRun={generate} busy={busy} />
            ) : missing.length > 1 ? (
              <GenerateButton label="Generate the renders" models={ws.models} modelIds={models} onRun={generateAll} busy={!!auto || busy} />
            ) : (
              <GenerateButton label={`Generate ${label.toLowerCase()}`} models={ws.models} modelIds={models} onRun={generate} busy={busy} />
            )}
          </div>
        }
      />
    </>
  )
}
