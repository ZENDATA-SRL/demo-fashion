"use client"
/* eslint-disable @next/next/no-img-element */

import { approvedOf, currentOf } from "@/lib/steps"
import type { AssetView } from "@/lib/workspace-types"
import { useLightbox } from "../kit"
import { Bench } from "../bench"
import { MeshView } from "../mesh-view"
import { StepHead, useWs } from "../workspace"

const fmt = (n: number) => n.toFixed(1).replace(".0", "").replace(".", ",")

export function SceneStep() {
  const { ws } = useWs()
  const scenes = ws.assets.filter((a) => a.kind === "scene")
  const current = currentOf(ws.assets, "scene")
  const m = current?.measure

  return (
    <>
      <StepHead />
      {m && (
        <p className="size-line" data-ok={Math.abs(m.cm / m.target - 1) <= 0.1}>
          <span className="caps">Sul tavolo</span>
          <b className="num">{fmt(m.cm)} cm</b>
          <span className="muted">
            quota {fmt(m.target)} cm · {m.how}
          </span>
        </p>
      )}
      <Bench
        target="scene"
        assets={scenes}
        toolbar={null}
        empty={
          <div className="empty">
            <h3>Nessuna scena</h3>
            <p className="muted">La scena si fa fuori dall&apos;app, con la pipeline layout → 3D → Qwen, partendo dal 3D approvato.</p>
          </div>
        }
      />
      {current && <Thread scene={current} />}
    </>
  )
}

/** The project from reference to scene in one row: a choice made in the sketch should be visible in every frame. */
function Thread({ scene }: { scene: AssetView }) {
  const { ws, go } = useWs()
  const light = useLightbox()
  const meshes = ws.assets.filter((a) => a.kind === "mesh" && a.status !== "rejected")
  const refined = [...meshes].reverse().find((a) => a.label === "operatore")
  const generated =
    (refined && meshes.find((a) => refined.refIds.includes(a.id) && a.label !== "operatore")) ??
    meshes.find((a) => a.label !== "operatore")
  type Cell = { label: string; step: Parameters<typeof go>[0]; node: React.ReactNode; note?: string }
  const image = (label: string, a: AssetView | undefined, step: Cell["step"]): Cell | undefined =>
    a && { label, step, node: <img src={a.src} alt={label} onClick={() => light({ src: a.src, alt: label })} /> }
  const model = (label: string, a: AssetView | undefined, note?: string): Cell | undefined => a && { label, note, step: "3d", node: <MeshView src={a.src} /> }
  const cells = [
    image("Riferimento", ws.assets.find((a) => a.kind === "archive"), "input"),
    image("Concept Sketch", currentOf(ws.assets, "sketch"), "input"),
    image("Concept Visualization", approvedOf(ws, "ghost-front"), "concept"),
    model("Image-to-3D", generated),
    model("Mesh Cleanup", refined, refined?.operator ? `${refined.operator.minutes} min di operatore` : undefined),
    image("Scena", scene, "scena"),
  ].filter((c): c is Cell => !!c)

  return (
    <section className="thread" aria-label="Filo del progetto">
      <h3 className="caps">Filo del progetto</h3>
      <ol>
        {cells.map((c) => (
          <li key={c.label}>
            <div className="thread-media">{c.node}</div>
            <button className="link-btn" onClick={() => go(c.step)}>
              {c.label}
            </button>
            {c.note && <span className="mono muted">{c.note}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
