/**
 * The shared cast: fictional base bodies, generated once and reused by every garment.
 * Each model has a front, a back and a three-quarter view in the same neutral base layer, so a worn shot only has to
 * add the garment instead of replacing the clothes the reference was generated in, and a back-view look gets a real
 * back reference instead of inventing one from a frontal photo.
 * Wording follows the moderation rules of ugc.ts: the base layer is ordinary opaque clothing, never intimate wear
 * and never athletic or cycling gear, which makes the figure read muscular. No banned body-part or exposure words.
 */

import { voice } from "../line"
import type { CastView } from "../types"

export type { CastView }

export const CAST_VIEWS: CastView[] = ["front", "back", "side"]

export const VIEW_LABEL: Record<CastView, string> = { front: "Fronte", back: "Retro", side: "Tre quarti" }

export type CastModel = {
  id: string
  line: "donna" | "uomo"
  /** Italian, the name the UI shows */
  label: string
  /** Italian, one line for the UI */
  note: string
  /** English, no body words: age, origin, hair, height and build as a clothing size */
  look: string
}

/**
 * Three base bodies in the same range as the UGC creators: early 20s, slim, photogenic, different hair and origin,
 * all invented (no real faces). New ids when a model changes, so her old portraits are not reused.
 */
export const CAST: CastModel[] = [
  {
    id: "model-10",
    line: "donna",
    label: "Modella A",
    note: "23 anni, taglia IT 36, castana.",
    look: "early 20s Italian woman, long straight chestnut hair worn down, brown eyes, softly groomed brows, very slender sample-size fashion model, narrow frame, fine narrow lower legs and narrow ankles, wears Italian size 36 clothes, about 176 cm",
  },
  {
    id: "model-11",
    line: "donna",
    label: "Modella B",
    note: "24 anni, taglia IT 36, bob nero.",
    look: "mid 20s Southern Italian woman, short black bob, dark brown eyes, high cheekbones, very slender sample-size fashion model, narrow frame, fine narrow lower legs and narrow ankles, wears Italian size 36 clothes, about 174 cm",
  },
  {
    id: "model-12",
    line: "donna",
    label: "Modella C",
    note: "22 anni, taglia IT 36, treccine.",
    look: "early 20s Black Italian woman, long braids worn down past the shoulders, warm brown eyes, very slender sample-size fashion model, narrow frame, fine narrow lower legs and narrow ankles, tall, wears Italian size 36 clothes, about 180 cm",
  },
]

/** Men's line: same job as the women's cast, lean rather than athletic so the figure does not read as gym wear. */
export const CAST_MEN: CastModel[] = [
  {
    id: "model-m1",
    line: "uomo",
    label: "Modello A",
    note: "26 anni, taglia IT 48, castano.",
    look: "mid 20s Italian man, short chestnut hair, brown eyes, light stubble, lean fashion-model build, wears Italian size 48 clothes, about 186 cm",
  },
  {
    id: "model-m2",
    line: "uomo",
    label: "Modello B",
    note: "24 anni, taglia IT 48, ricci neri.",
    look: "mid 20s Southern Italian man, short dark curly hair, dark brown eyes, clean-shaven, lean fashion-model build, wears Italian size 48 clothes, about 182 cm",
  },
  {
    id: "model-m3",
    line: "uomo",
    label: "Modello C",
    note: "27 anni, taglia IT 50, barba corta.",
    look: "late 20s Black Italian man, very short cropped hair, warm brown eyes, short beard, lean fashion-model build, tall, wears Italian size 50 clothes, about 188 cm",
  },
]

export const allCast = () => [...CAST, ...CAST_MEN]

export function castFor(line: "donna" | "uomo"): CastModel[] {
  return line === "uomo" ? CAST_MEN : CAST
}

/**
 * The layer every cast model is generated in. Two jobs: it keeps the reference to a clean silhouette an editor can dress
 * without undressing her first, and it stays outside the vocabulary the content checkers block.
 */
export const CAST_BASE =
  "a plain matte mid-grey seamless set: a loose sleeveless top and matching straight shorts ending above the knee, opaque fabric, no print and no logo"

const POSE: Record<CastView, string> = {
  front:
    "She stands straight facing the camera, weight even on both feet, arms relaxed and held slightly clear of her sides so the whole silhouette reads, neutral calm expression.",
  back: "She stands straight with her back to the camera, head level and facing away, weight even on both feet, arms relaxed and held slightly clear of her sides.",
  side: "She stands turned roughly 45 degrees toward her left so that one shoulder leads, shoulders and stance following the turn, face in three-quarter profile toward the camera, arms relaxed at her sides.",
}

export const castLabel = (modelId: string, view: CastView) => `${modelId}:${view}`

/** The model and view a cast asset belongs to, from its label. */
export function castParts(label: string | undefined): { modelId: string; view: CastView } | undefined {
  const [modelId, view] = (label ?? "").split(":")
  return allCast().some((m) => m.id === modelId) && CAST_VIEWS.includes(view as CastView) ? { modelId, view: view as CastView } : undefined
}

export function castModel(id: string): CastModel {
  const found = allCast().find((m) => m.id === id)
  if (!found) throw new Error(`cast sconosciuto: ${id} (disponibili: ${allCast().map((m) => m.id).join(", ")})`)
  return found
}

/** `withFront` passes the model's own front view as Image 1: the back and side views are the same woman, not a lookalike. */
export function castPrompt(model: CastModel, view: CastView, withFront = false): string {
  const same = withFront
    ? "Image 1 is the approved front reference of this same fictional adult model: keep her face, her hair, her very slender frame and the grey set she wears there identical. Only the angle and the pose change.\n"
    : ""
  const figure = model.line === "uomo" ? "His build is lean, the proportions of a menswear lookbook." : "Her figure is very slender, with fine narrow lower legs and narrow ankles."
  const text = `${same}Photorealistic full-body studio reference photograph of a fictional adult fashion model on a commercial job: ${model.look}.
${figure}
She wears ${CAST_BASE}. Both feet are flat on the studio floor.
${POSE[view]}
Plain light grey seamless studio background, soft even frontal light, the whole figure in frame from head to toe with margin.
Original invented face, natural skin texture with visible pores, catalogue photography.
Style: neutral studio reference, relaxed upright posture, no props, no text, no logo, no watermark.`
  return voice(text, model.line)
}

/** A correction on a base body: no garment in play, so the edit stays inside the reference itself. */
export function castRefinePrompt(instruction: string): string {
  return `Edit Image 1, a studio reference photograph of a fictional adult fashion model. Change ONLY this: ${instruction}
Everything else stays exactly as in Image 1: her face, her hair, her very slender frame, the grey set she wears, her pose, the grey studio background, the lighting and the framing.`
}
