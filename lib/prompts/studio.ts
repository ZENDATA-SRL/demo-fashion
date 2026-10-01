import type { ShootPlan } from "../types"
import { carried, hold, onModelStyling, rolesText, scaleLine, wornAlone, type RefRole } from "./canon"

/**
 * Studio editorial looks, written after the GenAngels studio15 prompts: subject, outfit, pose, set, light and mood in
 * that order, one short paragraph each, then a JSON block that restates the look as art direction.
 * Wording follows the moderation rules of ugc.ts: no body-part or exposure words, the person is a fictional adult on a
 * commercial job, the garment is the hero piece.
 */

export type StudioLook = {
  id: string
  label: string
  /** Italian, one line for the UI */
  note: string
  /** "back" passes the approved back packshot and turns the garment's back to the camera */
  view: "front" | "back"
  beauty: string
  gaze: string
  pose: string
  set: string
  light: string
  mood: string
  art: {
    style: string
    capture: string
    pose: string
    location: string
    lighting: string
    palette: string
    camera: string
    lens: string
  }
}

export const STUDIO_LOOKS: StudioLook[] = [
  {
    id: "grigio-scolpito",
    label: "Grigio scolpito",
    note: "Fondale grigio senza giunte, luce morbida dall'alto a sinistra, figura intera.",
    view: "front",
    beauty: "a dewy satin complexion, softly defined brows, subtly smoked bronze eyelids and satin rose-brown lips",
    gaze: "a calm, composed expression with her gaze held steadily toward the lens",
    pose: "She stands in an upright, balanced stance with her weight settled on one leg, one hand resting lightly at her waist while the other arm hangs relaxed along her side.",
    set: "The setting is a seamless editorial studio wrapped in uniform neutral grey tones. A smooth curved horizon blends floor and wall into an uncluttered tonal expanse.",
    light:
      "A soft directional key light falls from the upper left, sculpting her face and shoulders with subtle gradations into gentle shadow. Restrained fill keeps rich contrast while a faint rim light traces the outer edge of the silhouette.",
    mood: "The photograph delivers a refined, quietly cinematic presence defined by graphic simplicity and modern elegance.",
    art: {
      style: "Contemporary minimalist studio portraiture blending classical poise with sleek modern styling.",
      capture: "Eye-level full-length studio portrait, centred with balanced formal symmetry, head to shoes in frame.",
      pose: "Grounded upright stance with a gentle weight shift and one hand poised at the waist.",
      location: "Seamless neutral grey studio stripped of extraneous ornamentation.",
      lighting: "Soft wrapping key from the upper left, restrained fill and a faint rim separating the silhouette.",
      palette: "Cool ash grey and soft charcoal shadow around the garment's own colour.",
      camera: "Professional medium-format capture rendering natural texture clarity and rich tonal gradients.",
      lens: "Portrait telephoto compression creating subtle subject separation and gradual background rolloff.",
    },
  },
  {
    id: "bianco-vento",
    label: "Bianco e vento",
    note: "Ciclorama bianco caldo, una brezza muove i capelli, busto ruotato verso l'obiettivo.",
    view: "front",
    beauty: "a luminous fresh complexion, natural brushed-up brows and glossy nude-rose lips",
    gaze: "lips softly parted and an unhurried direct gaze into the lens",
    pose: "Standing in profile, she twists her shoulders back toward the camera, one hand raised to the crown of her head while the other rests at her waist.",
    set: "The setting is a seamless high-key studio with an unbroken warm off-white cyclorama. An unseen breeze sweeps across the set from the left, lifting her hair into loose horizontal strands.",
    light:
      "A large soft key light from the upper left illuminates her face and shoulders with smooth gradation. The wind-tousled strands catch bright rim highlights that separate her from the pale backdrop, and a soft shadow falls to the right.",
    mood: "The image carries an airy, kinetic editorial energy balanced by clean high-key minimalism.",
    art: {
      style: "Kinetic high-key fashion editorial where movement in the hair contrasts with the still, sculpted garment.",
      capture: "Eye-level three-quarter-length portrait from head to knees, the torso turned back toward the camera.",
      pose: "Profile stance with a twist through the shoulders, one hand lifted into the hair.",
      location: "Warm off-white seamless cyclorama with a steady breeze from the left.",
      lighting: "Large soft key from the upper left with bright rim highlights on the moving hair.",
      palette: "Warm ivory and cream tones that let the garment's own colour lead.",
      camera: "Full-frame capture with crisp detail, fast shutter freezing each strand of hair.",
      lens: "Standard portrait lens with natural perspective and a softly falling-off background.",
    },
  },
  {
    id: "flash-diretto",
    label: "Flash diretto",
    note: "Studio bianco, flash frontale duro, ombra netta sul muro.",
    view: "front",
    beauty: "a fresh satin complexion, softly groomed brows and satin berry lips",
    gaze: "a confident, self-possessed expression looking straight into the lens",
    pose: "She stands in a wide, confident stance with one foot crossed in front of the other, both hands resting at her waist with elbows angled gently outward.",
    set: "The setting is a minimalist white studio with a seamless wall and a smooth pale concrete floor. A crisp, hard-edged shadow of her figure falls across the pristine white backdrop to the right.",
    light:
      "A hard frontal key light from the upper left gives a crisp direct-flash character. Light transitions from bright to shadow with clear directionality, rendering fabric texture and hardware with high-impact specular clarity.",
    mood: "The photograph has the punchy, graphic confidence of a contemporary fashion campaign.",
    art: {
      style: "Graphic direct-flash campaign aesthetic with bold shadow shapes and saturated colour.",
      capture: "Eye-level full-length portrait with generous white space and her cast shadow as a second figure.",
      pose: "Wide grounded stance, one foot crossed in front, hands at the waist with elbows out.",
      location: "Minimal white studio with a seamless wall and pale concrete floor.",
      lighting: "Hard frontal flash from the upper left with a crisp, hard-edged cast shadow.",
      palette: "Stark white and pale concrete grey that make the garment's colour punch.",
      camera: "Professional flash capture with pin-sharp detail and high micro-contrast.",
      lens: "Standard focal length with flat, graphic perspective and deep focus.",
    },
  },
  {
    id: "spot-poltrona",
    label: "Spot e poltrona",
    note: "Cerchio di luce sul fondale grigio, poltrona in pelle blu e cromo, seduta.",
    view: "front",
    beauty: "a velvety matte complexion, defined warm brown brows, soft bronze smoky eyelids and satin brick-red lips",
    gaze: "chin slightly raised and a steady, magnetic gaze toward the camera",
    pose: "Perched side-saddle on the arm of a low leather armchair, she rests one hand flat on its chrome frame and keeps her spine long and composed.",
    set: "The graphic studio features a pale grey seamless backdrop holding a large soft-edged circular pool of light behind her. A dark polished floor extends beneath a deep-navy leather cantilever armchair with tubular chrome framing.",
    light:
      "An elevated frontal spotlight acts as the key, carving a crisp pool of light while light transitions from bright to shadow with clear directionality. Polished highlights catch the chrome frame and the garment's hardware.",
    mood: "The mood is theatrical and self-assured, a sculptural editorial built on circles of light and deep shadow.",
    art: {
      style: "Theatrical studio editorial combining mid-century design furniture with graphic spotlighting.",
      capture: "Slightly low eye-level full-length portrait, the seated figure centred inside the circle of light.",
      pose: "Side-saddle perch on the armchair arm with one hand planted on the chrome frame.",
      location: "Pale grey seamless studio with a projected circular light disk and a dark polished floor.",
      lighting: "Elevated frontal spotlight with crisp pools of light and deep surrounding shadow.",
      palette: "Pale grey, deep navy leather and polished chrome around the garment's own colour.",
      camera: "Medium-format capture with deep tonal gradations and rich shadow detail.",
      lens: "Portrait telephoto compression with smooth rolloff into the dark floor.",
    },
  },
  {
    id: "passo-high-key",
    label: "Passo high-key",
    note: "Bianco puro, luce frontale morbida, colta a metà passo come in passerella.",
    view: "front",
    beauty: "a clean luminous complexion, naturally groomed brows and soft rosy-nude lips",
    gaze: "a relaxed, focused expression looking just past the lens",
    pose: "She steps forward in a fluid mid-stride, her weight shifting onto the planted leg and her arms swinging naturally, the garment moving with the step.",
    set: "The setting is an abstract high-key studio defined by an unbroken seamless white backdrop without props. The white environment wraps cleanly around her, with only a soft contact shadow beneath her feet.",
    light:
      "Large soft frontal key lighting slightly above eye level bathes her in luminous, low-contrast illumination with translucent shadows. Gentle fill keeps the whole garment readable from neckline to hem.",
    mood: "The image reads as a clean, luminous runway moment frozen in the studio.",
    art: {
      style: "Luminous high-key catalogue editorial with runway energy.",
      capture: "Eye-level full-length shot, head to shoes in frame, caught mid-stride toward the camera.",
      pose: "Fluid forward stride with natural arm swing and the garment in motion.",
      location: "Pure white seamless studio with no props.",
      lighting: "Large soft frontal key with translucent, low-contrast shadows.",
      palette: "Bright white and soft grey shadow with the garment as the only colour.",
      camera: "Full-frame capture with a fast shutter, crisp edges and clean tonal roll-off.",
      lens: "Standard neutral lens preserving true proportions of garment and figure.",
    },
  },
  {
    id: "retro-spalla",
    label: "Retro, sguardo in spalla",
    note: "Di spalle sul ciclorama caldo, mostra il retro del capo e guarda indietro.",
    view: "back",
    beauty: "a dewy satin complexion, softly defined brows and glossy mauve lips",
    gaze: "her face in three-quarter profile, glancing back at the lens with a poised, unhurried look",
    pose: "She stands facing away from the camera, rotating her shoulders slightly and glancing back over one shoulder toward the lens, one hand resting lightly at her waist.",
    set: "The setting is an empty high-key photography studio defined by a seamless warm off-white cyclorama wall. The background stays clean and uncluttered, giving total focus to the back of the garment.",
    light:
      "A large soft key light from the upper left washes across her shoulders and the back of the garment with gradual shadow rolloff. A soft cast shadow extends across the wall to the right.",
    mood: "The photograph captures a poised over-the-shoulder moment with quiet sophistication.",
    art: {
      style: "Refined back-view studio editorial that treats the garment's construction as the subject.",
      capture: "Eye-level full-length back view, head to shoes in frame, face turned back over the shoulder.",
      pose: "Standing with her back to the camera, a slight rotation through the shoulders and a glance back.",
      location: "Warm off-white seamless cyclorama, clean and uncluttered.",
      lighting: "Large soft key from the upper left with gradual rolloff and a soft cast shadow on the wall.",
      palette: "Warm ivory and soft taupe shadow around the garment's own colour.",
      camera: "Medium-format capture with precise seam and texture definition.",
      lens: "Portrait telephoto compression with a gently diffused backdrop.",
    },
  },
]

export function studioLook(id: string): StudioLook {
  const look = STUDIO_LOOKS.find((l) => l.id === id)
  if (!look) throw new Error(`look studio sconosciuto: ${id} (disponibili: ${STUDIO_LOOKS.map((l) => l.id).join(", ")})`)
  return look
}

/** Garment-specific subset; the full catalogue when the shoot plan does not restrict looks. */
export function looksForStudio(shoot: ShootPlan | null | undefined): StudioLook[] {
  const ids = shoot?.studioLooks?.filter(Boolean)
  if (ids?.length) return ids.map((id) => studioLook(id))
  return STUDIO_LOOKS
}

function artDirection(look: StudioLook, plan: ShootPlan): string {
  const json = {
    meta: {
      quality: "Masterwork studio fashion editorial with immaculate optical fidelity, true fabric texture and lifelike natural rendering.",
      style: look.art.style,
      aspect_ratio: "Vertical 3:4 editorial composition with generous breathing room around the figure.",
    },
    subject_aura: {
      capture_type: look.art.capture,
      outfit_vibe: `The ${plan.noun} as the hero piece: ${plan.description}.`,
      pose_flow: look.art.pose,
    },
    scene_aesthetics: {
      location_feel: look.art.location,
      lighting_mood: look.art.lighting,
      color_palette: look.art.palette,
    },
    technical_illusion: {
      camera_style: look.art.camera,
      lens_feel: look.art.lens,
    },
  }
  return "```json\n" + JSON.stringify(json, null, 2) + "\n```"
}

/**
 * Image 1 is the model, then her back view for a back look, then the packshots: the look sets pose, set and light,
 * the references set face, figure and garment.
 */
export function studioPrompt(plan: ShootPlan, roles: RefRole[], look: StudioLook, model: { worn: boolean; back: boolean }): string {
  const back = look.view === "back" ? ` Back view of the ${plan.noun}, ${plan.views.back.charAt(0).toLowerCase()}${plan.views.back.slice(1)}` : ""
  const identity = model.worn
    ? `Image 1 is the approved on-model photograph of the same fictional adult model on a commercial job: preserve her face, her hair and the exact styling she wears there, accessories and legwear included. Take only identity and styling from it; pose, set and light come from this brief, not from Image 1.`
    : `Image 1 is the base body reference for a fictional adult sample-size model on a commercial job: preserve her face, her hair and her very slender build, including fine narrow lower legs. The plain grey set she wears there is a base layer only: it is replaced by the styling described below.`
  const figure = model.back
    ? `\nImage 2 is the same model photographed from behind: the truth for her hair and her figure seen from the back.`
    : ""
  const people = model.back ? 2 : 1
  const bagSize = carried(plan)
    ? ` The ${plan.noun} in her hand must match the exact east-west size in Image 1 and the packshots: about 28 cm wide and 22 cm tall body (wider than tall), 10 cm gusset, never a tall oversized shopper.`
    : ""
  const styling = carried(plan)
    ? `She keeps the clothes already on her. ${hold(plan, plan.wear, ` The chain stays in that hand and does not go over her shoulder or across her torso. The ${plan.noun} is about one hand wide.`)}${bagSize}`
    : model.worn
    ? wornAlone(plan)
      ? `She wears only the ${plan.noun} shown in the other images. The ${plan.noun} is the only garment. Her feet stay exactly as in Image 1.`
      : `She wears the ${plan.noun} shown in the other images, ${plan.wear}. Shoes and legwear stay exactly as in Image 1: the same shoes, and tights or stockings only when Image 1 already shows them.`
    : onModelStyling(plan)
  return `Create a photorealistic high-end studio fashion editorial photograph for the lookbook of a luxury house.
${identity}${figure}
${rolesText(roles, plan).replace(/Image (\d+)/g, (_, n: string) => `Image ${Number(n) + people}`)}

The model has ${look.beauty}, with ${look.gaze}.

${styling} The ${plan.noun} is identical to the packshots: ${plan.description}, with ${plan.identity}. Keep ${plan.lock} identical; do not redesign the ${plan.noun}.${back}
${scaleLine(plan)}

${look.pose}

${look.set}

${look.light}

${look.mood}

${artDirection(look, plan)}

Style: opaque fashion styling, original invented adult face, the ${plan.noun} as the only fashion item in focus, no text, no logo, no watermark.`
}
