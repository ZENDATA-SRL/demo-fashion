"use client"

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { BRAND_LORA_PROFILES, type BrandLoraProfile, type LoraTag, type LoraTagCategory } from "@/lib/brand-lora"
import { Icon } from "./kit"
import { useWs } from "./workspace"

const CAT_LABEL: Record<LoraTagCategory, string> = {
  fabric: "Tessuto",
  texture: "Texture",
  hardware: "Minuteria",
  colour: "Colore",
  finish: "Finitura",
}

const MENTION = /@([\w]*)$/
const TOKENS = /(@\w+)/g

export function BrandDnaDialog({ onClose }: { onClose: () => void }) {
  const { ws, act } = useWs()
  const defaultId = BRAND_LORA_PROFILES.find((b) => b.maison === ws.garment.maison)?.id ?? BRAND_LORA_PROFILES[0].id
  const [brandId, setBrandId] = useState(defaultId)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const brand = useMemo(() => BRAND_LORA_PROFILES.find((b) => b.id === brandId)!, [brandId])
  const hasDna = !!ws.garment.dna

  const run = async () => {
    setBusy(true)
    await act({ type: "brand-dna", brandId, ...(note.trim() ? { note: note.trim() } : {}) })
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
              Descrivi tessuti, texture e minuteria. Digita <kbd>@</kbd> per inserire un tag del LoRA del brand.
            </p>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} disabled={busy} aria-label="Chiudi">
            <Icon name="x" />
          </button>
        </header>

        <div className="brand-dna-body">
          <div className="brand-pick" role="radiogroup" aria-label="Brand">
            {BRAND_LORA_PROFILES.map((b) => (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={brandId === b.id}
                className={`brand-chip ${brandId === b.id ? "on" : ""}`}
                onClick={() => setBrandId(b.id)}
                disabled={busy}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="brand-lora-meta mono muted">
            LoRA <span>{brand.lora.file}</span> · strength {brand.lora.strength} · {brand.lora.base}
          </div>

          <TagComposer brand={brand} value={note} onChange={setNote} disabled={busy} />
          <UsedTags brand={brand} note={note} />
        </div>

        {!hasDna && <p className="dialog-note err">Estrai prima il DNA dal bozzetto, poi puoi riscriverlo con il lessico del brand.</p>}
        {ws.garment.dnaConfirmed && <p className="dialog-note">I vincoli confermati verranno riscritti: dovrai confermarli di nuovo prima dei render.</p>}

        <footer className="dialog-foot">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Annulla
          </button>
          <button type="button" className="btn primary" onClick={run} disabled={busy || !hasDna}>
            {busy ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="spark" size={12} />}
            Scrivi vincoli
          </button>
        </footer>
      </div>
    </>
  )
}

/** A textarea with @-mentions: the menu lists the selected brand's LoRA tags, filtered by what follows the @. */
function TagComposer({ brand, value, onChange, disabled }: { brand: BrandLoraProfile; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const area = useRef<HTMLTextAreaElement>(null)
  const mirror = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const known = useMemo(() => new Set(brand.tags.map((t) => t.token)), [brand])

  const matches = useMemo(() => {
    if (query === null) return []
    const q = query.toLowerCase()
    return brand.tags.filter((t) => t.token.includes(q) || t.label.toLowerCase().includes(q))
  }, [brand, query])

  useEffect(() => setActive(0), [query, brand])

  const sync = () => {
    const el = area.current
    if (!el) return
    const m = el.value.slice(0, el.selectionStart).match(MENTION)
    setQuery(m ? m[1] : null)
    if (mirror.current) mirror.current.scrollTop = el.scrollTop
  }

  const insert = (tag: LoraTag) => {
    const el = area.current
    if (!el) return
    const caret = el.selectionStart
    const before = value.slice(0, caret).replace(MENTION, `@${tag.token} `)
    const next = before + value.slice(caret).replace(/^\w*\s?/, "")
    onChange(next)
    setQuery(null)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(before.length, before.length)
    })
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!matches.length) return
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length)
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      insert(matches[active])
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      setQuery(null)
    }
  }

  const [a, b] = brand.tags
  const placeholder = `Es. pelle liscia semirigida @${a.token}, manici con @${b.token}…`

  return (
    <div className="tag-composer">
      <div className="tag-composer-field">
        <div className="tag-composer-mirror" ref={mirror} aria-hidden>
          {value.split(TOKENS).map((part, i) =>
            part.startsWith("@") && known.has(part.slice(1)) ? (
              <mark key={i}>{part}</mark>
            ) : (
              <Fragment key={i}>{part}</Fragment>
            ),
          )}
          {"\n"}
        </div>
        <textarea
          ref={area}
          value={value}
          placeholder={placeholder}
          rows={5}
          disabled={disabled}
          spellCheck={false}
          onChange={(e) => {
            onChange(e.target.value)
            requestAnimationFrame(sync)
          }}
          onKeyDown={onKey}
          onKeyUp={(e) => !["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key) && sync()}
          onClick={sync}
          onScroll={sync}
          onBlur={() => setTimeout(() => setQuery(null), 120)}
          aria-label="Descrizione con tag LoRA"
          aria-autocomplete="list"
          aria-expanded={matches.length > 0}
        />
      </div>
      {matches.length > 0 && (
        <ul className="tag-menu" role="listbox" aria-label={`Tag ${brand.label}`}>
          {matches.map((t, i) => (
            <li key={t.token} role="option" aria-selected={i === active}>
              <button type="button" data-cat={t.category} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => insert(t)}>
                <code>@{t.token}</code>
                <span>{t.label}</span>
                <em>{CAT_LABEL[t.category]}</em>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The tags named in the text, with what each one steers. */
function UsedTags({ brand, note }: { brand: BrandLoraProfile; note: string }) {
  const used = useMemo(() => {
    const names = new Set([...note.matchAll(TOKENS)].map((m) => m[1].slice(1)))
    return brand.tags.filter((t) => names.has(t.token))
  }, [brand, note])

  if (!used.length) return <p className="tag-used-empty muted">Nessun tag: l’AI sceglie da sola fra i tag del brand.</p>
  return (
    <ul className="tag-used">
      {used.map((t) => (
        <li key={t.token} data-cat={t.category} title={t.loraNote}>
          <code>@{t.token}</code>
          <span>{t.label}</span>
          <em className="mono">→ {t.fieldKeys.join(", ")}</em>
        </li>
      ))}
    </ul>
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
