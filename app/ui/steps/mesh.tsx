"use client"

import { useRef, useState } from "react"
import { DEFAULT_MODELS, approvedOf, running } from "@/lib/steps"
import type { AssetView } from "@/lib/workspace-types"
import { GenerateButton, Icon, useToast } from "../kit"
import { Bench } from "../bench"
import { MeshView } from "../mesh-view"
import { StepHead, useWs } from "../workspace"

const isRefined = (a: AssetView) => a.label === "operatore"

export function MeshStep() {
  const { ws, act, refresh } = useWs()
  const toast = useToast()
  const source = approvedOf(ws, "ghost-front") ?? approvedOf(ws, "ghost-side")
  const meshes = ws.assets.filter((a) => a.kind === "mesh")
  const live = meshes.filter((a) => a.status !== "rejected")
  const current = live.find((a) => a.status === "approved") ?? live.at(-1)
  const refined = live.filter(isRefined).at(-1)
  const before = refined && (live.find((a) => refined.refIds.includes(a.id) && !isRefined(a)) ?? live.filter((a) => !isRefined(a)).at(-1))
  const models = DEFAULT_MODELS.mesh!
  const busy = running(ws, "mesh").length > 0
  const locked = !source
  const [tab, setTab] = useState<"confronto" | "versioni">("confronto")
  /** when the refined GLB is already in the workspace, open the compare view immediately */
  const [shown, setShown] = useState(() => !!refined)
  const hidden = !!refined && !shown
  const input = useRef<HTMLInputElement>(null)
  const [sending, setSending] = useState(false)

  const upload = async (file?: File) => {
    if (!file) return
    setSending(true)
    const form = new FormData()
    form.set("file", file)
    await fetch(`/api/garments/${ws.garment.id}/mesh`, { method: "POST", body: form })
    await refresh()
    setSending(false)
  }

  const simulate = async () => {
    if (refined) return setShown(true)
    setSending(true)
    const res = await fetch(`/api/garments/${ws.garment.id}/mesh/simulate`, { method: "POST" })
    if (!res.ok) toast({ title: "Intervento non caricato", body: ((await res.json()) as { error?: string }).error, tone: "error" })
    await refresh()
    setTab("confronto")
    setShown(true)
    setSending(false)
  }

  const comparing = !!(refined && before) && !hidden && tab === "confronto"

  return (
    <div className="col fill mesh-step">
      <StepHead
        actions={
          current && (refined ? hidden : ws.garment.operatorDemo) && !busy ? (
            <button className="btn primary" onClick={simulate} disabled={sending}>
              {sending ? <span className="spinner" /> : <Icon name="pen" />} Simula intervento operatore
            </button>
          ) : undefined
        }
      />
      <input ref={input} type="file" accept=".glb,model/gltf-binary" hidden onChange={(e) => upload(e.target.files?.[0])} />

      {refined && before && !hidden && (
        <div className="seg step-tabs" role="tablist" aria-label="Vista">
          <button role="tab" aria-pressed={tab === "confronto"} onClick={() => setTab("confronto")}>
            Prima e dopo
          </button>
          <button role="tab" aria-pressed={tab === "versioni"} onClick={() => setTab("versioni")}>
            Versioni <span className="mono muted">{live.length}</span>
          </button>
        </div>
      )}

      {comparing ? (
        <OperatorCompare before={before!} after={refined!} sku={ws.garment.sku} />
      ) : (
        <>
          <Bench
            target="mesh"
            assets={hidden ? meshes.filter((a) => !isRefined(a)) : meshes}
            jobKind={["mesh"]}
            noApprove
            toolbar={
              <>
                <GenerateButton label="Nuova versione" models={ws.models} modelIds={models} onRun={() => act({ type: "mesh", models })} busy={busy} disabled={locked} quiet />
                {current && (
                  <a href={current.src} download={`${ws.garment.sku}-3d.glb`}>
                    <Icon name="download" size={12} /> Scarica GLB per l&apos;operatore
                  </a>
                )}
                <button onClick={() => input.current?.click()} disabled={sending}>
                  <Icon name="upload" size={12} /> Carica il modello rifinito
                </button>
              </>
            }
            empty={
              <div className="empty">
                {locked && <h3>Prima approva il concept</h3>}
                {!locked && <GenerateButton label="Genera il modello 3D" models={ws.models} modelIds={models} onRun={() => act({ type: "mesh", models })} busy={busy} />}
              </div>
            }
          />
        </>
      )}
    </div>
  )
}

/** Side-by-side generated mesh and operator-refined mesh. */
function OperatorCompare({ before, after, sku }: { before: AssetView; after: AssetView; sku: string }) {
  return (
    <div className="op-compare fill col">
      <div className="op-pair">
        {(["before", "after"] as const).map((side) => {
          const a = side === "before" ? before : after
          return (
            <figure key={side} className="op-side">
              <figcaption>
                <b>{side === "before" ? "Image-to-3D" : "Mesh Cleanup"}</b>
                <span className="muted">{a.model}</span>
                <a className="icon-btn bordered" href={a.src} download={`${sku}-${side === "before" ? "3d" : "3d-affinato"}.glb`} aria-label="Scarica GLB">
                  <Icon name="download" size={13} />
                </a>
              </figcaption>
              <div className="op-view">
                <MeshView src={a.src} compare />
              </div>
            </figure>
          )
        })}
      </div>
    </div>
  )
}
