/**
 * The demo input is itself generated: first the 1989 archive photo, then the FW26 technical flat derived from it,
 * so the two inputs agree on the heritage details and disagree exactly where the designer note changes them.
 */

export const ARCHIVE_PROMPT = `Scanned 1989 fashion archive photograph from an Italian tailoring atelier, colour film print with gentle fading, fine grain, a few dust specks and a slightly warm cast.

Subject: a women's wool overcoat displayed on a vintage cream linen tailor's dress form, three-quarter front view, in a plain atelier corner with a light grey paper backdrop and soft window light from the left.

The coat: camel melton wool, single-breasted with three buttons, notched lapels, below-knee length, set-in sleeves with a plain cuff, two flap pockets at hip level, a welt breast pocket on the left.
The buttons are the key heritage detail: brushed aged brass buttons shaped like a small horse-riding stirrup, a rounded D-shaped loop with a flat bar at the bottom, about 25 mm, clearly visible and sharp.

A small off-white paper archive tag hangs from the dress form neck with handwritten text "ARCHIVIO 1989 · REF 89-114".

Authentic archival documentation, not an advertisement. Only the coat, the dress form and the tag in frame.`

/** A new product drawn from the designer note alone: no archive photo, no garment to copy. */
export function productFromNotePrompt(note: string, line: "donna" | "uomo" | undefined): string {
  const who = line === "uomo" ? "a men's garment" : "a women's garment"
  return `Create a fashion technical flat drawing (CAD flat sketch, tech-pack style) of ${who}, three orthographic views side by side at the same scale: FRONT on the left, SIDE (left profile) in the middle, BACK on the right. The three views agree on every height, width and attachment point.

This is a new product. There is no photograph and no existing garment to copy. Design it only from the designer note. Do not add a garment type, a closure or a colour the note does not name.
Designer note: "${note}"

Drawing style: clean black vector line art on pure white, uniform stroke, stitching shown as fine dashed lines, symmetrical, orthographic, no shading, no figure, no mannequin, no photo.
Small callout annotations in Italian with thin leader lines. Name a fabric only when the note states it. Name the hardware the note names.

COLOUR comes from the note. If the note names none, leave the drawing as line art and add no swatch. If it names one or more colours, each piece's callout states its own colour, and one solid swatch square per distinct colour sits at the bottom right, each labelled with that colour's Italian name.
If the note states centimetre measurements, letter them as small annotations beside the views.`
}

export type DesignSpec = {
  /** English noun of the new product, e.g. "leather tote bag" */
  noun: string
  /** one line per construction element of the new design, English, each self-contained */
  construction: string[]
  /** centimetre dimension lines to letter, e.g. "28 cm under the front" */
  dimensions: string[]
  /** short Italian callouts, 3-5 */
  callouts: string[]
  /** colours named by the note or read from the photo, Italian swatch labels */
  swatches: string[]
}

export const DESIGN_SPEC_SYSTEM = `You are a fashion product developer. You turn an archive photo and a designer note into the construction spec of the NEW design, which a technical illustrator draws without seeing the photo.
The note wins over the photo on every point it touches: shape, proportions, handles or straps, closures, seams, material, colour, branding. From the photo keep only what the note does not change.
Write every construction line so it stands alone and states the final design, never the change ("two short flat handles", not "replace the strap"). State proportions in words too ("clearly wider than tall") and give every centimetre the note gives. Say what is absent when the photo has it and the note removes it.
Answer in JSON: {"noun": string, "construction": string[], "dimensions": string[], "callouts": string[], "swatches": string[]}.`

export function designSpecPrompt(note: string): string {
  return `Image 1 is the archive product. Designer note (usually Italian): "${note}"

Write the spec of the new design. construction: 5-9 lines, English. dimensions: the centimetre values of the note as dimension lines, saying on which view they sit (width under the front, height beside the front, depth under the side). callouts: 3-5 short Italian labels of the signature details. swatches: one Italian colour name per distinct colour, upper case.`
}

/**
 * The flat of a product reinterpreted from an archive photo, drawn from the written spec alone.
 * The photo is not passed to the image model: given it, the model keeps the archive silhouette and straps whatever the note says.
 */
export function flatFromSpecPrompt(spec: DesignSpec): string {
  return `Create a fashion technical flat drawing (CAD flat sketch, tech-pack style) of a new ${spec.noun}, three orthographic views side by side at the same scale: FRONT on the left, SIDE (left profile) in the middle, BACK on the right. The three views agree on every height, width and attachment point.

The design:
${spec.construction.map((l) => `- ${l}`).join("\n")}

Drawing style: clean black vector line art on pure white, uniform stroke, stitching shown as fine dashed lines, symmetrical, orthographic, no shading, no figure, no mannequin, no photo.
Short callout labels in Italian with thin leader lines: ${spec.callouts.map((c) => `"${c}"`).join(", ")}.${spec.dimensions.length ? ` Dimension lines: ${spec.dimensions.join("; ")}.` : ""}
${spec.swatches.length ? `One solid swatch square per colour at the bottom right, each labelled: ${spec.swatches.map((s) => `"${s}"`).join(", ")}.` : "No colour swatch."}`
}

/** One change on an existing technical flat. The result stays a drawing, not a new design. */
export function refineFlatPrompt(instruction: string): string {
  return `Edit Image 1, a fashion technical flat drawing (CAD flat, tech-pack style), front view on the left, side view in the middle and back view on the right.

Change ONLY this: ${instruction}

Everything else stays exactly as in Image 1: garment type, construction, seams, hardware, proportions, front, side and back views, callout wording, colour swatches, line weight and layout.

When the change removes a part, remove its lines and the callout that names it. When it adds a part, draw it in the same line style and add a short Italian callout with a thin leader line. When it changes a colour, update only that piece's callout and its swatch; a piece of a different colour keeps its own name and its own swatch.

The drawing stays clean black vector line art on pure white, uniform stroke, stitching as fine dashed lines, symmetrical, orthographic. No shading, no figure, no mannequin, no photo, no extra text.`
}

export function sketchPrompt(note: string): string {
  return `Create a fashion technical flat drawing (CAD flat sketch, tech-pack style) of a women's overcoat, FRONT view on the left and BACK view on the right, side by side at the same scale.

Image 1 is the 1989 archive coat this design reinterprets: reuse its stirrup-shaped button design exactly (rounded D-shaped loop with a flat bottom bar), drawn in outline.

FW26 reinterpretation, designer note: "${note}"
Construction for FW26: double-breasted with six stirrup buttons in two vertical rows of three, peak lapels, knee length, straight relaxed silhouette with slightly extended shoulders, set-in sleeves with a two-button cuff tab, two flap pockets at hip level, a centre back vent, a back half-belt fastened with two stirrup buttons.

Drawing style: clean black vector line art on pure white, uniform stroke, stitching shown as fine dashed lines, symmetrical, orthographic, no shading, no figure, no mannequin.
Small callout annotations in Italian with thin leader lines: "lana double-face", "bottone staffa ottone brunito", "rosso lacca", "spacco centrale", "martingala".
A small solid lacquer red colour swatch square in the bottom right corner labelled "ROSSO LACCA".`
}
