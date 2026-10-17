"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import type { BrandIdentity } from "@/lib/brand-identity"
import { Icon } from "../ui/kit"

const ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"

/** Upload of the corporate identity document, and the characteristics Evolus read from it. */
export function IdentityView({ identity }: { identity?: BrandIdentity }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    const form = new FormData()
    form.append("file", file)
    const res = await fetch("/api/brand/identity", { method: "POST", body: form })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    setBusy(false)
    if (!res.ok) return setError(data.error ?? "The document could not be read")
    router.refresh()
  }

  return (
    <section className="brand-block identity">
      <header className="brand-block-head">
        <h2>Corporate identity</h2>
        <p className="muted">
          Upload the brand book or guidelines. Evolus reads the document and the brand characteristics are rewritten from it; &quot;Write with AI&quot; then keeps
          every product inside them.
        </p>
      </header>

      <div className="identity-upload">
        <input
          ref={input}
          id="identity-file"
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
            e.target.value = ""
          }}
        />
        <button type="button" className="btn primary sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="spark" size={12} />}
          {busy ? "Reading the document…" : identity ? "Upload a new document" : "Upload identity document"}
        </button>
        <span className="muted mono">PDF, DOCX, TXT, MD or image · up to 20 MB</span>
        {identity && (
          <span className="muted mono">
            From {identity.source.file} · {new Date(identity.source.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · {identity.source.model}
          </span>
        )}
      </div>
      {error && <p className="dialog-note err">{error}</p>}

      {identity && (
        <div className="identity-grid">
          {identity.tone && <Field label="Tone of voice" items={[identity.tone]} />}
          <Field label="Values" items={identity.values} />
          <Field label="Materials" items={identity.materials} />
          <Field label="Signatures" items={identity.signatures} />
          <Field label="Never" items={identity.avoid} />
          {identity.palette.length > 0 && (
            <div className="identity-field">
              <span className="caps">Palette</span>
              <ul className="brand-palette">
                {identity.palette.map((c) => (
                  <li key={c.name}>
                    <span className="swatch" style={{ background: c.hex }} />
                    <span>{c.name}</span>
                    <span className="mono muted">{c.hex}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Field({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="identity-field">
      <span className="caps">{label}</span>
      <ul>
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  )
}
