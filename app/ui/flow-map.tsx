import { PHASES, STEPS } from "@/lib/steps"

/** The steps in their phases, numbered as in the workspace rail. */
export function FlowMap() {
  return (
    <div className="flow-map">
      {PHASES.map((p) => (
        <div key={p.id} className="flow-phase">
          <span className="caps">{p.label}</span>
          <ol className="flow">
            {STEPS.map((s, i) =>
              s.phase === p.id ? (
                <li key={s.id}>
                  <span className="mono">{i + 1}</span>
                  {s.label}
                </li>
              ) : null,
            )}
          </ol>
        </div>
      ))}
    </div>
  )
}
