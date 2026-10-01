import type { Line } from "../line"
import type { GarmentDna, ShootPlan } from "../types"
import { UGC_FORMATS, creatorsFor } from "./ugc"

const SHOT_GARMENT = { own: "still in her own clothes", holds: "she takes it out and holds it up", wears: "she wears it" } as const

type PlanBody = Omit<ShootPlan, "model" | "at">

/** The hand-tuned plan of the demo coat: the few-shot example of the planner and the plan of the seeded coat. */
export const COAT_PLAN: PlanBody = {
  noun: "coat",
  description:
    "double-breasted knee-length coat in lacquer red double-face wool, peak lapels, six burnished brass stirrup buttons in two rows of three, back half-belt",
  identity: "its peak lapels, its six brass stirrup buttons in two rows of three, its two-button cuff tabs and its knee length",
  lock: "cut, colour, seams, lapel shape, button count, button design and hardware",
  views: {
    front:
      "Coat fully buttoned, the garment holds a natural worn 3D volume with the neckline and inner back collar visible through the invisible mannequin, crisp focus on buttons and stitching.",
    back: "Showing the back seams, centre vent and half-belt with its buttons.",
    side: "Showing the double-breasted overlap depth, lapel roll, sleeve and pocket flap in profile.",
  },
  details: {
    "detail-button": {
      label: "Bottone",
      region: "one front button, the sharpest and least occluded",
      shot: "the stirrup button at the centre, sewn on the coat front, with the surrounding fabric filling the frame. Raking studio light that reveals the brushed brass finish, the thread shank and the wool surface. Shallow depth of field.",
    },
    "detail-fabric": {
      label: "Tessuto",
      region: "the left lapel of the coat, from the collar notch down to where it meets the top row of buttons, with the front panel next to it",
      shot: "the wool surface texture, the lapel edge finish and the topstitching are sharp; raking daylight, the fabric fills the frame.",
    },
  },
  hardware: { label: "the stirrup button", target: "one front button, the sharpest and least occluded" },
  outfit: "a fitted black fine-knit turtleneck, slim black trousers and black leather ankle boots",
  wear: "fully buttoned over her outfit; it keeps its knee length, its volume and the weight of a heavy double-face wool and fits her naturally at the shoulders",
  scale:
    "On a 175 cm model the hem falls just below the knee and the sleeves end at the wrist bone, with the shoulder seam sitting slightly past the natural shoulder. Each stirrup button is about as wide as a thumbnail, the lapel at its widest is about a hand's width, and the two rows of buttons are set about two hand widths apart.",
  ugc: {
    wear: "fully buttoned, over her own outfit",
    over: true,
    show: "the lapels, the two rows of buttons and the pocket flaps",
    touch: "the lapel",
    pieces: ["coat"],
    copy: {
      ootd: {
        hook: "styling: il look completo costruito sul cappotto",
        line: "",
      },
      "street-check": {
        hook: "relatable: l'outfit check che vale più del resto",
        line: "Faccio finta di non sentire il telefono perché sto girando l'outfit check per 31 like e mia madre",
      },
      "get-dressed": {
        hook: "styling: si veste a stacchi davanti allo specchio",
        line: "",
      },
    },
  },
  zones: [
    { label: "Bottone", target: "the top-left button on the front of the coat, tight around that single button" },
    { label: "Revers", target: "the lapels and the collar of the coat" },
    { label: "Polsino", target: "one sleeve cuff with its tab or buttons" },
  ],
  backZones: ["back half-belt with its buttons", "centre back vent"],
}

export const SHOOT_SYSTEM = `You are the art director of a luxury fashion e-commerce studio. For one garment you write the SHOOT PLAN: the garment-specific sentences that are slotted into fixed prompt templates for image and video models (ghost-mannequin packshots, macro details, an on-model photo, phone UGC clips with virtual creators). The templates already cover background, light, framing and format: write only what depends on this garment.

The image and video endpoints run keyword content checkers that ignore negations and context. Every text you write must pass them:
- Describe the garment as a catalogue item: type, colour, fabric name, construction, hardware.
- Never use body-part words (crotch, bust, chest, cleavage, hips, buttocks, thigh, skin), underwear or intimate words (lingerie, thong, gusset, bra, panties, underwear), or exposure words (sheer, see-through, transparent, nude, naked, bare, revealing, skin-tight, second-skin, body-conscious, sexy). Say "lace", "openwork", "fine", "fitted", "close-fitting" instead.
- Leave out construction details that only exist in intimate areas; the reference images carry them.
- A dress, skirt, jumpsuit, trousers or top is a complete outfit. "outfit" is "the feet of the person reference". "wear" and "ugc.wear" describe only how that one garment sits (closure, length, fit) and name no second garment and no footwear: no jacket, blazer, cardigan, bag, jewellery, camisole, tights, stockings, shoes, heels or pumps. The on-model photo keeps the feet of the person reference. A fine or openwork sleeve does not make a dress intimate.
- The opaque-layer rule applies only when the garment itself is a bodysuit, lingerie-style top, slip or swimwear: "outfit", "wear" and "ugc.wear" then layer it over opaque everyday clothing so the person is fully covered, e.g. worn over an opaque black camisole, tucked into high-waisted trousers. "ugc.wear" names those layers itself, because the creator's own clothes are taken off unless "over" is true.
- Unless "over" is true, UGC copies shoes and legwear from the approved on-model photo, which can be edited, and the creator's own shoes stay off.
- People are "the model" or "she", a fictional adult on a commercial job.

Return JSON with exactly this shape:
{
  "noun": string,            // one English noun for the garment, e.g. "coat", "bodysuit", "shirt"
  "description": string,     // one English line, max 30 words, neutral catalogue wording
  "identity": string,        // the 3-5 signature details that must survive every image and clip, starting with "its"
  "lock": string,            // the details to keep identical, a comma list ending with "and …"
  "views": {
    "front": string,         // 1-2 sentences for the FRONT ghost-mannequin packshot: how it is closed, what is in crisp focus
    "back": string,          // what the BACK view shows
    "side": string           // what the three-quarter FRONT-LEFT view shows in profile
  },
  "details": {
    "detail-button": { "label": string, "region": string, "shot": string },   // first macro: the hardware or the most distinctive closure/trim
    "detail-fabric": { "label": string, "region": string, "shot": string }    // second macro: fabric surface with an edge or seam
  },
  "hardware": { "label": string, "target": string } | null,
  "outfit": string,          // besides the garment. A complete piece (dress, skirt, top): "the feet of the person reference". Outerwear: the clothes underneath. Bodysuit, slip, swimwear: the opaque layers
  "wear": string,            // how the PDP model wears it, completes "she wears the <noun> …"
  "scale": string,           // how big the garment is, written as body landmarks and everyday comparisons
  "ugc": {
    "wear": string,          // how a creator wears it, completes "she wears the <noun> …"; name every layer it needs, her own clothes are not worn under it
    "over": boolean,         // true only for outerwear kept on over her own clothes (coat, jacket, cardigan); false when the garment is the outfit and replaces them
    "show": string,          // the visible details she shows off to the camera, a noun phrase
    "touch": string,         // the one detail her hand touches, a noun phrase
    "pieces": string[],      // the garments that are not sewn together; the hold shots put one in each hand
    "copy": { "<format id>": { "hook": string, "line": string } }
  },
  "zones": [ { "label": string, "target": string } ],   // 3 regions for side-by-side zooms
  "backZones": string[]      // 1-2 regions of the back view
}

- details.*.label: short Italian UI label (e.g. "Bottone", "Scollo", "Pizzo"). region: what to locate on the approved front packshot to crop the reference, specific enough for a detector ("the crew neckline binding with the lace next to it"). shot: what the macro shows, sharp elements and light, 1-2 sentences.
- hardware: the one small metal or distinctive fastening worth passing as a close-up reference to every generation (label for the prompt, e.g. "the stirrup button"; target for the detector). null when the garment has no visible hardware or the only hardware sits in an intimate area.
- pieces: every garment that is not sewn to the others, top first, each a short English noun phrase with no article ("ivory crossover halter top", "white wide-leg trousers"). A dress, jumpsuit, coat, shirt or skirt is ONE entry even when it covers the torso and the legs: a jumpsuit is one garment, a top with matching trousers is two. A three-piece lists all three. The hold shots are written from this list, one piece per hand, so a wrong single entry makes her hold a two-piece as one hanging garment.
- scale: 2-3 sentences that pin the size of the garment. Image models ignore centimetres, so write every dimension as a landmark on a 175 cm model (where the hem, the sleeve end, the waist and the shoulder seam fall) and give the signature trims a familiar comparison (a thumbnail, a coin, a hand's width). Follow the measurements in the DNA when it lists them; never name an intimate body part, use "waist", "shoulder", "knee", "wrist", "ankle". When the measurements field source is "measured", copy those centimetre figures into scale unchanged and then translate each one into a landmark. QA reads the centimetres; the image model follows the landmarks. A bag of a stated width is compared to the hand, not to the knee.
- When garment_type is a bag or another accessory that is carried, noun is that object, pieces is one entry, over is false, and wear, ugc.wear and outfit describe how it is carried (in one hand, chain too short for the shoulder). The person keeps the clothes of the person reference. Do not dress them in a second product.
- zones: labels short Italian, targets English and locatable on both a packshot and a worn photo. Avoid intimate areas.
- ugc.copy: one entry per UGC format id listed by the user. hook: the ad hypothesis in Italian, max 8 words. line: the on-screen caption in Italian when the format lists a caption brief, following that brief; otherwise an empty string. No prices, dates, availability, pre-order or production talk.
- Every value must be true to the DNA; never add details the DNA does not list.`

export function shootPrompt(input: { name: string; brief: string; line?: Line }, dna: GarmentDna): string {
  const formats = UGC_FORMATS.map(
    (f) =>
      `- ${f.id} (${f.label}): ${f.angle}; edited reel, shots: ${f.shots.map((s) => `${s.label} (${SHOT_GARMENT[s.garment]})`).join(" → ")}${f.caption?.brief ? `; caption brief: ${f.caption.brief}` : ""}`,
  )
  return `EXAMPLE, the shoot plan of a different garment (a double-breasted coat):
${JSON.stringify(COAT_PLAN, null, 2)}

NOW THE GARMENT TO PLAN.
Product name: ${input.name}
Designer note: "${input.brief}"
GARMENT: ${dna.summary}
GARMENT DNA:
${dna.fields.map((f) => `- ${f.key}: ${f.value}`).join("\n")}

UGC formats:
${formats.join("\n")}
The creators' own outfits, kept on only if "over" is true, otherwise replaced by the garment. Shoes and legwear then come from the approved on-model photo, not from the creator: ${creatorsFor(input.line === "uomo" ? "uomo" : "donna").map((c) => c.outfit).join(" | ")}
${input.line === "uomo" ? "\nThis is MENSWEAR worn by an adult man. In wear, ugc.wear and every sentence about the person, write \"he\" and \"his\", never \"she\". Scale landmarks are on a 186 cm man.\n" : ""}
Write the SHOOT PLAN.`
}
