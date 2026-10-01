import type { AssetKind, GarmentDna, ShootPlan } from "../types"

export type RefRole = "sketch" | "front" | "side" | "back" | "button" | "region" | "model"

function roleText(role: RefRole, plan: ShootPlan): string {
  switch (role) {
    case "model":
      return `a front studio render of the approved 3D model of this exact ${plan.noun}, built to its real measurements: the truth for its shape, proportions, size, handles and seams`
    case "region":
      return "a crop of the approved front packshot showing exactly the area this close-up must show: the truth for which elements are in frame, how many there are and where they sit relative to each other"
    case "sketch":
      return "the FW26 technical flat: the truth for construction, proportions, closure, seams and back details"
    case "front":
      return `the approved front packshot of this exact ${plan.noun}: the truth for colour, fabric surface, trims and finish`
    case "side":
      return `the approved three-quarter packshot of this exact ${plan.noun}: the truth for depth, volume and length`
    case "back":
      return `the approved back packshot of this exact ${plan.noun}: the truth for the back construction, seams and trims`
    case "button":
      return `a close-up of ${plan.hardware?.label ?? "the hardware"}: the truth for its shape and finish`
  }
}

export function rolesText(roles: RefRole[], plan: ShootPlan): string {
  return roles.map((role, i) => `Image ${i + 1} is ${roleText(role, plan)}.`).join("\n")
}

const lockLine = (plan: ShootPlan) =>
  `Keep ${plan.lock} identical to the DNA below. Do not redesign the garment, do not add details that are not listed.`

/**
 * A dress, skirt or similar piece is the whole outfit. Outerwear stays over the clothes named in the plan, and a
 * bodysuit, slip or swimwear keeps its opaque layer. Everything else is the garment alone. Feet stay as in the
 * person reference: naming shoes in the prompt makes the editor add them.
 */
/** A bag is carried in the hand. Treating it as the only garment makes the model hang it from the shoulder. */
export function carried(plan: ShootPlan): boolean {
  return /\b(bag|tote|clutch|handbag|pouch)\b/.test(plan.noun) || /(held|carried) in (one )?hand/.test(`${plan.wear} ${plan.ugc.wear}`)
}

/** She holds the bag in one hand; `chain` is what a chain bag adds, a bag with handles hangs from them instead. */
export function hold(plan: ShootPlan, wear: string, chain: string): string {
  const chained = /\bchain\b/i.test(`${plan.description} ${plan.wear}`)
  return `She holds the ${plan.noun} in one hand: ${wear}.${chained ? chain : " It hangs from its handles at her side, not over her shoulder or across her torso."}`
}

export function wornAlone(plan: ShootPlan): boolean {
  if (carried(plan)) return false
  return !plan.ugc.over && !/bodysuit|slip|swim|lingerie/i.test(plan.noun)
}

/** How the on-model and studio shots dress her. Complete garments stay alone; the plan's extra layers apply only otherwise. */
export function onModelStyling(plan: ShootPlan): string {
  if (carried(plan)) {
    return `She keeps the clothes already on in Image 1. ${hold(plan, plan.wear, ` The chain stays in that hand. It does not go over her shoulder or across her torso. The ${plan.noun} is about one hand wide.`)}`
  }
  if (wornAlone(plan)) {
    return `She now wears only the ${plan.noun} shown in the other images. The ${plan.noun} is the only garment she has on. Her feet stay exactly as in Image 1, flat on the floor.`
  }
  return `She now wears the ${plan.noun} shown in the other images, with ${plan.outfit}. She wears it ${plan.wear}.`
}

/** Proportions in body landmarks: the one part of the plan that survives into the worn prompts, where the DNA stays out. */
export const scaleLine = (plan: ShootPlan) => (plan.scale ? `\nSCALE: ${plan.scale}` : "")

const PACKSHOT = "Pure white seamless background, soft even studio light, gentle contact shadow beneath"

/** Fixed deliverable of each shot, completed with the garment's own sentences from the shoot plan. */
export function shotSpec(kind: AssetKind, plan: ShootPlan): string | undefined {
  switch (kind) {
    case "ghost-front":
      return `Deliverable: e-commerce ghost mannequin packshot (invisible mannequin), FRONT view. ${plan.views.front} ${PACKSHOT}, the whole ${plan.noun} in frame with margin, true colour.`
    case "ghost-back":
      return `Deliverable: e-commerce ghost mannequin packshot (invisible mannequin), BACK view. ${plan.views.back} ${PACKSHOT}, the whole ${plan.noun} in frame with margin, true colour.`
    case "ghost-side":
      return `Deliverable: e-commerce ghost mannequin packshot (invisible mannequin), three-quarter FRONT-LEFT view. ${plan.views.side} ${PACKSHOT}, the whole ${plan.noun} in frame, true colour.`
    case "detail-button":
    case "detail-fabric":
      return `Deliverable: macro product detail photo, a closer re-shoot of exactly the area in the crop reference: ${plan.details[kind].shot} The same elements in the same positions and the same number, nothing added, nothing moved, no element brought in from elsewhere on the ${plan.noun}. True colour.`
    case "on-model":
      return carried(plan)
        ? `Deliverable: e-commerce on-model photo. She keeps the clothes of the person reference and holds the ${plan.noun} in one hand, ${plan.wear}. ${/\bchain\b/i.test(`${plan.description} ${plan.wear}`) ? "The chain does not go over her shoulder." : "It does not go over her shoulder."} Full body, facing the camera, plain light grey studio background, soft even light.`
        : `Deliverable: e-commerce on-model photo, the fictional adult model from the person reference ${wornAlone(plan) ? `wears only the ${plan.noun}. Her feet stay exactly as in the person reference, flat on the floor` : `wears the ${plan.noun} ${plan.wear}`}. Full body, facing the camera, plain light grey studio background, soft even light.`
    case "lookbook":
      return `Deliverable: studio fashion editorial photo, the fictional adult model from the person reference wears the ${plan.noun} in a styled pose on a seamless studio set with directional light. A back view, a turned head, a seated pose, a stool or armchair, wind in the hair and hard cast shadows are CORRECT here.`
    case "ugc-frame": {
      const pieces = plan.ugc.pieces?.map((p) => p.trim()).filter(Boolean) ?? []
      const held = pieces.length > 1 ? `holding each piece of the ${plan.noun} as its own garment (${pieces.join(", ")}), one piece per hand` : `holding it up facing the camera`
      return `Deliverable: vertical 9:16 amateur smartphone footage of a creator in a real place (room or street, mirror selfie or handheld), wearing the ${plan.noun} or ${held}, imperfect natural light. When she wears it: ${plan.ugc.over ? `the ${plan.noun} is outerwear, worn over her own clothes` : wornAlone(plan) ? `the ${plan.noun} is the only garment, with the shoes and legwear of the approved on-model photo. A jacket, a bag, an extra top or tights that photo does not show are WRONG` : `the ${plan.noun} is her outfit, worn ${plan.ugc.wear}`}. A phone in her hand, a messy background, passers-by out of focus and a non-studio look are CORRECT here.`
    }
  }
}

function dnaBlock(dna: GarmentDna): string {
  return `GARMENT: ${dna.summary}
GARMENT DNA:
${dna.fields.map((f) => `- ${f.key}: ${f.value}`).join("\n")}`
}

/** Packshots carry the whole DNA: no person in frame, so the content checkers let the construction vocabulary through. */
export function canonPrompt(kind: AssetKind, dna: GarmentDna, plan: ShootPlan, roles: RefRole[]): string {
  const shot = shotSpec(kind, plan)
  if (!shot) throw new Error(`nessun prompt canonico per ${kind}`)
  return `Photorealistic product photograph of a garment that must match its technical specification exactly.

${rolesText(roles, plan)}

${dnaBlock(dna)}
${scaleLine(plan)}

${lockLine(plan)}

${shot}
The garment is the only object in frame: no person, no visible mannequin, no hanger, no props, no text, no logo, no watermark.
If a reference is a 3D render, the new image is a photograph of that same product on the background this deliverable asks for. Do not copy the render's grey backdrop.`
}

/**
 * A correction of a shot where she is not wearing or holding the product. Naming the garment here makes the editor
 * put it on her, so the product stays out of the prompt entirely.
 */
export function refineOwnPrompt(instruction: string): string {
  return `Edit Image 1, a phone photo of a fictional adult creator in her own clothes. Change ONLY this: ${instruction}
Everything else stays exactly as in Image 1: her face, her hair, the room, the light and the framing.
No product garment is in this photo. Do not add one. No text, no logo, no watermark.`
}

/** Targeted repair: one change on an existing image, everything else frozen (multi-turn editing, not regeneration). */
export function refinePrompt(instruction: string, dna: GarmentDna, plan: ShootPlan, roles: RefRole[], worn: boolean): string {
  const garment = worn ? `GARMENT: ${plan.description}, with ${plan.identity}.` : dnaBlock(dna)
  return `Edit Image 1, a product photo of this ${plan.noun}. Change ONLY this: ${instruction}
Everything else stays exactly as in Image 1: background, lighting, framing, camera angle, colour, fabric texture, trims, hardware, seams and proportions.

Image 1 is the photo to edit.
${rolesText(roles, plan).replace(/Image (\d+)/g, (_, n: string) => `Image ${Number(n) + 1}`)}

${garment}`
}

/** Generalist editor used as try-on: Image 1 is the person, the garment comes from the packshots. With a person in frame the DNA stays out. */
export function onModelPrompt(plan: ShootPlan, roles: RefRole[]): string {
  const clothes = carried(plan)
    ? "She keeps the clothes already on in Image 1."
    : "The plain grey set she has on in Image 1 is a base layer only: this styling takes its place, nothing of it stays visible."
  return `Photorealistic e-commerce fashion photo. Image 1 is a fictional adult sample-size model: keep her face, hair, very slender build, fine narrow lower legs and narrow ankles, pose, background and lighting exactly as in Image 1. ${onModelStyling(plan)} ${clothes}
${rolesText(roles, plan).replace(/Image (\d+)/g, (_, n: string) => `Image ${Number(n) + 1}`)}

GARMENT: ${plan.description}, with ${plan.identity}.
Keep ${plan.lock} identical to the packshots; do not redesign the ${plan.noun}.
${scaleLine(plan)}

${shotSpec("on-model", plan)}
Everyday opaque clothing, catalogue photography. Her feet stay exactly as in Image 1. No text, no logo, no watermark.`
}

export const CANON_KINDS: AssetKind[] = ["ghost-front", "ghost-back", "ghost-side", "detail-button", "detail-fabric"]
