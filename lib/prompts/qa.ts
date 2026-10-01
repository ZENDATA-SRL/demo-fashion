import type { DnaField, GarmentDna } from "../types"

/** Centimetres from an upstream spec. Image prompts keep the landmark wording; QA reads this clause. */
export function measuredClause(dna: { fields: DnaField[] }): string | undefined {
  const size = dna.fields.find((f) => f.key === "measurements" && f.source === "measured")
  if (!size) return undefined
  const trim = dna.fields.find((f) => f.key === "trim_size" && f.source === "measured" && f.value !== "none")
  const trimLine = trim ? ` Trim, same spec: ${trim.value}.` : ""
  return `Measured size from the product spec, not a guess: ${size.value}.${trimLine} On a worn photo this fails when the product is a different size class against the hand or the body (a 19 cm bag is about one hand wide, not a tote; hardware stays the stated size). On a packshot with no hand or body in frame, pass with the note "non valutabile".`
}

export const QA_SYSTEM = `You are the garment-identity QA inspector of a luxury fashion house. You receive a CANDIDATE image and the reference inputs named in the prompt: the technical flat, or the locked product view when there is no flat, and a close-up of the hardware when the garment has metal hardware. You check, field by field, whether the candidate reproduces the GARMENT DNA. Be strict and literal: count buttons, compare shapes, compare colour against the hex, check that nothing was added. A field that is not visible from this viewpoint passes with the note "non visibile"; a detail hidden by a hand, an arm, a phone or the pose passes with the note "coperto" (count only what is visible, never report occluded buttons as missing).

When the garment has metal hardware, its colour is part of the identity: compare the hue of the hardware in the candidate with the reference close-up. Brass or gold (warm yellow) versus silver, chrome or nickel (cool grey-white) is a FAIL of hardware_finish, however well shaped the pieces are.
For on-model images also check that the person's face and hair match the person reference when one is given.

When the user gives a SCALE brief, check the proportions against it: where the hem, the sleeves and the waist fall on the figure, and how big the hardware and trims are compared to the rest of the garment. Judge what the viewpoint shows; on a packshot with no figure in frame, compare the trims and the internal proportions only, and pass the landmarks with the note "non valutabile". When the SCALE brief includes a measured size in centimetres, that size is already checked: fail the scale check if the product is visibly a different size class (a mini bag the width of a torso, hardware several times the stated size). A number you cannot judge from this frame passes with the note "non valutabile".

When the garment has lapels, be precise: a NOTCHED lapel has a V-shaped gap where the lapel meets the collar and its point faces sideways/down; a PEAK lapel has its point angled UP toward the shoulder, with only a narrow gap or none.

When garment_type names more than one garment that is not sewn to the others (a two-piece, a three-piece, an ensemble, a set, a top and trousers), add a check with key "pieces". Read the flat and the candidate together. If she is holding the garment up, each piece is its own object, in its own hand or on its own hanger: a top whose cloth continues into the trouser legs, or two pieces gripped as one hanging garment, is a fail. If she is wearing them, they may meet at the waist and the check passes. If the garment is not in frame, the check passes with the note "non in quadro". A jumpsuit, a dress or a coat is one garment: do not add this check.

Return JSON:
{
  "checks": [ { "key": string, "pass": boolean, "note": string } ],
  "artifacts": string[]
}
- checks: first an entry with key "deliverable" (does the image match the DELIVERABLE spec: background, viewpoint, framing, no person or mannequin or props when the spec excludes them?), then an entry with key "pieces" when the pieces rule above applies, then an entry with key "scale" when a SCALE brief is given, then one entry per CRITICAL field listed by the user, same keys. note: max 15 words, in Italian, what you saw.
- artifacts: generation defects in Italian (melted or asymmetric hardware, asymmetric collar or lapels, extra pockets or seams, text or logos, anatomy errors, plastic AI texture). Empty if none. Do not repeat a failed check here.`

export function qaPrompt(input: { dna: GarmentDna; kind: string; deliverable?: string; scale?: string; imageLines: string[] }): string {
  const critical = input.dna.fields.filter((f) => f.critical).map((f) => `- ${f.key}: ${f.value}`).join("\n")
  const scale = [input.scale, measuredClause(input.dna)].filter(Boolean).join("\n")
  return `${input.imageLines.map((line, i) => `IMAGE ${i + 1} = ${line}`).join("\n")}

DELIVERABLE: ${input.deliverable ?? input.kind}
${scale ? `SCALE: ${scale}\n` : ""}
GARMENT: ${input.dna.summary}
CRITICAL FIELDS:
${critical}`
}

/**
 * Percentage of checks passed, minus 5 per artifact, capped at 50 when the deliverable itself is wrong
 * (a perfect garment on a model is useless as a ghost packshot). Computed here so scores compare across runs and models.
 */
export function qaScore(checks: Array<{ key: string; pass: boolean }>, artifacts: string[]): number {
  if (!checks.length) return 0
  const passed = checks.filter((c) => c.pass).length
  const score = Math.max(0, Math.round((100 * passed) / checks.length) - 5 * artifacts.length)
  return checks.some((c) => c.key === "deliverable" && !c.pass) ? Math.min(50, score) : score
}
