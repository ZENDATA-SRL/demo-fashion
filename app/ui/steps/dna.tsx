"use client"

import { useState } from "react"
import type { DnaField, ShootPlan, Source, Workspace } from "@/lib/workspace-types"
import { BrandDnaWriteButton } from "../brand-dna-dialog"
import { Hint, Icon } from "../kit"
import { JobBanner } from "../bench"
import { StepHead, useWs } from "../workspace"

export const SOURCE_LABEL: Record<Source, string> = {
  sketch: "Flat",
  archive: "Archivio",
  note: "Nota",
  invented: "Inventato",
  measured: "Misurato",
}

/** The constraints of the product. Embedded in the sketch step it shows only the critical fields and one action. */
export function DnaStep({ embedded = false }: { embedded?: boolean }) {
  const { ws, act, patch } = useWs()
  const dna = ws.garment.dna
  const [filter, setFilter] = useState<Source | "all" | "critical">("all")
  const [tab, setTab] = useState<"fields" | "plan">("fields")
  const busy = planBusy(ws)

  const head = embedded ? null : (
    <StepHead
      actions={
        dna && !busy ? (
          ws.garment.dnaConfirmed ? (
            <span className="badge ok">
              <Icon name="check" size={10} /> Confermato
            </span>
          ) : (
            <>
              <button className="btn ghost" onClick={() => act({ type: "dna" })}>
                Riestrai
              </button>
              <button className="btn primary" onClick={() => patch({ confirmDna: true })}>
                <Icon name="check" /> Conferma il DNA
              </button>
            </>
          )
        ) : undefined
      }
    />
  )

  if (!dna) {
    return (
      <>
        {head}
        <JobBanner target="dna" />
        <JobBanner target="input" />
        {busy ? (
          <div className="card table fill scroll">
            {Array.from({ length: 8 }, (_, i) => (
              <div className="row" key={i}>
                <span className="skeleton" style={{ height: 12, width: 110, borderRadius: 4 }} />
                <span className="skeleton" style={{ height: 12, width: `${50 + ((i * 17) % 40)}%`, borderRadius: 4 }} />
                <span className="skeleton" style={{ height: 12, width: 60, borderRadius: 4 }} />
                <span />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>Il DNA non è ancora stato estratto</h3>
            <p>Leggiamo il bozzetto, l&apos;archivio e la nota e scriviamo ogni dettaglio del capo, misure comprese, con la sua fonte.</p>
            <button className="btn primary" onClick={() => act({ type: "dna" })}>
              <Icon name="spark" /> Estrai il DNA
            </button>
          </div>
        )}
      </>
    )
  }

  const count = (f: typeof filter) =>
    f === "all" ? dna.fields.length : f === "critical" ? dna.fields.filter((x) => x.critical).length : dna.fields.filter((x) => x.source === f).length
  const filters = (["all", "critical", "note", "sketch", "archive", "measured", "invented"] as const).filter((f) => count(f) > 0)
  const hex = dna.fields.find((f) => f.key === "colour_hex")?.value.match(/#[0-9a-f]{6}/i)?.[0]

  if (embedded) {
    const rows = dna.fields.filter((f) => f.critical)
    return (
      <div className="constraints">
        <p className="step-lede">
          {ws.garment.dnaConfirmed
            ? "Vincoli confermati. Ogni concept, render e video viene controllato su questi."
            : "Letti dal bozzetto e dalla nota. Correggi un valore cliccandolo, poi conferma: ogni immagine dopo viene controllata su questi."}
        </p>
        <div className="card table scroll constraints-table">
          {rows.map((f) => (
            <FieldRow key={f.key} field={f} dim={false} onChange={(change) => patch({ field: { key: f.key, ...change } })} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {head}
      <JobBanner target="dna" />
      <div className="dna-summary" style={hex ? ({ "--sw": hex } as React.CSSProperties) : undefined}>
        <i aria-hidden />
        <p title={dna.summary}>{dna.summary}</p>
      </div>
      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Sezione">
          <button id="tab-fields" role="tab" aria-selected={tab === "fields"} aria-controls="panel-dna" onClick={() => setTab("fields")}>
            Campi <span className="mono muted">{dna.fields.length}</span>
          </button>
          <button id="tab-plan" role="tab" aria-selected={tab === "plan"} aria-controls="panel-dna" onClick={() => setTab("plan")}>
            Piano di scatti
          </button>
        </div>
        {tab === "fields" ? (
          <div className="toolbar-right">
            <BrandDnaWriteButton disabled={busy} />
            {!ws.garment.dnaConfirmed && (
              <span className="toolbar-note">
                <Icon name="pen" size={12} /> Clicca un valore per correggerlo
                <Hint align="right">
                  Rivedi prima di confermare. Fonte e criticità si cambiano dalla riga. I campi critici diventano i controlli su ogni immagine. Estratto da {dna.model}.
                </Hint>
              </span>
            )}
            <div className="seg" role="group" aria-label="Filtra">
              {filters.map((f) => (
                <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === "all" ? "Tutti" : f === "critical" ? "Critici" : SOURCE_LABEL[f]} <span className="mono muted">{count(f)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ShootPlanActions />
        )}
      </div>
      {tab === "fields" ? (
        <div className="card table fill scroll" id="panel-dna" role="tabpanel" aria-labelledby="tab-fields">
          <div className="row head">
            <span className="caps">Campo</span>
            <span className="caps">Valore</span>
            <span className="caps">Fonte</span>
            <span className="caps">Critico</span>
          </div>
          {dna.fields.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              dim={filter !== "all" && (filter === "critical" ? !f.critical : f.source !== filter)}
              onChange={(change) => patch({ field: { key: f.key, ...change } })}
            />
          ))}
        </div>
      ) : (
        <ShootPlanCard />
      )}
    </>
  )
}

/** The rows of the shoot plan in reading order: [dotted path, Italian label]. */
function planRows(plan: ShootPlan, formats: Workspace["formats"]): Array<[string, string]> {
  const d1 = plan.details["detail-button"].label
  const d2 = plan.details["detail-fabric"].label
  return [
    ["noun", "Nome nei prompt"],
    ["description", "Descrizione"],
    ["identity", "Da non perdere mai"],
    ["lock", "Da tenere identico"],
    ["scale", "Proporzioni sul corpo"],
    ["views.front", "Fronte"],
    ["views.back", "Retro"],
    ["views.side", "Tre quarti"],
    ["details.detail-button.label", "Dettaglio 1 · nome"],
    ["details.detail-button.region", `${d1} · zona`],
    ["details.detail-button.shot", `${d1} · scatto`],
    ["details.detail-fabric.label", "Dettaglio 2 · nome"],
    ["details.detail-fabric.region", `${d2} · zona`],
    ["details.detail-fabric.shot", `${d2} · scatto`],
    ...(plan.hardware
      ? ([
          ["hardware.label", "Minuteria"],
          ["hardware.target", "Minuteria · dove"],
        ] as Array<[string, string]>)
      : []),
    ["outfit", "Look della modella"],
    ["wear", "Come lo indossa"],
    ["ugc.wear", "UGC · come lo indossa"],
    ["ugc.show", "UGC · cosa mostra"],
    ["ugc.touch", "UGC · cosa tocca"],
    ...formats.flatMap((f): Array<[string, string]> =>
      plan.ugc.copy[f.id]
        ? [
            [`ugc.copy.${f.id}.hook`, `${f.label} · ipotesi`],
            ...(f.speaks ? [[`ugc.copy.${f.id}.line`, `${f.label} · battuta`] as [string, string]] : []),
          ]
        : [],
    ),
    ...plan.zones.map((z, i): [string, string] => [`zones.${i}.target`, `Confronto · ${z.label}`]),
    ...plan.backZones.map((_, i): [string, string] => [`backZones.${i}`, `Controllo retro ${i + 1}`]),
  ]
}

function textAt(plan: ShootPlan, path: string): string {
  const v = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | null | undefined)?.[k], plan)
  return typeof v === "string" ? v : ""
}

const planBusy = (ws: Workspace) => ws.jobs.some((j) => j.status === "running" && (j.target === "shoot" || j.target === "dna" || j.target === "input"))

function ShootPlanActions() {
  const { ws, act } = useWs()
  return (
    <div className="toolbar-right">
      <span className="toolbar-note">
        Frasi che entrano nei prompt
        <Hint align="right">
          Le frasi di questo capo che entrano nei prompt di viste, indossato e UGC. Sfondo, luce e formato restano fissi. Nelle immagini con una persona il DNA completo non entra
          nel prompt: al suo posto vanno descrizione e dettagli da non perdere, scritti in modo da passare i filtri.
        </Hint>
      </span>
      {!planBusy(ws) && ws.garment.dna && (
        <button className="btn secondary sm" onClick={() => act({ type: "shoot" })}>
          {ws.garment.shoot ? "Riscrivi dal DNA" : "Scrivi il piano"}
        </button>
      )}
    </div>
  )
}

function ShootPlanCard() {
  const { ws, patch } = useWs()
  const plan = ws.garment.shoot
  const busy = planBusy(ws)
  return (
    <>
      <JobBanner target="shoot" />
      {plan ? (
        <div className="card table fill scroll" id="panel-dna" role="tabpanel" aria-labelledby="tab-plan">
          {planRows(plan, ws.formats).map(([path, label]) => (
            <div className="row plan" key={`${path}:${plan.at}`}>
              <span className="row-label">{label}</span>
              <EditableText value={textAt(plan, path)} label={label} onSave={(value) => patch({ shoot: { path, value } })} />
            </div>
          ))}
        </div>
      ) : (
        !busy && (
          <div className="empty">
            <h3>Nessun piano di scatti</h3>
            <p>Viene scritto dal DNA alla prima generazione, oppure adesso.</p>
          </div>
        )
      )}
    </>
  )
}

function EditableText({ value, label, onSave }: { value: string; label: string; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const save = () => {
    setEditing(false)
    if (draft.trim() && draft.trim() !== value) onSave(draft.trim())
    else setDraft(value)
  }
  return (
    <div className="row-value">
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              save()
            }
            if (e.key === "Escape") {
              setDraft(value)
              setEditing(false)
            }
          }}
          aria-label={`Valore di ${label}`}
        />
      ) : (
        <button onClick={() => setEditing(true)} title="Modifica">
          {value}
        </button>
      )}
    </div>
  )
}

function FieldRow({ field: f, dim, onChange }: { field: DnaField; dim: boolean; onChange: (c: { value?: string; source?: Source; critical?: boolean }) => void }) {
  return (
    <div className="row" data-dim={dim}>
      <span className="row-label">{f.label}</span>
      <EditableText value={f.value} label={f.label} onSave={(value) => onChange({ value })} />
      <label className="src" data-s={f.source}>
        <select className="src-select" value={f.source} onChange={(e) => onChange({ source: e.target.value as Source })} aria-label={`Fonte di ${f.label}`}>
          {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <button className="crit" aria-pressed={f.critical} onClick={() => onChange({ critical: !f.critical })} aria-label={`${f.label} critico`}>
        <i /> {f.critical ? "Sì" : "No"}
      </button>
    </div>
  )
}
