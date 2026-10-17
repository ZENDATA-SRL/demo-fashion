"use client"
/* eslint-disable @next/next/no-img-element */

import { useState } from "react"
import { DEFAULT_MODELS, approvedOf, studioCell, studioKey } from "@/lib/steps"
import { GenerateButton, Icon } from "../kit"
import { Bench } from "../bench"
import { StepHead, useWs } from "../workspace"

export function StudioStep() {
  const { ws, act } = useWs()
  const models = DEFAULT_MODELS.studio!
  const [sel, setSel] = useState(() => (ws.looks.find((l) => !studioCell(ws, l.id).shot) ?? ws.looks[0]).id)
  const look = ws.looks.find((l) => l.id === sel) ?? ws.looks[0]
  const cell = studioCell(ws, look.id)
  const busy = cell.jobs.length > 0
  const needsBack = look.back && !approvedOf(ws, "ghost-back")
  const generate = () => act({ type: "studio", look: look.id, models })

  return (
    <>
      <StepHead />

      <div className="slots" aria-label="Look">
        {ws.looks.map((l) => {
          const x = studioCell(ws, l.id)
          const thumb = x.shot ?? x.shots.filter((a) => a.status !== "rejected").at(-1)
          return (
            <button key={l.id} className="slot" aria-pressed={l.id === look.id} onClick={() => setSel(l.id)}>
              <div className="slot-media">{thumb ? <img src={thumb.src} alt="" style={x.shot ? undefined : { opacity: 0.55 }} /> : <span className="ph"><Icon name="image" /></span>}</div>
              <div className="slot-meta">
                <b>{l.label}</b>
                <span className="slot-state">
                  {x.jobs.length ? (
                    <span className="spinner" style={{ width: 11, height: 11 }} />
                  ) : x.shot ? (
                    <span className="slot-check">
                      <Icon name="check" size={10} />
                    </span>
                  ) : x.shots.length ? (
                    `${x.shots.length} to choose from`
                  ) : (
                    "Not generated"
                  )}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <Bench
        key={look.id}
        target={studioKey(look.id)}
        jobKind={["studio", "refine"]}
        assets={cell.shots}
        toolbar={cell.shots.length > 0 && <GenerateButton label="New version" models={ws.models} modelIds={models} onRun={generate} busy={busy} quiet />}
        empty={
          <div className="empty">
            {needsBack ? <h3>Approve the back view first</h3> : <GenerateButton label="Generate the shot" models={ws.models} modelIds={models} onRun={generate} busy={busy} />}
          </div>
        }
      />
    </>
  )
}
