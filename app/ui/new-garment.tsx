"use client"
/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Icon } from "./kit"

type Chosen = { file?: File; from?: string; preview: string } | null

type Example = { archive?: string; sketch?: string; brief: string; name: string; maison: string }

function Drop({ title, hint, value, onChange }: { title: string; hint: string; value: Chosen; onChange: (p: Chosen) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const take = (file?: File) => {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return
    onChange({ file, preview: URL.createObjectURL(file) })
  }
  return (
    <div>
      <div
        className="drop"
        role="button"
        tabIndex={0}
        aria-label={value ? `${title}: sostituisci` : `${title}: carica`}
        data-over={over}
        data-filled={!!value}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          take(e.dataTransfer.files[0])
        }}
      >
        {value ? (
          <>
            <img src={value.preview} alt={title} />
            <span className="badge drop-tag">{title}</span>
            <button
              type="button"
              className="icon-btn drop-remove"
              aria-label={`Rimuovi ${title}`}
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
            >
              <Icon name="x" />
            </button>
          </>
        ) : (
          <div className="drop-empty">
            <span className="drop-icon">
              <Icon name="upload" size={16} />
            </span>
            <b>{title}</b>
            <span>{hint}</span>
            <span className="mono" style={{ marginTop: 4 }}>
              Trascina qui o clicca · JPG, PNG, WebP
            </span>
          </div>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => take(e.target.files?.[0])} />
    </div>
  )
}

export function NewGarment({ example }: { example?: Example }) {
  const router = useRouter()
  const [sketch, setSketch] = useState<Chosen>(null)
  const [kind, setKind] = useState<"sketch" | "archive">("sketch")
  const [brief, setBrief] = useState("")
  const [name, setName] = useState("")
  const [sku, setSku] = useState("")
  const [maison, setMaison] = useState("Aurenzi Milano")
  const [line, setLine] = useState<"donna" | "uomo">("donna")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => sketch?.file && URL.revokeObjectURL(sketch.preview), [sketch])

  const useExample = () => {
    if (!example?.sketch) return
    setKind("sketch")
    setSketch({ from: example.sketch, preview: `/api/media/${example.sketch}` })
    setBrief(example.brief)
    setName(`${example.name} · live`)
    setMaison(example.maison)
  }

  const ai = !sketch
  const ready = !!brief.trim()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    const form = new FormData()
    if (sketch) {
      if (sketch.file) form.set(kind, sketch.file)
      else if (sketch.from) form.set(`${kind}From`, sketch.from)
    }
    form.set("start", ai ? "ai" : "sketch")
    form.set("brief", brief)
    form.set("name", name)
    form.set("sku", sku)
    form.set("maison", maison)
    form.set("line", line)
    try {
      const res = await fetch("/api/garments", { method: "POST", body: form })
      const data = (await res.json()) as { id?: string; error?: string }
      if (!res.ok || !data.id) throw new Error(data.error ?? "Creazione non riuscita")
      router.push(`/g/${data.id}?step=input`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <main className="new">
      <div className="page-head enter">
        <h1 className="page-title">Nuovo prodotto</h1>
      </div>

      <form onSubmit={submit} className="enter" style={{ "--d": "60ms" } as React.CSSProperties}>
        <div className="drops one">
          <Drop title={!sketch ? "Foto o bozzetto" : kind === "archive" ? "Foto d'archivio" : "Bozzetto"} hint="Facoltativo. Senza immagine lo disegna l'AI." value={sketch} onChange={setSketch} />
        </div>

        <textarea
          id="brief"
          aria-label="Descrizione del prodotto"
          className="textarea"
          style={{ marginTop: 16 }}
          placeholder="Descrivi il prodotto. es. borsa mini, tela GG beige e marrone, catena 18 cm, 19 × 10 × 3 cm"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />

        <div className="form-actions">
          {error ? (
            <span className="error" role="alert" style={{ marginTop: 0 }}>
              {error}
            </span>
          ) : (
            <span />
          )}
          <button className="btn primary lg" type="submit" disabled={!ready || busy}>
            {busy ? <span className="spinner" /> : <Icon name="arrow" />}
            {busy ? "Creo il prodotto…" : ai ? "Fallo creare" : "Crea il prodotto"}
          </button>
        </div>

        <details className="advanced">
          <summary>Avanzate</summary>
          {example?.sketch && (
            <button type="button" className="btn ghost sm" onClick={useExample}>
              <Icon name="image" /> Usa il bozzetto di esempio
            </button>
          )}
          {sketch && (
            <div>
              <span className="label">L&apos;immagine è</span>
              <div className="seg" role="group" aria-label="Che immagine è">
                <button type="button" aria-pressed={kind === "sketch"} onClick={() => setKind("sketch")}>
                  Un bozzetto
                </button>
                <button type="button" aria-pressed={kind === "archive"} onClick={() => setKind("archive")}>
                  Una foto d&apos;archivio
                </button>
              </div>
            </div>
          )}
          <div>
            <span className="label">Linea</span>
            <div className="seg" role="group" aria-label="Linea">
              <button type="button" aria-pressed={line === "donna"} onClick={() => setLine("donna")}>
                Donna
              </button>
              <button type="button" aria-pressed={line === "uomo"} onClick={() => setLine("uomo")}>
                Uomo
              </button>
            </div>
          </div>
          <div className="form-grid">
            <div>
              <label className="label" htmlFor="name">
                Nome
              </label>
              <input id="name" className="field-input" placeholder="Nuovo capo" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="sku">
                SKU
              </label>
              <input id="sku" className="field-input mono" style={{ fontSize: 13 }} placeholder="Automatico" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="label" htmlFor="maison">
                Maison
              </label>
              <input id="maison" className="field-input" value={maison} onChange={(e) => setMaison(e.target.value)} />
            </div>
          </div>
        </details>
      </form>
    </main>
  )
}
