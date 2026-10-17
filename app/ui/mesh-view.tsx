"use client"

import { useEffect, useRef } from "react"

let loading: Promise<void> | undefined

function loadViewer(): Promise<void> {
  if (customElements.get("model-viewer")) return Promise.resolve()
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.type = "module"
    script.src = "/vendor/model-viewer.min.js"
    script.onload = () => resolve()
    script.onerror = () => {
      loading = undefined
      reject(new Error("model-viewer failed to load"))
    }
    document.head.appendChild(script)
  })
  return loading
}

export type MeshSize = { x: number; y: number; z: number }

const STUDIO_ENV = "/vendor/neutral.hdr"

/** Orbit a GLB. The script is loaded once; each mount owns its own viewer. `onSize` gets the bounding box once loaded. */
export function MeshView({ src, onSize, compare = false }: { src: string; onSize?: (size: MeshSize) => void; compare?: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const sized = useRef(onSize)
  sized.current = onSize

  useEffect(() => {
    const node = host.current
    if (!node) return
    let dead = false
    loadViewer()
      .then(() => {
        if (dead) return
        const el = document.createElement("model-viewer")
        el.setAttribute("src", src)
        el.setAttribute("camera-controls", "")
        el.setAttribute("auto-rotate", "")
        el.setAttribute("environment-image", STUDIO_ENV)
        el.setAttribute("shadow-intensity", compare ? "0.55" : "0.7")
        el.setAttribute("exposure", compare ? "1.22" : "1.05")
        el.setAttribute("tone-mapping", "commerce")
        el.setAttribute("interaction-prompt", "auto")
        el.setAttribute("alt", "3D model, drag to rotate")
        el.addEventListener("load", () => {
          const size = (el as HTMLElement & { getDimensions?: () => MeshSize }).getDimensions?.()
          if (size && !dead) sized.current?.({ x: size.x, y: size.y, z: size.z })
        })
        node.replaceChildren(el)
      })
      .catch(() => {
        if (!dead) node.textContent = "Viewer unavailable"
      })
    return () => {
      dead = true
      node.replaceChildren()
    }
  }, [src, compare])

  return <div ref={host} className="mesh-view" />
}
