"use client"

import { useMemo, useState } from "react"
import { BRAND_LORA_PROFILES, type BrandLoraProfile, type LoraTagCategory } from "@/lib/brand-lora"
import { Icon } from "./kit"
import { useWs } from "./workspace"

const CAT_LABEL: Record<LoraTagCategory, string> = {
  fabric: "Tessuto",
  texture: "Texture",
  hardware: "Minuteria",
  colour: "Colore",
  finish: "Finitura",
}

export function BrandDnaDialog({ onClose }: { onClose: () => void }) {
  const { ws, act } = useWs()
  const defaultId = BRAND_LORA_PROFILES.find((b) => b.maison === ws.garment.maison)?.id ?? BRAND_LORA_PROFILES[0].id
  const [brandId, setBrandId] = useState(defaultId)
  const [busy, setBusy] = useState(false)
  const brand = useMemo(() => BRAND_LORA_PROFILES.find((b) => b.id === brandId)!, [brandId])
  const hasDna = !!ws.garment.dna
  const locked = busy

  const run = async () => {
    setBusy(true)
    await act({ type: "brand-dna", brandId })
    setBusy(false)
    onClose()
  }

  return (
    <>
      <div className="dialog-scrim" onClick={() => !busy && onClose()} />
      <div className="dialog card brand-dna-dialog" role="dialog" aria-modal="true" aria-labelledby="brand-dna-title">
        <header className="dialog-head">
          <div>
            <h2 id="brand-dna-title">Scrivi con AI</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Scegli il brand e riscrivi tessuti, texture e minuteria con i tag che il LoRA usa in generazione.
            </p>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} disabled={busy} aria-label="Chiudi">
            <Icon name="x" />
          </button>
        </header>

        <div className="brand-pick" role="radiogroup" aria-label="Brand">
          {BRAND_LORA_PROFILES.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={brandId === b.id}
              className={`brand-card ${brandId === b.id ? "on" : ""}`}
              onClick={() => setBrandId(b.id)}
              disabled={busy}
            >
              <b>{b.label}</b>
              <span className="mono muted">{b.lora.file}</span>
            </button>
          ))}
        </div>

        <BrandLoraPanel brand={brand} />

        {!hasDna && (
          <p className="dialog-note err">Estrai prima il DNA dal bozzetto, poi puoi riscriverlo con il lessico del brand.</p>
        )}
        {ws.garment.dnaConfirmed && (
          <p className="dialog-note">I vincoli confermati verranno riscritti: dovrai confermarli di nuovo prima dei render.</p>
        )}

        <footer className="dialog-foot">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Annulla
          </button>
          <button type="button" className="btn primary" onClick={run} disabled={locked || !hasDna}>
            {busy ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="spark" size={12} />}
            Scrivi vincoli
          </button>
        </footer>
      </div>
    </>
  )
}

function BrandLoraPanel({ brand }: { brand: BrandLoraProfile }) {
  const byCat = useMemo(() => {
    const m = new Map<LoraTagCategory, typeof brand.tags>()
    for (const t of brand.tags) {
      const list = m.get(t.category) ?? []
      list.push(t)
      m.set(t.category, list)
    }
    return m
  }, [brand])

  return (
    <div className="brand-lora-panel">
      <div className="brand-lora-meta mono muted">
        LoRA <span>{brand.lora.file}</span> · strength {brand.lora.strength} · base {brand.lora.base}
      </div>
      {([...byCat.entries()] as Array<[LoraTagCategory, typeof brand.tags]>).map(([cat, tags]) => (
        <section key={cat} className="brand-tag-group">
          <h3 className="caps">{CAT_LABEL[cat]}</h3>
          <ul className="brand-tags">
            {tags.map((t) => (
              <li key={t.token} className="lora-tag" data-cat={cat}>
                <div className="lora-tag-head">
                  <code>{t.token}</code>
                  <span>{t.label}</span>
                </div>
                <p>{t.loraNote}</p>
                <div className="lora-tag-foot">
                  <span className="mono muted">DNA → {t.fieldKeys.join(", ")}</span>
                  <span className="lora-snippet" title="Come entra nel prompt">
                    {t.promptSnippet}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function BrandDnaWriteButton({ disabled, className }: { disabled?: boolean; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className ?? "btn secondary sm"} disabled={disabled} onClick={() => setOpen(true)}>
        <Icon name="spark" size={12} /> Scrivi con AI
      </button>
      {open && <BrandDnaDialog onClose={() => setOpen(false)} />}
    </>
  )
}
