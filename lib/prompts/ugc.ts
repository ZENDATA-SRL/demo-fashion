import { voice, type Line } from "../line"
import type { ShootPlan } from "../types"
import { carried, hold, rolesText, scaleLine, wornAlone, type RefRole } from "./canon"

/**
 * Wording follows the moderation rules learnt in ai-influencer: the image endpoints run keyword classifiers that ignore
 * negations, so people are described as a commercial job with a fictional adult, clothes as garments, restrictions positively.
 */

export type Creator = {
  id: string
  /** first name shown in the UI */
  name: string
  age: number
  /** English, no body words: age, origin, face, hair, build as clothing size */
  look: string
  /** her own clothes, kept identical across her clips */
  outfit: string
  /** the part of her outfit that stays on when the garment replaces the rest */
  shoes: string
  city: string
  /** her own room, lived-in and specific, where the indoor shots are filmed */
  home: string
  /** the mirror she checks herself in on the way out of her building */
  exit: string
}

/**
 * Three virtual creators in the age range of fashion TikTok and Reels, the same sample-size range as the on-model cast,
 * different look and city, all invented (no real faces, disclosed as virtual). New ids when a creator changes, so her
 * old portrait and clips are not reused.
 */
export const CREATORS: Creator[] = [
  {
    id: "giulia",
    name: "Giulia",
    age: 23,
    look: "early 20s, long straight light brown hair with curtain bangs, hazel eyes, a few freckles, slim build, small gold hoop earrings",
    outfit: "oversized grey cropped hoodie, black wide-leg joggers, chunky white sneakers",
    shoes: "chunky white sneakers",
    city: "Milano",
    home: "small bedroom in a shared Milan flat: warm fairy lights along the wall, polaroids taped above the bed, a clothes rail crammed with outfits, a folded ring light in the corner, a few clothes on the chair",
    exit: "the narrow old lift of her Milan building: a mirror wall, brass buttons, folding inner doors, a warm ceiling light",
  },
  {
    id: "chiara-2",
    name: "Chiara",
    age: 24,
    look: "mid 20s Southern Italian woman, long dark brown wavy hair worn down past the shoulders, brown eyes, softly groomed brows, high cheekbones, a striking photogenic fashion-model face, very slender sample-size fashion model, narrow frame, fine narrow lower legs and narrow ankles, wears Italian size 36 clothes, about 176 cm",
    outfit: "white fitted baby tee, light-wash straight jeans, brown suede ballet flats",
    shoes: "brown suede ballet flats",
    city: "Roma",
    home: "living room of a Roman flat: beige linen sofa, a tall monstera, a round wall mirror, warm afternoon sun in stripes through half-closed wooden shutters, a tote bag and keys on the side table",
    exit: "the entrance hall of her old Roman palazzo: a tall mirror next to the letterboxes, a marble floor, the big wooden front door ajar with daylight coming in",
  },
  {
    id: "amina-2",
    name: "Amina",
    age: 24,
    look: "mid 20s Black Italian woman, long knotless braids worn down past the shoulders, warm brown eyes, high cheekbones, a striking photogenic fashion-model face, very slender sample-size fashion model, narrow frame, fine narrow lower legs and narrow ankles, tall, wears Italian size 36 clothes, about 180 cm, small silver nose ring",
    outfit: "black fitted ribbed tank top, straight dark jeans, black leather loafers",
    shoes: "black leather loafers",
    city: "Torino",
    home: "loft in Torino: exposed brick wall, big arched window, vinyl records and a turntable on a low shelf, a pothos plant trailing from a bookcase, soft daylight",
    exit: "the small modern lift of her Torino building: brushed steel walls, a full mirror at the back, cool overhead light, the floor display glowing",
  },
]

export const CREATORS_MEN: Creator[] = [
  {
    id: "marco",
    name: "Marco",
    age: 26,
    look: "mid 20s Italian man, short dark brown hair, light stubble, brown eyes, lean build, wears Italian size 48 clothes, about 184 cm",
    outfit: "charcoal overshirt, straight dark trousers, white leather sneakers",
    shoes: "white leather sneakers",
    city: "Milano",
    home: "small bedroom in a shared Milan flat: warm lamp on the desk, a clothes rail with shirts and jackets, a folded ring light in the corner, sneakers by the door",
    exit: "the narrow old lift of his Milan building: a mirror wall, brass buttons, folding inner doors, a warm ceiling light",
  },
  {
    id: "leo",
    name: "Leo",
    age: 25,
    look: "mid 20s Southern Italian man, short black hair, dark brown eyes, clean-shaven, lean build, wears Italian size 48 clothes, about 182 cm",
    outfit: "white oxford shirt with the sleeves rolled, light-wash straight jeans, brown suede loafers",
    shoes: "brown suede loafers",
    city: "Roma",
    home: "living room of a Roman flat: beige linen sofa, a tall monstera, a round wall mirror, warm afternoon sun in stripes through half-closed wooden shutters, keys on the side table",
    exit: "the entrance hall of his old Roman palazzo: a tall mirror next to the letterboxes, a marble floor, the big wooden front door ajar with daylight coming in",
  },
  {
    id: "davide",
    name: "Davide",
    age: 27,
    look: "late 20s Black Italian man, very short cropped hair, warm brown eyes, short beard, lean build, tall, wears Italian size 50 clothes, about 188 cm",
    outfit: "black merino knit, straight dark jeans, black leather loafers",
    shoes: "black leather loafers",
    city: "Torino",
    home: "loft in Torino: exposed brick wall, big arched window, vinyl records and a turntable on a low shelf, a pothos plant trailing from a bookcase, soft daylight",
    exit: "the small modern lift of his Torino building: brushed steel walls, a full mirror at the back, cool overhead light, the floor display glowing",
  },
]

export const allCreators = () => [...CREATORS, ...CREATORS_MEN]

export function creatorsFor(line: Line): Creator[] {
  return line === "uomo" ? CREATORS_MEN : CREATORS
}

export function creator(id: string): Creator {
  const found = allCreators().find((c) => c.id === id)
  if (!found) throw new Error(`creator sconosciuto: ${id} (disponibili: ${allCreators().map((c) => c.id).join(", ")})`)
  return found
}

export function creatorPrompt(c: Creator): string {
  const man = c.look.includes(" man,")
  const figure = man ? "His build is lean, the proportions of a menswear lookbook." : "Her figure is very slender, with fine narrow lower legs and narrow ankles, the proportions of a fashion lookbook."
  const text = `Create a photorealistic vertical smartphone photo for a paid-social creator reference.
Fictional adult woman on a commercial job: ${c.look}. Original invented face, striking and photogenic, natural skin texture with visible pores, no beauty filter.
${figure}
Outfit: ${c.outfit}, fully covering opaque fabric.
Setting: ${c.home}.
Action: standing, full figure from head to shoes, weight on one leg, facing the camera, a small confident smile, one hand in her pocket.
Deliverable: authentic phone photo taken by a friend for her Instagram, slightly soft, casual and candid, ordinary phone colours.
Style: everyday clothing, original invented adult face, clean frame.`
  return voice(text, man ? "uomo" : "donna")
}

/**
 * One clip of an edited reel, generated about two seconds longer than it stays in the edit (and at least the 5 seconds
 * of H3), so her last word lands inside the clip: `cut` is the planned length, stretched in the montage until her last
 * word plus `tail`.
 *
 * H3 reads a dialogue block next to a timeline of mimed actions (smiles, poses, faces) as a voice-over and keeps her
 * mouth shut. So a shot says how she is heard, and the line goes inside the timeline at `{say}`, where she speaks.
 */
export type UgcShot = {
  id: string
  /** Italian, shown in the UI */
  label: string
  note: string
  /** "own": still in her own clothes, garment not in frame; "holds": she takes it out and holds it; "wears": she has it on */
  garment: "own" | "holds" | "wears"
  /**
   * A view the first frame does not show, but the clip does. The clip also receives the approved packshots
   * (front, side, back) as reference images, named in the prompt as Image 1, Image 2, Image 3.
   */
  shows?: "back"
  /** replaces her usual outfit on an "own" or "holds" shot; the product stays out of the frame on an "own" shot */
  clothes?: string
  /** "on": she speaks on camera, lips in sync; "over": her voice from behind the phone, her face never in frame; "none": silent */
  voice: "on" | "over" | "none"
  camera: string
  /** setting + action of the first frame; {city} {home} {exit} come from the creator, {garment} {show} {touch} from the plan */
  frame: string
  /** what she does, from the approved first frame; `{say}` is where her line goes */
  motion: string
  seconds: number
  cut: number
  /** seconds of action kept after her last word (the hand over the lens, a step toward the door) */
  tail: number
  /** true: the first frame is also the last, which pins the garment; only for shots that end where they started */
  loop: boolean
  sound: string
}

/** One jump cut of a beat-cut edit: seconds `from`-`to` of the approved clip of `shot`. */
export type UgcCut = { shot: string; from: number; to: number }

export type UgcCaption = {
  /** the same text on every garment */
  text?: string
  /** Italian brief for a caption written per garment; the text lands in the shoot plan as `ugc.copy[format].line`, editable in the DNA step */
  brief?: string
  /** "title": big yellow serif in the middle; "caption": white sans in the upper third, like a TikTok text box */
  style: "title" | "caption"
  from: number
  to: number
}

export type UgcFormat = {
  id: string
  label: string
  /** Italian, the idea of the reel as the UI explains it */
  note: string
  /** the kind of ad hypothesis this reel tests; the garment's own hook comes from its shoot plan */
  angle: string
  shots: UgcShot[]
  /** beat-cut edit in order, several cuts per clip; without it every shot is kept once for its `cut`, stretched to her last word */
  edit?: UgcCut[]
  /** one track under the whole reel; the edit is cut on multiples of its beat */
  music?: { prompt: string; bpm: number }
  caption?: UgcCaption
}

const MIRROR = "Handheld phone mirror selfie video, the phone in a clear case at chest height, her face fully visible above the phone"
const PROPPED = "Front-camera video, the phone propped up in front of her"
const TALKS = "lips moving clearly with every word"

export const MUSIC_AVOID = "vocals, singing, speech, voice, slow tempo, long intro, fade in, low quality"

/** Extra beds any mute template can use instead of its own. The template track stays the default. */
export type UgcTrack = { id: string; label: string; note: string; prompt: string; bpm: number }

export const UGC_TRACKS: UgcTrack[] = [
  {
    id: "drive",
    label: "Più attiva",
    note: "Un filo più veloce, kick più secco e un gancio che entra subito.",
    prompt:
      "Driving high-energy fashion pop instrumental at 128 BPM, full power on the very first beat, hard four-on-the-floor kick, cracking claps and a tight snare, pulsing synth bass, bright staccato chords and a catchy hook that lifts every four bars, urgent and exciting, loud modern mix, viral fashion reel",
    bpm: 128,
  },
]

export function ugcTrack(id: string): UgcTrack {
  const track = UGC_TRACKS.find((t) => t.id === id)
  if (!track) throw new Error(`musica UGC sconosciuta: ${id}`)
  return track
}

/** video1 (Downloads): an OOTD reel shot on a phone on a tripod in a bright living room, the look put together piece by piece. */
const TRIPOD = "Rear phone camera on a small tripod at hip height, about three metres from her, framing her full figure from head to shoes with floor and wall around her; the phone stays fixed for the whole take"
const LIVING =
  "a bright, airy living room of an elegant old apartment in {city}: white panelled walls with classic mouldings, a herringbone wooden floor, a light grey sofa and a tall potted plant behind her, soft even daylight from a large window out of frame"
const SUNGLASSES = "dark oval sunglasses"
const BAG = "a small black quilted shoulder bag with a chain strap"

/** video2 (Downloads): a street outfit check filmed by a friend, cut on every other beat between a wide and a close take. */
const FRIEND = "Rear phone camera held by a friend standing on the sidewalk a few metres away at chest height, handheld, following her movements"
const STREET =
  "a sunny sidewalk in the historic centre of {city}: a white stone facade with dark wooden windows and flower boxes full of trailing green plants, a grey stone base with wrought-iron window grilles, warm late-morning sun, stone paving"
const STREET_KIT = "dark oval sunglasses and a small bright-coloured leather bucket bag on her shoulder"

function streetKit(plan: ShootPlan): string {
  return carried(plan) ? `${SUNGLASSES} only, no purse and no second bag on her shoulder` : STREET_KIT
}

function streetHeroWide(plan: ShootPlan, c?: Creator): string {
  if (!carried(plan)) {
    return `wearing the ${plan.noun}, ${streetKit(plan)}, the whole ${plan.noun} visible from neckline to hem`
  }
  const outfit = c?.outfit ?? "casual street clothes"
  return `in her own ${outfit}, ${hold(plan, plan.ugc.wear, ` The ${plan.noun} hangs from its handles at her side, not on her shoulder.`)} Exactly one bag in frame: the product ${plan.noun} only. Her outfit is visible from neckline to hem`
}

function streetHeroNear(plan: ShootPlan): string {
  if (!carried(plan)) {
    return `${STREET_KIT}, one hand reaching into the open bag, looking down at it with an amused smile, the ${plan.noun} clearly visible from neckline to hem`
  }
  return `${streetKit(plan)}, one hand on {touch} of the ${plan.noun} she holds in her other hand, looking at the camera with an amused smile, her street outfit and the single product bag clearly visible`
}

function ootdAccessories(plan: ShootPlan): string {
  if (carried(plan)) return `${SUNGLASSES}, the ${plan.noun} held in one hand at her side by its handles, no other bag`
  return `${SUNGLASSES}, ${BAG} on her shoulder`
}

function oneBagRule(plan: ShootPlan): string {
  return carried(plan)
    ? `\nBAG COUNT (mandatory): Exactly one bag in the entire frame — the product ${plan.noun}. No prop handbag, no bucket bag on the shoulder, no duplicate ${plan.noun}.\n`
    : ""
}

/**
 * video3 (Downloads/Download.mp4, 9.1s): a get-dressed reel. The phone stays fixed in a white moulded living room;
 * she is jump-cut from pose to pose, and the same ornate mirror opens and closes it. Each shot is one continuous
 * gesture the edit slices, because a first frame cannot change what she is already wearing.
 */
const STAND =
  "Rear phone camera on a small tripod at about waist height, about two metres from her, framing her full figure from head to shoes with the chandelier in the top of the frame; the phone stays fixed for the whole take"
const SALON =
  "a bright living room of an elegant apartment in {city}: white walls with ornate raised plaster mouldings, a herringbone oak floor, a modern gold-toned ring chandelier with hanging crystals, a black track light on the ceiling, a television set into a white wall niche, a beige bouclé pouf at one side and a white bench with a cream throw at the other, hard stripes of sun across the floor"
const GLASS = "Rear phone camera pointed at a large mirror, framing her full figure from head to shoes; the phone stays fixed for the whole take"
const CHAIN_BAG = "a small black quilted shoulder bag with a chain strap"
const NARROW_SHADES = "narrow black sunglasses"
/** The under-layer of this reel, before the product is in frame. Image 1 still shows her usual outfit, so the prompt has to replace it. */
const BASE_CLOTHES = "an oversized long t-shirt with the hem at mini length, and no shoes. She does not wear the clothes from Image 1"

export const UGC_FORMATS: UgcFormat[] = [
  {
    id: "ootd",
    label: "Outfit of the day",
    note: "Telefono sul cavalletto in un salotto luminoso: il look finito come gancio, poi lo presenta, lo indossa, gli accessori e la passerella fino alla mano sull'obiettivo. Muto, a tempo di musica.",
    angle: "outfit-of-the-day hook: the finished look first, then how it is put together piece by piece, cut on the beat",
    shots: [
      {
        id: "look",
        label: "Il look",
        note: "Gancio: il look finito, occhiali da sole e borsa, in posa.",
        garment: "wears",
        voice: "none",
        camera: TRIPOD,
        frame: `Setting: ${LIVING}.\nAction: {ootdLookOpening}, {ootdAccessories}, one hand lifting her hair at the side of her head and the other on her hip, chin up, a confident model pose, the product clearly visible.`,
        motion: "[0-0.7s] She drops the hand from her hair so the hair falls, shifts her weight onto the other leg and gives a small smile, at a normal speed.\n[0.7-1.5s] She turns a quarter to her side in one step, the {garment} moving with her.\n[1.5-end] She stays at that angle, breathing, with a small shift of weight.",
        seconds: 5,
        cut: 2,
        tail: 0,
        loop: false,
        sound: "Quiet room tone, soft footsteps on the wooden floor",
      },
      {
        id: "hanger",
        label: "Lo presenta",
        note: "Ancora coi suoi vestiti, tiene il capo sulla gruccia davanti a sé e lo fa ondeggiare.",
        garment: "holds",
        voice: "none",
        camera: TRIPOD,
        frame: `Setting: the room of the background-plate image, the phone on the same tripod in the same spot.\nAction: she stands in the middle of the room in her own everyday outfit, hair down, no sunglasses, {hanger}, looking into the lens with a playful smile.`,
        motion: "[0-1.2s] {hangerSway}, looking into the lens.\n[1.2-2.2s] She keeps what she is holding out toward the camera so that {show} can be seen, then lowers it to her side.\n[2.2-end] She walks out of the frame to the left at a normal walking pace.",
        seconds: 5,
        cut: 3.5,
        tail: 0,
        loop: false,
        sound: "Quiet room tone, a rustle of fabric",
      },
      {
        id: "on",
        label: "Addosso",
        note: "Stacco: ce l'ha addosso, lo sistema, un giro sul posto a velocità normale per il retro.",
        garment: "wears",
        shows: "back",
        voice: "none",
        camera: TRIPOD,
        frame: "Setting: the room of the background-plate image, the phone on the same tripod in the same spot.\nAction: she stands in the middle of the room wearing the {garment}, hair down, no sunglasses, both hands at {touch} adjusting it with a satisfied look, full figure from head to shoes, the whole {garment} visible.",
        motion: "[0-1.4s] She smooths and adjusts {touch} with quick hands, then looks up at the camera and smiles.\n[1.4-2.2s] She drops her hands and shifts her weight.\n[2.6-3.8s] She turns once on the spot at a normal speed, a full turn in about a second, showing the back of the {garment}, and lands facing the camera.\n[3.8-end] She puts her hands on her hips, pleased, and shifts her weight once.",
        seconds: 7,
        cut: 6.5,
        tail: 0,
        loop: false,
        sound: "Quiet room tone, a swish of fabric as she turns",
      },
      {
        id: "close",
        label: "Da vicino",
        note: "Si avvicina al telefono: orecchino, sguardo in camera, lo scollo del capo in primo piano.",
        garment: "wears",
        voice: "none",
        camera: "The same phone on its tripod, she has stepped a little closer: her face large in the frame, the phone stays at eye level",
        frame: "Setting: the room of the background-plate image, she has stepped closer to the phone so that room sits soft behind her.\nAction: her face is large in the frame and the top of the {garment} is visible below it, one hand raised beside her face fastening a small gold earring, looking into the lens with a relaxed, confident expression.",
        motion: "[0-1.2s] She fastens the earring, tilts her head and looks into the lens.\n[1.2-2.2s] She runs her fingers through her hair in one pass.\n[2.2-end] She steps back from the phone at a normal pace.",
        seconds: 5,
        cut: 2.5,
        tail: 0,
        loop: false,
        sound: "Quiet room tone",
      },
      {
        id: "style",
        label: "Accessori e passerella",
        note: "Occhiali, borsa, colpo di capelli, profilo; cammina verso il telefono e copre l'obiettivo.",
        garment: "wears",
        voice: "none",
        camera: TRIPOD,
        frame: `Setting: the room of the background-plate image, the phone on the same tripod in the same spot.\nAction: she stands in the middle of the room wearing the {garment}, full figure from head to shoes, putting on ${SUNGLASSES} with both hands, {ootdAccessories}, the whole {garment} visible.`,
        motion: "[0-1.2s] She slides the sunglasses on and slings the bag onto her shoulder.\n[1.2-2.4s] She flips her hair back and puts one hand on her hip.\n[2.4-3.6s] She turns to her side in one step to show the {garment} in profile, then turns her face back to the camera.\n[3.6-4.6s] She faces forward again.\n[4.6-6.6s] She walks straight toward the camera at a normal walking pace, a step about every half second, the {garment} moving as she walks.\n[6.6-end] Close to the phone, she raises her palm and covers the lens; the frame goes dark.",
        seconds: 8,
        cut: 8,
        tail: 0,
        loop: false,
        sound: "Quiet room tone, her footsteps on the wooden floor",
      },
    ],
    edit: [
      { shot: "look", from: 0.2, to: 1.7 },
      { shot: "hanger", from: 0.3, to: 3.3 },
      { shot: "on", from: 0.2, to: 2.2 },
      { shot: "on", from: 2.5, to: 4.5 },
      { shot: "close", from: 0.3, to: 2.3 },
      { shot: "style", from: 0.2, to: 2.2 },
      { shot: "style", from: 2.5, to: 4.5 },
      { shot: "style", from: 4.9, to: 7.9 },
    ],
    music: {
      prompt:
        "Upbeat feel-good pop dance instrumental at 120 BPM, starts on the first beat with the full groove, four-on-the-floor kick, crisp claps on two and four, funky bassline, bright synth chords and a catchy plucked hook, confident and stylish, clean modern mix, fashion Instagram reel background music",
      bpm: 120,
    },
    caption: { text: "OUTFIT\nOF THE DAY", style: "title", from: 0, to: 1.5 },
  },
  {
    id: "street-check",
    label: "Outfit check in strada",
    note: "Un'amica la filma sul marciapiede: girata, sguardo da sopra la spalla, capelli, lucidalabbra, saluto. Stacchi a ogni battuta tra figura intera e primo piano.",
    angle: "relatable street outfit check: fast beat cuts between poses, a self-ironic caption keeps them watching",
    shots: [
      {
        id: "wide",
        label: "Figura intera",
        note: "Da un paio di metri, sempre sullo stesso punto: sorride, gira su se stessa, si guarda da sopra la spalla, profilo, saluta.",
        garment: "wears",
        shows: "back",
        voice: "none",
        camera: `${FRIEND}, about two and a half metres away, framing her full figure`,
        frame: `Setting: ${STREET}.\nAction: full figure from head to shoes, she stands on the sidewalk facing the camera, {streetHeroWide}, weight on one leg, a big natural smile.`,
        motion: "She stays on the same spot of the sidewalk the whole time, pivoting in place.\n[0-1.5s] She shifts her weight, smiles at the camera and starts to turn.\n[1.5-3s] She spins around once on the spot so the {garment} swings out.\n[3-4.5s] She turns her back to the camera and looks back over her shoulder, smiling.\n[4.5-6s] She turns to stand in profile, then turns her head to the camera and laughs.\n[6-end] She faces the camera again and waves playfully.",
        seconds: 8,
        cut: 7.4,
        tail: 0,
        loop: false,
        sound: "Street ambience, distant footsteps and a scooter passing far away",
      },
      {
        id: "near",
        label: "Primo piano",
        note: "L'amica si avvicina: fruga nella borsa, lucidalabbra, mani nei capelli, poi tocca il dettaglio del capo.",
        garment: "wears",
        voice: "none",
        camera: `${FRIEND}, now a step closer, a tighter framing with her face and the outfit larger in frame`,
        frame: `Setting: outdoors, the sidewalk of the background-plate image, the same stone facade and the same sun.\nAction: she stands closer to the camera on that sidewalk so her face and outfit are larger in frame, {streetHeroNear}.`,
        motion: "[0-1.5s] She rummages in her bag and pulls out a small lip gloss.\n[1.5-3s] She dabs the lip gloss on and smiles at the camera, then drops it back into the bag.\n[3-4.5s] She runs both hands through her hair, turning her head, the sunlight catching it.\n[4.5-end] She touches {touch} and looks at the camera with a smile.",
        seconds: 6,
        cut: 5.8,
        tail: 0,
        loop: false,
        sound: "Street ambience",
      },
    ],
    edit: [
      { shot: "wide", from: 0.1, to: 1.1 },
      { shot: "near", from: 0.3, to: 1.3 },
      { shot: "wide", from: 1.8, to: 2.8 },
      { shot: "near", from: 1.8, to: 2.8 },
      { shot: "wide", from: 3.3, to: 4.3 },
      { shot: "near", from: 3.2, to: 4.2 },
      { shot: "wide", from: 4.7, to: 5.7 },
      { shot: "near", from: 4.8, to: 5.8 },
      { shot: "wide", from: 6.4, to: 7.4 },
    ],
    music: {
      prompt:
        "Energetic bouncy summer pop instrumental at 120 BPM, full energy from the very first second, punchy four-on-the-floor kick, loud handclaps on two and four, bouncy synth bass, bright funky guitar stabs and a catchy whistle-like hook, playful and cheeky, loud modern mix, viral TikTok outfit check background music",
      bpm: 120,
    },
    caption: {
      brief:
        "Una didascalia autoironica in prima persona, tutta minuscola tranne la prima lettera, 12-16 parole, come quelle delle creator su TikTok: lei che fa l'outfit check per strada mentre ignora qualcosa di più importante, con un finale che si prende in giro sui numeri del profilo. Non descrive il capo e non lo nomina. Esempio di tono (non copiarlo): «Ignoro le chiamate del mio ragazzo perché sto facendo l'outfit check per 27 like e 1 unfollow».",
      style: "caption",
      from: 0,
      to: 9,
    },
  },
  {
    id: "get-dressed",
    label: "Si veste",
    note: "Telefono fermo in un salotto bianco, e lo stesso specchio intagliato per aprire e chiudere. A stacchi: il look finito, la vita, le scarpe, il capo, gli occhiali, la borsa, il calcio e il giro di spalle. Muto, a tempo di musica.",
    angle: "get-dressed hook: the finished mirror look first, then each piece and pose on its own jump cut, closed back at the mirror",
    shots: [
      {
        id: "base",
        label: "La base",
        note: "Maglietta lunga, orlo sopra il ginocchio, senza scarpe: tira l'orlo e appoggia le mani in vita.",
        garment: "own",
        clothes: BASE_CLOTHES,
        voice: "none",
        camera: STAND,
        frame: `Setting: ${SALON}.\nAction: full figure from head to shoes, both hands at the hem of the t-shirt, looking into the lens, no sunglasses and no bag.`,
        motion:
          "[0-0.35s] Both hands tug the hem of the t-shirt once, at a normal speed.\n[0.35-0.8s] Both hands rest at her waist, she tips her head and gives a small smile.\n[0.8-end] She holds that pose, breathing, with a small shift of weight.",
        seconds: 5,
        cut: 1.2,
        tail: 0,
        loop: false,
        sound: "Quiet room tone",
      },
      {
        id: "heels",
        label: "Le scarpe",
        note: "Tende verso la camera un paio di scarpe nere a punta, una per mano. Stesso look della base, senza scarpe ai piedi.",
        garment: "own",
        clothes: BASE_CLOTHES,
        voice: "none",
        camera: STAND,
        frame:
          "Setting: the room of the background-plate image, the phone on the same tripod in the same spot.\nAction: full figure from head to shoes, no sunglasses, both arms extended forward, a black pointed shoe in each hand, the underside of each shoe toward the lens, a playful smile.",
        motion:
          "[0-0.7s] She pushes the shoes a little toward the lens and gives them one small shake, the smile held.\n[0.7-end] She keeps them out, breathing.",
        seconds: 5,
        cut: 1.2,
        tail: 0,
        loop: false,
        sound: "Quiet room tone",
      },
      {
        id: "hold",
        label: "Lo mostra",
        note: "Una mano in alto: il capo appeso accanto a lei. Scarpe e tutto ciò che ha già addosso restano quelli dello scatto prima.",
        garment: "holds",
        voice: "none",
        camera: STAND,
        frame:
          "Setting: the room of the background-plate image, the phone on the same tripod in the same spot.\nAction: full figure from head to shoes, no sunglasses, {pose}, a wide smile, {visible}.",
        motion:
          "[0-0.7s] {sway} and she smiles at the lens.\n[0.7-end] {still}, breathing.",
        seconds: 5,
        cut: 1.2,
        tail: 0,
        loop: false,
        sound: "Quiet room tone, a rustle of fabric",
      },
      {
        id: "on",
        label: "Lo indossa",
        note: "Stacco: ce l'ha già addosso, le tiene tese ai lati, poi le lascia cadere di colpo. Il resto del look resta quello dello scatto prima.",
        garment: "wears",
        voice: "none",
        camera: STAND,
        frame:
          "Setting: the room of the background-plate image, the phone on the same tripod in the same spot.\nAction: full figure from head to shoes, wearing the {garment}, both arms held out to the sides, head tilted, looking into the lens, standing still, no sunglasses and no bag, the whole {garment} visible.",
        motion:
          "[0-0.7s] She holds both arms out to the sides; the {garment} moves with her arms. She stays standing.\n[0.7-1.2s] She drops both arms in one quick motion and looks into the lens.\n[1.2-end] Arms loose at her sides, she holds, breathing.",
        seconds: 5,
        cut: 1.8,
        tail: 0,
        loop: false,
        sound: "Quiet room tone, a swish of fabric as her arms drop",
      },
      {
        id: "shades",
        label: "Gli occhiali",
        note: "Li tiene al collo e li infila in un gesto solo.",
        garment: "wears",
        voice: "none",
        camera: STAND,
        frame: `Setting: the room of the background-plate image, the phone on the same tripod in the same spot.\nAction: full figure from head to shoes, wearing the {garment}, both hands at the collar holding ${NARROW_SHADES} that are not on yet, no bag, standing still, the whole {garment} visible.`,
        motion: `[0-0.6s] She lifts the sunglasses to her eyes and slides them on, at a normal speed.\n[0.6-end] Her hands drop and she holds, the sunglasses on, breathing.`,
        seconds: 5,
        cut: 1.1,
        tail: 0,
        loop: false,
        sound: "Quiet room tone",
      },
      {
        id: "bag",
        label: "La borsa",
        note: "La fa girare in un arco e la riprende, poi le mani tornano alla vita.",
        garment: "wears",
        voice: "none",
        camera: STAND,
        frame: `Setting: the room of the background-plate image, the phone on the same tripod in the same spot.\nAction: full figure from head to shoes, wearing the {garment} and ${NARROW_SHADES}, one hand at her waist, the other holding the chain of ${CHAIN_BAG} so the bag is just leaving her side, the whole {garment} visible.`,
        motion:
          "[0-0.5s] She swings the bag in one fast arc across in front of her, the chain taut.\n[0.5-1.1s] The bag lands back in that hand at her side and both hands come to the waistband, the chain still in one hand.\n[1.1-end] She holds, breathing.",
        seconds: 5,
        cut: 1.4,
        tail: 0,
        loop: false,
        sound: "Quiet room tone, the chain of the bag",
      },
      {
        id: "kick",
        label: "Il calcio",
        note: "Una gamba attraversa davanti, poi la borsa sale in spalla con la testa inclinata.",
        garment: "wears",
        voice: "none",
        camera: STAND,
        frame: `Setting: the room of the background-plate image, the phone on the same tripod in the same spot.\nAction: full figure from head to shoes, wearing the {garment} and ${NARROW_SHADES}, ${CHAIN_BAG} hanging from one hand, the other arm loose, standing still, the whole {garment} visible.`,
        motion:
          "[0-0.6s] She kicks one shoe up and across in front, then sets that shoe straight back down.\n[0.6-1.2s] She lifts the bag by its chain onto her shoulder, tips her head and gives a small smile.\n[1.2-end] She holds with the bag on her shoulder, breathing.",
        seconds: 5,
        cut: 1.6,
        tail: 0,
        loop: false,
        sound: "Quiet room tone, a soft step as the shoe lands, the chain of the bag",
      },
      {
        id: "turn",
        label: "Il giro",
        note: "Un passo verso la camera, poi tre quarti di spalle e lo sguardo indietro.",
        garment: "wears",
        shows: "back",
        voice: "none",
        camera: STAND,
        frame: `Setting: the room of the background-plate image, the phone on the same tripod in the same spot.\nAction: full figure from head to shoes, wearing the {garment} and ${NARROW_SHADES}, one hand in a front pocket, the other holding the chain of ${CHAIN_BAG} so the bag hangs beside her, already mid-step, the whole {garment} visible.`,
        motion:
          "[0-0.6s] She finishes that one step toward the camera.\n[0.6-1.3s] She turns on the spot to a three-quarter back and the bag lands on her shoulder.\n[1.3-1.9s] She looks back over her shoulder and holds, the bag on the shoulder, the back of the {garment} visible.\n[1.9-end] She holds the look back, breathing.",
        seconds: 5,
        cut: 2.2,
        tail: 0,
        loop: false,
        sound: "Quiet room tone, one step on the wooden floor, a swish of fabric as she turns",
      },
      {
        id: "mirror",
        label: "Allo specchio",
        note: "Gancio fermo col telefono; in chiusura il ginocchio, la mano agli occhiali e un saluto con la mano.",
        garment: "wears",
        voice: "none",
        camera: GLASS,
        frame: `Setting: the room of the background-plate image, the phone on the same tripod in the same spot. A large mirror in a gilt frame fills the shot.\nAction: full figure from head to shoes, wearing the {garment} and ${NARROW_SHADES}, one hand holding a phone up, the other hand on the chain of ${CHAIN_BAG}, standing still, looking into the lens, the whole {garment} visible.`,
        motion:
          "[0-0.7s] She holds the pose, the bag sways once, she looks at the phone.\n[0.7-1.5s] She lifts the bag by its chain and her free hand goes to a front pocket; the phone stays up.\n[1.5-2.6s] She lifts one shoe up and across in front, tips her head back so her hair swings, and holds the shoe up; the phone stays up.\n[2.6-3.2s] She sets that shoe down, both shoes on the floor.\n[3.2-3.8s] Her free hand rises to the sunglasses.\n[3.8-4.3s] That hand leaves the sunglasses and comes up.\n[4.3-4.9s] She opens the palm and moves the hand forward toward the mirror; the phone stays up.\n[4.9-end] The hand stays out and she holds, breathing.",
        seconds: 7,
        cut: 5.2,
        tail: 0,
        loop: false,
        sound: "Quiet room tone",
      },
    ],
    edit: [
      { shot: "mirror", from: 0.1, to: 0.6 },
      { shot: "base", from: 0.3, to: 0.8 },
      { shot: "heels", from: 0.1, to: 0.6 },
      { shot: "hold", from: 0.1, to: 0.6 },
      { shot: "on", from: 0.1, to: 1.6 },
      { shot: "shades", from: 0.1, to: 0.6 },
      { shot: "bag", from: 0.1, to: 1.1 },
      { shot: "kick", from: 0.1, to: 0.6 },
      { shot: "kick", from: 0.7, to: 1.2 },
      { shot: "turn", from: 0.1, to: 0.6 },
      { shot: "turn", from: 1.3, to: 1.8 },
      { shot: "mirror", from: 1.6, to: 2.6 },
      { shot: "mirror", from: 3.2, to: 3.7 },
      { shot: "mirror", from: 4.3, to: 4.8 },
    ],
    music: {
      prompt:
        "Bright bouncy fashion-reel instrumental at 120 BPM, full groove from the very first beat, punchy four-on-the-floor kick, snappy claps on two and four, a bouncy synth bass and a light plucked melody, stylish and playful, clean modern mix, TikTok get-dressed background music",
      bpm: 120,
    },
    caption: { text: "30 days of outfits", style: "caption", from: 0, to: 9 },
  },
]

/** Old formats, kept for reference: talking reels still work with the same pipeline if moved back into UGC_FORMATS. */
export const TALKING_FORMATS: UgcFormat[] = [
  {
    id: "fit-check-mirror",
    label: "Fit check allo specchio",
    note: "Parla allo specchio col suo outfit e copre l'obiettivo; stacco: ce l'ha addosso e parla mentre gira; chiude sul dettaglio.",
    angle: "transformation hook: from her everyday outfit to the garment, cut on the beat, then the detail",
    shots: [
      {
        id: "before",
        label: "Prima",
        note: "Allo specchio con i suoi vestiti dice che così non va, poi copre l'obiettivo con la mano.",
        garment: "own",
        voice: "on",
        camera: MIRROR,
        frame:
          "Setting: {home}; a full-length mirror leaning against the wall with a few smudges, late afternoon window light mixed with the warm lamps of the room.\nAction: mirror selfie in her own everyday outfit, phone at chest height, her face fully visible above the phone, mouth slightly open mid-word, looking at the phone screen with a mock-desperate expression.",
        motion: `[0-2.5s] Looking at the phone screen in the mirror, she talks at once with a mock-desperate look, ${TALKS}: {say}\n[2.5-3.3s] Right after her last word she raises her free hand and covers the phone lens with her palm; the frame goes dark.\n[3.3-end] Her palm stays over the lens, dark frame.`,
        seconds: 6,
        cut: 3.3,
        tail: 0.9,
        loop: false,
        sound: "Quiet bedroom room tone, her palm brushing the phone",
      },
      {
        id: "fit",
        label: "Fit",
        note: "Stacco: ce l'ha addosso e parla allo specchio mentre fa mezzo giro.",
        garment: "wears",
        voice: "on",
        camera: MIRROR,
        frame:
          "Setting: the room of the background-plate image, and the same full-length mirror.\nAction: mirror selfie wearing the {garment}, phone at chest height, her face fully visible above the phone, mouth open mid-word, confident pose with her weight on one leg, the whole {garment} visible from neckline to hem.",
        motion: `[0-4.5s] She talks to the phone in the mirror from the first frame, ${TALKS}: {say} While talking she does a quick half turn to her left and back so the {garment} swings, keeping her face toward the mirror.\n[4.5-end] She finishes facing the mirror, a hand on her hip.`,
        seconds: 7,
        cut: 4.8,
        tail: 0.4,
        loop: true,
        sound: "Bedroom room tone, a swish of fabric when she turns",
      },
      {
        id: "detail",
        label: "Dettaglio",
        note: "Da vicino, solo la mano sul dettaglio; la sua voce da dietro il telefono.",
        garment: "wears",
        voice: "over",
        camera: "Handheld phone held close to the garment, pointing down at the fabric",
        frame:
          "Setting: the room of the background-plate image, soft window light.\nAction: close phone shot of {touch} on the {garment} she is wearing, only her fingers and the fabric in frame, her face outside the frame.",
        motion:
          "[0-3.5s] Her fingers run slowly over {touch}, the fabric catches the window light; the autofocus hunts for a moment, then locks. Her face stays outside the frame the whole time, her voice comes from behind the phone: {say}\n[3.5-end] Her hand rests on the fabric.",
        seconds: 5,
        cut: 3.6,
        tail: 0.3,
        loop: false,
        sound: "Close fabric rustle, soft room tone",
      },
    ],
  },
  {
    id: "box-reveal",
    label: "Unboxing",
    note: "Parla in camera mentre apre il pacco e tira fuori il capo; stacco: ce l'ha addosso, giro e commento finale.",
    angle: "unboxing hook: the parcel arrives, she takes it out, then she has it on",
    shots: [
      {
        id: "unbox",
        label: "Apre il pacco",
        note: "Seduta sul letto, parla in camera mentre toglie la carta velina e tira fuori il capo.",
        garment: "holds",
        voice: "on",
        camera: `${PROPPED} at eye level against a pile of books, as for a TikTok unboxing`,
        frame:
          "Setting: {home}; she sits cross-legged on the bed or sofa, an open cardboard parcel on her lap with crumpled white tissue paper, ordinary lived-in room.\nAction: both hands in the parcel lifting the tissue paper, the {garment} folded inside and partly visible, looking into the lens, mouth open mid-word, excited.",
        motion: `[0-5s] She talks to the camera the whole time, ${TALKS}: {say} As she speaks she pushes the tissue paper aside, lifts the {garment} out of the parcel and lets it unfold, holding it out to one side at arm's length so that {show} can be seen; the {garment} never passes in front of her face, which stays visible and talking.\n[5-end] She lays it across her lap.`,
        seconds: 8,
        cut: 5.2,
        tail: 0.4,
        loop: false,
        sound: "Room tone of a lived-in flat, tissue paper crinkling, cardboard rustling",
      },
      {
        id: "on",
        label: "Addosso",
        note: "Stacco: in piedi in camera, ce l'ha addosso, fa un giro e poi dice cosa ne pensa guardando in camera.",
        garment: "wears",
        voice: "on",
        camera: `${PROPPED} at hip height on the desk, her full figure in frame`,
        frame:
          "Setting: the room of the background-plate image, the open parcel and the tissue paper on the bed behind her.\nAction: she stands in the middle of the room wearing the {garment}, full figure from head to shoes, arms slightly open in a 'ta-da' gesture, looking into the lens.",
        motion: `[0-2s] 'Ta-da': she opens her arms and does a full slow spin on the spot so the {garment} moves and the back can be seen.\n[2-5.5s] Facing the lens again, she steps closer and talks to the camera, ${TALKS}: {say}\n[5.5-end] She stays close to the phone.`,
        seconds: 8,
        cut: 5.5,
        tail: 0.3,
        loop: false,
        sound: "Room tone, fabric swish on the spin, her footsteps on the floor",
      },
    ],
  },
  {
    id: "grwm-out",
    label: "Get ready with me",
    note: "Si prepara parlando in camera, si guarda allo specchio col capo addosso, poi esce di casa: tre scatti da stories.",
    angle: "styling hook: getting ready to go out, the garment as the outfit of the evening",
    shots: [
      {
        id: "ready",
        label: "Si prepara",
        note: "Al tavolino con lo specchio, col suo outfit: si scioglie i capelli e racconta dove va.",
        garment: "own",
        voice: "on",
        camera: `${PROPPED} on the dressing table at face height`,
        frame:
          "Setting: {home}; at a small dressing table with a round mirror, makeup, a hair clip and a candle scattered on it, warm lamp light.\nAction: in her own everyday outfit, hair clipped up, one hand at the clip, looking into the phone camera, mouth open mid-sentence.",
        motion: `[0-3s] Looking into the lens she talks at once, ${TALKS}: {say} As she talks she unclips her hair and shakes it loose.\n[3-4s] She stands up and leaves the frame.`,
        seconds: 6,
        cut: 3.8,
        tail: 0.7,
        loop: false,
        sound: "Quiet room tone, the hair clip dropped on the table",
      },
      {
        id: "look",
        label: "Il look",
        note: "Allo specchio col capo addosso: parla mentre si gira di lato e tocca il dettaglio.",
        garment: "wears",
        voice: "on",
        camera: MIRROR,
        frame:
          "Setting: {home}, a full-length mirror, evening lamp light.\nAction: mirror selfie wearing the {garment}, hair down, ready to go out, full look visible from head to shoes, phone at chest height, her face fully visible above the phone, mouth open mid-word.",
        motion: `[0-4.5s] She talks to the phone in the mirror from the first frame, ${TALKS}: {say} While talking she turns to one side and then the other so the {garment} moves, and touches {touch}.\n[4.5-end] She holds the pose.`,
        seconds: 7,
        cut: 4.6,
        tail: 0.3,
        loop: true,
        sound: "Room tone, fabric swish",
      },
      {
        id: "out",
        label: "Esce",
        note: "Ultimo selfie allo specchio uscendo di casa, borsa in spalla: una battuta e va.",
        garment: "wears",
        voice: "on",
        camera: MIRROR,
        frame:
          "Setting: {exit}.\nAction: quick mirror selfie on her way out, wearing the {garment}, a small bag on her shoulder, keys in her free hand, phone at chest height, her face fully visible above the phone, mouth open mid-word.",
        motion: `[0-2.5s] She says a quick last line to the phone in the mirror, ${TALKS}: {say}\n[2.5-4s] Right after her last word she turns toward the door as if leaving, keys jingling.`,
        seconds: 6,
        cut: 3.6,
        tail: 0.8,
        loop: false,
        sound: "Building hallway echo, keys jingling",
      },
    ],
  },
]

export function ugcFormat(id: string): UgcFormat {
  const format = UGC_FORMATS.find((f) => f.id === id)
  if (!format) throw new Error(`formato UGC sconosciuto: ${id} (disponibili: ${UGC_FORMATS.map((f) => f.id).join(", ")})`)
  return format
}

/** Frames and clips are labelled `format:shot`; the reel carries the format id alone. */
export const shotLabel = (formatId: string, shotId: string) => `${formatId}:${shotId}`

export function ugcShot(label?: string): { format: UgcFormat; shot: UgcShot } | undefined {
  const [formatId, shotId] = (label ?? "").split(":")
  const format = UGC_FORMATS.find((f) => f.id === formatId)
  const shot = format?.shots.find((s) => s.id === shotId)
  return format && shot ? { format, shot } : undefined
}

const tenths = (n: number) => Math.round(n * 10) / 10

/** Seconds of the edited reel. */
export const reelSeconds = (format: UgcFormat) =>
  tenths(format.edit ? format.edit.reduce((t, c) => t + c.to - c.from, 0) : format.shots.reduce((t, s) => t + s.cut, 0))

/** Seconds of one shot that end up in the reel. */
export const shotSeconds = (format: UgcFormat, shot: UgcShot) =>
  tenths(format.edit ? format.edit.filter((c) => c.shot === shot.id).reduce((t, c) => t + c.to - c.from, 0) : shot.cut)

/** A reel with nothing spoken needs no script and no voice. */
export const speaks = (format: UgcFormat) => format.shots.some((s) => s.voice !== "none")

/** How a hold shot presents this garment: one hanging piece, or one separate piece per hand. */
function holdCues(plan: ShootPlan): { pose: string; sway: string; still: string; visible: string; hanger: string; hangerSway: string } {
  const pieces = (plan.ugc.pieces ?? []).map((p) => p.trim()).filter(Boolean)
  if (pieces.length <= 1) {
    const name = plan.noun
    return {
      pose: `one arm raised straight up holding the ${name} so it hangs full length beside her, the other arm down`,
      sway: `The ${name} sways once on her raised hand`,
      still: `She keeps it raised, the ${name} hanging still`,
      visible: `the whole ${name} visible`,
      hanger: `holding the ${name} on a wooden hanger up in front of her at arm's length toward the camera, the whole ${name} visible and hanging naturally`,
      hangerSway: `She sways the ${name} on its hanger left and right twice at a normal speed so the fabric swings`,
    }
  }
  const named = pieces.map((p) => `the ${p}`)
  const pair =
    named.length === 2
      ? `${named[0]} in one hand and ${named[1]} in the other`
      : `${named[0]} in one hand and ${named[1]} in the other, ${named.slice(2).join(" and ")} draped over one forearm`
  const hangers =
    named.length === 2
      ? `${named[0]} on one hanger and ${named[1]} on the other`
      : `${named[0]} on one hanger and ${named[1]} on the other, ${named.slice(2).join(" and ")} over one forearm`
  return {
    pose: `both arms raised, ${pair}, each piece fully visible and hanging on its own`,
    sway: `Each piece sways once in its own hand`,
    still: `She keeps every piece raised, each one hanging on its own`,
    visible: `every piece of the ${plan.noun} visible`,
    hanger: `holding a wooden hanger in each hand at arm's length toward the camera, ${hangers}, each piece fully visible and hanging on its own`,
    hangerSway: `She sways each hanger left and right twice at a normal speed so each piece swings on its own`,
  }
}

/** The Italian line under a hold shot: one raised hand for a single garment, one piece per hand when they are separate. */
export function shotNote(shot: UgcShot, plan?: ShootPlan): string {
  const pieces = plan?.ugc.pieces?.map((p) => p.trim()).filter(Boolean) ?? []
  if (shot.garment !== "holds" || pieces.length < 2) return shot.note
  const named = pieces.length === 2 ? "i due pezzi" : pieces.length === 3 ? "i tre pezzi" : `i ${pieces.length} pezzi`
  if (shot.id === "hanger") return `Una gruccia per pezzo: tiene ${named} staccati, ognuno appeso per conto suo.`
  return `Un pezzo per mano: tiene ${named} staccati, ognuno appeso per conto suo. Scarpe e tutto ciò che ha già addosso restano quelli dello scatto prima.`
}

function fill(text: string, plan: ShootPlan, c?: Creator): string {
  const held = holdCues(plan)
  return groundBag(
    text
    .replaceAll("{city}", c?.city ?? "")
    .replaceAll("{home}", c?.home ?? "")
    .replaceAll("{exit}", c?.exit ?? "")
    .replaceAll("{garment}", plan.noun)
    .replaceAll("{show}", plan.ugc.show)
    .replaceAll("{touch}", plan.ugc.touch)
    .replaceAll("{pose}", held.pose)
    .replaceAll("{sway}", held.sway)
    .replaceAll("{still}", held.still)
    .replaceAll("{visible}", held.visible)
    .replaceAll("{hanger}", held.hanger)
    .replaceAll("{hangerSway}", held.hangerSway)
    .replaceAll("{streetHeroWide}", streetHeroWide(plan, c))
    .replaceAll("{streetHeroNear}", streetHeroNear(plan))
    .replaceAll("{ootdAccessories}", ootdAccessories(plan))
    .replaceAll(
      "{ootdLookOpening}",
      carried(plan)
        ? `she stands in the middle of the room in her ${c?.outfit ?? "everyday clothes"}, full figure from head to shoes`
        : `she stands in the middle of the room wearing the ${plan.noun}, full figure from head to shoes, the whole ${plan.noun} visible from neckline to hem`,
    )
    .replaceAll("{bagProp}", CHAIN_BAG),
    plan,
  )
}

/**
 * «Si veste» was written for a garment plus a prop bag. When the product is the bag, that prop is the product:
 * one bag, held by the handles, so a turn shows its sides instead of a second invented bag.
 */
function groundBag(text: string, plan: ShootPlan): string {
  if (!carried(plan)) return text
  const bag = `the ${plan.noun}`
  return text
    .replaceAll(CHAIN_BAG, bag)
    .replaceAll(`holding the chain of ${bag}`, `holding ${bag} by its handles`)
    .replaceAll(`on the chain of ${bag}`, `on the handles of ${bag}`)
    .replaceAll(`the chain of ${bag}`, `the handles of ${bag}`)
    .replaceAll("by its chain", "by its handles")
    .replaceAll("the chain taut", "the handles in her hand")
    .replaceAll("the chain still in one hand", "the handles still in one hand")
    .replaceAll("onto her shoulder", "back beside her, still held by the handles")
    .replaceAll("the bag lands on her shoulder", `${bag} stays in her hand`)
    .replaceAll("the bag on the shoulder", `${bag} in her hand`)
    .replaceAll("with the bag on her shoulder", `with ${bag} in her hand at her side`)
    .replaceAll(`wearing ${bag}`, `holding ${bag} by its handles`)
    .replaceAll("and no bag", `and ${bag} in one hand`)
    .replaceAll(", no bag,", `, ${bag} in one hand,`)
    .replaceAll("no bag", `${bag} in one hand`)
}

function heldGarment(plan: ShootPlan): string {
  const pieces = (plan.ugc.pieces ?? []).map((p) => p.trim()).filter(Boolean)
  if (pieces.length <= 1) return `the ${plan.noun} shown in the other images`
  return `the separate pieces of the ${plan.noun} shown in the other images, ${pieces.map((p) => `the ${p}`).join(" and ")}. Each piece is its own garment`
}

/**
 * Her own outfit stays on only under outerwear. Everything else replaces it: the creator reference shows her dressed,
 * so without this the editor layers the garment on top of the clothes she already has on.
 * Shoes and legwear are not hers: they are copied from the approved on-model photo (`styled`). When `carry` is set,
 * the previous moment of the reel is the look, and this shot's action is the only change.
 */
function garmentLine(plan: ShootPlan, shot: UgcShot, c: Creator, styled: boolean, carry: boolean): string {
  const kept = "Everything else already in the previous moment stays, unless the action below changes it."
  if (shot.garment === "own") {
    if (shot.clothes) return `She wears ${shot.clothes}.`
    if (carry) return `She stays as in the previous-moment image. ${kept}`
    return `She wears her own ${c.outfit}.`
  }
  if (shot.garment === "holds") {
    const held = heldGarment(plan)
    if (shot.clothes) return `She wears ${shot.clothes} and holds ${held}.`
    if (carry) return `She holds ${held}. ${kept}`
    return `She wears her ${c.outfit} and holds ${held}.`
  }
  if (carry) {
    if (carried(plan)) return `She keeps the clothes already on her. ${hold(plan, plan.ugc.wear, " The chain stays in that hand and does not go over her shoulder.")} ${kept}`
    const worn = plan.ugc.over
      ? `She now wears the ${plan.noun} shown in the other images, ${plan.ugc.wear}, over the clothes already on her in the previous moment.`
      : `She now wears the ${plan.noun} shown in the other images, in place of the clothes she had on in the previous moment.`
    return `${worn} ${kept}`
  }
  if (plan.ugc.over) return `She now wears the ${plan.noun} shown in the other images, ${plan.ugc.wear}, over her ${c.outfit}.`
  if (carried(plan)) return `She keeps her own ${c.outfit}. ${hold(plan, plan.ugc.wear, " The chain stays in that hand and does not go over her shoulder.")}`
  if (wornAlone(plan)) {
    const feet = styled ? "Her feet stay exactly as in the approved on-model photograph." : "Her feet stay as they are in the person reference."
    return `She now wears only the ${plan.noun} shown in the other images. The ${plan.noun} is the only garment. ${feet}`
  }
  const shoes = styled
    ? "Shoes and legwear are copied from the approved on-model photograph, and her own shoes stay off."
    : `She wears it with ${plan.outfit}, and her own ${c.shoes} stay off.`
  return `She now wears the ${plan.noun} shown in the other images, ${plan.ugc.wear}. ${shoes}`
}

/** Which earlier images of this reel are attached after the packshots. */
export type UgcContinuity = {
  /** the first shot's frame, so the cuts stay in one room */
  plate: boolean
  /** the previous shot, so the whole look already generated stays, except what this shot's action changes */
  carry: boolean
  /** one image is both: the previous shot is the background plate */
  combined: boolean
}

/**
 * `roles` are the garment packshots after the identity reference (none for her own-clothes shots). `styled` inserts the
 * approved on-model photo as Image 2, the lock for how the garment sits. When `continuity.carry` is set, the whole
 * look comes from the previous moment of the reel, and this shot's action is the only change.
 */
export function ugcFramePrompt(
  plan: ShootPlan,
  roles: RefRole[],
  shot: UgcShot,
  c: Creator,
  styled = false,
  continuity: UgcContinuity = { plate: false, carry: false, combined: false },
): string {
  const withGarment = shot.garment !== "own"
  const people = 1 + (styled ? 1 : 0)
  let next = roles.length + people + 1
  let plateAt = 0
  let carryAt = 0
  if (continuity.combined) plateAt = carryAt = next
  else {
    if (continuity.plate) plateAt = next++
    if (continuity.carry) carryAt = next++
  }
  const styleLine = !styled
    ? ""
    : carryAt
      ? `\nImage 2 is the approved on-model photograph of this same ${plan.noun}. It is the reference for how the ${plan.noun} sits, and for nothing else. The rest of her look stays as in the previous-moment image. Her face and hair stay those of Image 1. Its studio background is not this shot's room.`
      : `\nImage 2 is the approved on-model photograph of this same ${plan.noun}. Her shoes and anything worn below the hem stay exactly as in Image 2. Her face and hair stay those of Image 1. Its studio background is not this shot's room.`
  const samePlace = shot.frame.includes("background-plate")
  const plateLine =
    !plateAt || continuity.combined
      ? ""
      : samePlace
        ? `\nImage ${plateAt} is the background plate, an earlier frame of this reel in this same place. Reproduce that place exactly: the same facade, the same objects, the same ground and the same daylight, in the same positions. Image 1 gives her face and hair only; the place behind her in Image 1 is not used. ${carryAt ? "Her look comes from the previous-moment image, changed only by this shot's action. Do not copy her clothes from the plate." : "Her clothes and her action follow this shot."} Where she steps closer, whatever shows behind her still belongs to that place.`
        : `\nImage ${plateAt} is an earlier shot of the same reel: keep the same face and hair. This shot is in another place, so the room comes from the setting below.`
  const carryLine = !carryAt
    ? ""
    : `\nImage ${carryAt} is the previous moment of this reel${continuity.combined ? ", and the background plate of the room" : ""}: the last frame of the previous clip when that clip exists, otherwise that shot's frame. ${continuity.combined ? "Reproduce that place exactly: the same facade, the same objects, the same ground and the same daylight, in the same positions. Image 1 gives her face and hair only; the place behind her in Image 1 is not used. " : ""}Continue from that image: the same clothes, the same shoes, the same accessories, the same bag and the same props, exactly as generated. Change only what the action below explicitly changes. Where it gives her a different outfit, puts the product on or away, or adds or removes an accessory, follow the action and leave the rest untouched. Something the action names that is already in that image stays that exact one.`
  const backStill = roles.includes("back")
    ? `The back packshot is the construction of the back, for when she turns. This frame keeps the pose in the action below: do not turn her to match it, and do not copy its white background.\n`
    : ""
  const garment = withGarment
    ? `${rolesText(roles, plan).replace(/Image (\d+)/g, (_, n: string) => `Image ${Number(n) + people}`)}

The ${plan.noun} must be identical to the packshots: ${plan.description}, with ${plan.identity}.
Keep ${plan.lock} identical; do not redesign the ${plan.noun}.
${backStill}${scaleLine(plan)}${oneBagRule(plan)}
`
    : ""
  return ugcSafe(`Create a photorealistic vertical 9:16 smartphone photo for a paid-social creator video.
Image 1 is the identity reference for a fictional adult creator: preserve her face and hair exactly. ${garmentLine(plan, shot, c, styled, !!carryAt)}${styleLine}${plateLine}${carryLine}
${garment}
${fill(shot.frame, plan, c)}
Deliverable: pause-frame of an authentic TikTok or Instagram Reel shot on a phone, imperfect framing, real lived-in place, casual.
Style: everyday opaque clothing, relaxed candid posture, original invented adult face, ${withGarment && !carryAt ? `the ${plan.noun} as the only fashion item in focus, ` : ""}no text, no logo, no watermark.`)
}

/**
 * Packshots may name a bodice or a hem landmark. The same words, in a prompt with a person in frame, get flagged
 * by the image checker, which ignores context. Rewritten here for UGC frames and clips.
 * `sweetheart`, `strapless` and `cutout` are flagged on their own once a person is in the prompt; the packshots still carry them.
 */
function ugcSafe(text: string): string {
  return text
    .replaceAll(/structured sweetheart cups/gi, "structured curved neckline")
    .replaceAll(/sweetheart cup shape/gi, "curved neckline")
    .replaceAll(/sweetheart cup curve/gi, "neckline curve")
    .replaceAll(/sweetheart cups/gi, "curved neckline")
    .replaceAll(/sweetheart/gi, "curved")
    .replaceAll(/strapless/gi, "sleeveless")
    .replaceAll(/cut-?out/gi, "opening")
    .replaceAll(/just below the collarbone/gi, "at the top of the bodice")
    .replaceAll(/collarbone/gi, "shoulder line")
    .replaceAll(/well above the knee/gi, "at mini length")
    .replaceAll(/above the knee/gi, "at the hem")
    .replaceAll(/wrist bone/gi, "wrist")
    .replaceAll(/two fingers wide/gi, "a narrow band")
    .replaceAll(/on the legs/gi, "below the hem")
}

/**
 * A voice changes the words as well as the delivery. `tone` goes outside the dialogue tags, where H3 reads the
 * delivery; `words` steers the script.
 */
export type UgcVoice = {
  id: string
  label: string
  note: string
  tone: string
  words: string
  /** how she opens: without a fixed opener every voice starts on "Ragazze" */
  opener: string
  /** whether a <laughs> cue survives; the text model adds one to almost every line otherwise */
  laughs: boolean
}

export const UGC_VOICES: UgcVoice[] = [
  {
    id: "hype",
    label: "Entusiasta",
    note: "Energia alta da TikTok: «Raga, no, guardate»",
    tone: "high energy, fast and bubbly, genuinely excited, like a Gen Z creator talking to her followers",
    words: "carica e veloce, esclamazioni vere ('Ma quanto è bello?', 'Guardate che roba'), può ridere una volta.",
    opener: "un'esclamazione, per esempio 'Ragazze!', 'Ma quanto è bello?', 'Oddio, è arrivato.'",
    laughs: true,
  },
  {
    id: "bestie",
    label: "Complice",
    note: "Come un vocale alle amiche: «Ragazze, ve lo devo far vedere»",
    tone: "warm and playful, quick conversational pace, like a voice note to her followers",
    words: "come un vocale alle amiche, tono divertito da chiacchiera.",
    opener: "da chiacchiera, per esempio 'Non so voi, ma io…', 'Ve lo devo far vedere.', 'Allora, raga.'",
    laughs: true,
  },
  {
    id: "review",
    label: "Recensione",
    note: "Parere sincero: «Allora, vi dico com'è»",
    tone: "confident and direct, brisk pace, an honest fashion creator giving her opinion",
    words: "parere sincero, una cosa concreta che le piace (come cade, il colore, come sta addosso), chiude con 'per me è sì' o 've lo consiglio'.",
    opener: "da parere, per esempio 'Allora, vi dico com'è.', 'Vi dico la verità.', 'Parere sincero?'",
    laughs: false,
  },
  {
    id: "dry",
    label: "Ironica",
    note: "Autoironia leggera: «Dovevo solo guardare. Appunto.»",
    tone: "deadpan and dry, quick timing, a small smirk in the voice",
    words: "autoironia leggera all'italiana ('Il mio autocontrollo? Zero.'), una battuta asciutta alla fine.",
    opener: "autoironico, per esempio 'Dovevo solo guardare.', 'Non dovevo comprare niente.', 'Non ho niente da mettere.'",
    laughs: true,
  },
  {
    id: "chill",
    label: "Rilassata",
    note: "Casual da stories: «Allora, oggi vi faccio vedere questo»",
    tone: "relaxed and casual but fluent, easy pace, like an Instagram story",
    words: "tranquilla da stories, frasi semplici che scorrono, qualche 'tipo' o 'cioè' dove viene naturale, niente esclamazioni forti.",
    opener: "tranquillo, per esempio 'Allora, oggi vi faccio vedere questo.', 'Ok, finalmente.', 'Allora.'",
    laughs: false,
  },
]

export const ugcVoice = (id?: string) => UGC_VOICES.find((v) => v.id === id) ?? UGC_VOICES[0]

/**
 * Written in Italian on purpose: an English brief comes back as translated influencer talk ("Amica, ascoltami",
 * "Dieci su dieci, promosso") and catalogue words (drappeggio, manica a mantella) that no creator says.
 */
export const SPOKEN_SYSTEM = `Scrivi cosa dice una creator di moda italiana di 20-25 anni in un Reel o in un TikTok montato. Deve suonare come parla davvero una ragazza italiana al telefono: non una traduzione dall'inglese, non una pubblicità, non una commessa. Rispondi solo in JSON.`

/** H3 speaks Italian slower than a creator, under two words a second; a longer line runs past the end of the clip. */
const spokenBudget = (seconds: number) => Math.max(3, Math.round(seconds * 1.8))

const CUES = ["", "laughs", "pause"] as const
export type SpokenLine = { before: (typeof CUES)[number]; text: string }
/** The script of a whole reel, one entry per speaking shot, so the lines run across the cuts as one monologue. */
export type Script = { shots: Array<{ id: string; lines: SpokenLine[] }> }

export function scriptPrompt(plan: ShootPlan, format: UgcFormat, voice: UgcVoice): string {
  const copy = plan.ugc.copy[format.id]
  const heard = { on: "parla in camera", over: "fuori campo, si sente solo la voce", none: "" }
  const shots = format.shots
    .filter((s) => s.voice !== "none")
    .map(
      (s, i) =>
        `${i + 1}. id "${s.id}", ${s.label}, ${heard[s.voice]}, ${s.cut} secondi, ${Math.round(spokenBudget(s.cut) * 0.6)}-${spokenBudget(s.cut)} parole. Cosa fa (in inglese, solo per sapere i gesti): ${fill(s.motion, plan).replace("{say}", "…").replaceAll("\n", " ")}`,
    )
  return `Reel montato: ${format.label}. ${format.note}
Gli scatti, in ordine (tra uno e l'altro c'è uno stacco di montaggio):
${shots.join("\n")}
Il capo (scheda in inglese, solo per sapere com'è fatto): ${plan.description}. Il dettaglio che mostra: ${plan.ugc.touch}.
${copy?.hook ? `L'idea dell'annuncio: ${copy.hook}.` : ""}

Scrivi cosa dice lei in ogni scatto. È un solo discorso che continua da uno scatto all'altro, come nei Reel veri: il primo scatto aggancia, l'ultimo chiude con una reazione o un parere secco. Negli scatti in cui ha ancora i suoi vestiti non parla del capo, lo annuncia ("aspettate", "ok, adesso").
Voce: ${voice.words}
Apertura: ${voice.opener} Varia, non copiare per forza gli esempi.${voice.laughs ? "" : " Questa voce non ride."}

Come parlano davvero le creator italiane (esempi di tono, non copiarli):
- "Ragazze, è arrivato. Ve lo faccio vedere subito perché non ce la faccio."
- "Ma quanto è bello questo rosso? Dal vivo è ancora meglio."
- "Non so voi, ma io con un vestito così ci vado ovunque."
- "Guardate come si muove quando giro. Cioè, ma vi rendete conto?"
- "Allora, vi dico la verità: addosso sta benissimo. Per me è sì."

Regole:
- Parla ai follower, al plurale ("guardate", "vi faccio vedere"), come in una storia. "Ragazze" solo se è nell'apertura della voce. Mai "amica", mai "ascoltami".
- Parole di tutti i giorni. Il capo si chiama "questo vestito", "questa gonna", "questa giacca"; i dettagli "questa manica", "questo rosso", "come cade", "come si muove". Vietati i termini da scheda tecnica: drappeggio, drappeggiato, mantella, mantellina, crêpe, asimmetrico, tulipano, tubino, silhouette, capo, bicolore, cremisi.
- Niente frasi tradotte dall'inglese: vietati "ti giuro" a inizio frase, "guarda solo", "ho perso", "promosso", "dieci su dieci", "verdetto", "ossessionata", "stiamo scherzando", "fermi tutti", "no vabbè", "fa tutto lui".
- Ogni scatto: 1-2 frasi brevi, entro le parole indicate. Le frasi si attaccano una all'altra, niente silenzi.
- Reazioni e opinioni sì ("addosso sta benissimo", "me ne sono innamorata"); fatti inventati no: niente storie di quando l'ha già messo, niente prezzi, date, sconti, marchi.
- Mai parlare di disponibilità, pre-ordine, ordinazione, produzione, spedizione, scorte o link.
- Le parole seguono i gesti ("guardate" quando mostra il dettaglio).
- Al massimo una parola o un pezzetto di frase in <i>…</i> in tutto il reel. Nessun altro tag nel testo.
- "before" è il segnale prima di una frase: "" (niente, quasi sempre), "laughs" (solo se la voce lo permette, mai prima della prima frase del reel) o "pause" (una pausa breve, al massimo una volta in tutto il reel).

JSON: { "shots": [ { "id": string, "lines": [ { "before": string, "text": string } ] } ] }`
}

/**
 * H3 dialogue of one shot: one `<d>` block per sentence, emphasis kept as `<i>`. `first` is the opening shot of the
 * reel, where a laugh would come before anything is said.
 */
export function shotDialogue(lines: SpokenLine[], shot: UgcShot, voice: UgcVoice, first: boolean): string {
  const clean = (text: string) => text.replace(/<(?!\/?i>)[^>]*>/g, "").replace(/\s+/g, " ").trim()
  const kept = lines.map((l) => ({ before: CUES.includes(l.before) ? l.before : "", text: clean(l.text ?? "") })).filter((l) => l.text)
  const words = (text: string) => text.replace(/<[^>]*>/g, "").split(/\s+/).length
  while (kept.length > 1 && kept.reduce((n, l) => n + words(l.text), 0) > spokenBudget(shot.cut) + 2) kept.pop()
  return kept
    .map((l, i) => {
      const pause = l.before === "pause" && i > 0 && shot.cut >= 5
      const laugh = l.before === "laughs" && voice.laughs && !(first && i === 0)
      return [pause ? "<pause>" : "", laugh ? "<laughs>" : "", `<d>[Italian] ${l.text}</d>`].filter(Boolean).join(" ")
    })
    .join(" ")
}

const HEARD: Record<UgcShot["voice"], (tone: string, cut: number) => string> = {
  on: (tone, cut) =>
    `Live speech recorded by the phone microphone, spoken on camera in Italian with a native Italian accent, ${tone}. Her mouth stays visible while she speaks and her lips articulate every syllable in sync with the audio, like a real creator talking to her phone; it is not a voice-over. While she speaks she does not smile with closed lips, pout or pull faces. She has finished by second ${cut}.`,
  over: (tone, cut) =>
    `Her voice comes from behind the phone, in Italian with a native Italian accent, ${tone}; her face never enters the frame. She has finished by second ${cut}.`,
  none: () => "",
}

/** `said` is the H3 dialogue of this shot, empty for a silent shot or when the script has nothing for it. `roles` are the packshots sent beside the opening frame. */
export function ugcVideoPrompt(plan: ShootPlan, shot: UgcShot, voice: UgcVoice, said: string, roles: RefRole[] = []): string {
  const pieces = (plan.ugc.pieces ?? []).map((p) => p.trim()).filter(Boolean)
  const garment =
    shot.garment === "own"
      ? "the product is not in this shot"
      : shot.garment === "holds" && pieces.length > 1
        ? `holding the separate pieces of this ${plan.noun}, each its own garment: ${pieces.map((p) => `the ${p}`).join(", ")}. ${plan.description}. Each piece keeps its own shape for the whole clip.`
        : `${shot.garment === "wears" ? "wearing" : "with"} this exact ${plan.noun}: ${plan.description}.
The ${plan.noun} keeps ${plan.identity} for the whole clip; hardware and trims keep their shape and colour.`
  const backAt = roles.indexOf("back")
  const views = roles.length
    ? `${rolesText(roles, plan)}
These images are the ${plan.noun} only, not her face and not the place. The clip opens on the first frame. When she turns, each side of the ${plan.noun} that faces the camera is the matching image above. Do not invent another ${plan.noun}, a closure, a strap or a different shape.\n`
    : ""
  const turned =
    shot.shows === "back" && shot.garment !== "own"
      ? backAt >= 0
        ? `When she turns and the back of the ${plan.noun} faces the camera, that back is exactly Image ${backAt + 1} and nothing else. Do not add a closure, buttons, a belt, an opening or a second piece.`
        : `When she turns and the back of the ${plan.noun} faces the camera, that back is exactly this and nothing else: ${plan.views.back} Do not add a closure, buttons, a belt, an opening or a second piece that this does not describe.`
      : ""
  const kept =
    "Everything else stays as in the first frame for the whole clip: her clothes, her shoes, her accessories, her bag and the props, exactly as generated. Change only what the timeline explicitly changes."
  const handheld = shot.camera.startsWith("Handheld")
  const shake = handheld
    ? "handheld phone, low-amplitude micro-tremor from the wrist, no orbit, no zoom"
    : "the phone stays propped and still, a tiny wobble when she touches the surface, no zoom"
  const speaks = !!said && shot.voice !== "none"
  const timeline = speaks ? fill(shot.motion, plan).replace("{say}", said) : fill(shot.motion, plan).replace(/,? ?[^,.:]*:\s*\{say\}/, ".")
  // H3 stretches each gesture across its whole time slot, which reads as slow motion. Silent reels have no speech to
  // pin the pace, so the timeline has to be played at phone-video speed and the leftover of a slot is a live hold.
  const pace =
    shot.voice === "none"
      ? `\nPace\nPlay every gesture at ordinary real-time speed, the pace of a person filmed on a phone: a step about half a second, a full turn on the spot about one second, a hand gesture under a second. Do not stretch a gesture to fill its time slot. When the movement is done she stays alive until the next beat: she breathes and shifts her weight.\n`
      : ""

  return ugcSafe(`Vertical 9:16, ${shot.seconds} seconds, one continuous take, no cuts. The action happens in the first ${shot.cut} seconds.
${views ? `\n${views}` : ""}
Scene
Casual creator video shot on a phone, with the spontaneous, slightly imperfect look of a personal social-media recording.
Ordinary phone-camera dynamic range, gentle exposure breathing, auto white balance, restrained sharpening, natural skin colour with visible pores.
The same woman from the first frame, same face and hair, ${garment}. ${kept}${turned ? ` ${turned}` : ""}

Timeline
${timeline}
${pace}
Camera
${shot.camera}; ${shake}. Slightly imperfect framing, as held by a real person.
${speaks ? `\nVoice (S1)\n${HEARD[shot.voice](voice.tone, shot.cut)}\n` : ""}
Audio
${shot.sound}. ${speaks ? "Her voice close to the phone microphone, not a studio voice. " : "She does not speak. "}No other voices.
non_diegetic_music: N/A

Constraints
The place stays exactly as in the first frame for the whole clip: walls, furniture, objects, floor and light keep their positions. Only she moves. Real and unpolished, no studio.
No on-screen text, no captions, no subtitles, no logos, no watermark, no extra people talking, no beauty smoothing, no plastic skin.`)
}

/** One reel per template, each with its default creator; the UI can shoot any template with any creator. */
export const UGC_PLAN: Array<{ creator: string; format: string }> = [
  { creator: "chiara-2", format: "ootd" },
  { creator: "giulia", format: "street-check" },
  { creator: "amina-2", format: "get-dressed" },
]

export const UGC_PLAN_MEN: Array<{ creator: string; format: string }> = [
  { creator: "marco", format: "ootd" },
  { creator: "leo", format: "street-check" },
  { creator: "davide", format: "get-dressed" },
]

export function planFor(line: Line) {
  return line === "uomo" ? UGC_PLAN_MEN : UGC_PLAN
}

const CAPTION_SYSTEM = `Scrivi i testi a schermo dei Reel di una creator di moda italiana di 20-25 anni. Devono suonare come li scrive davvero una ragazza italiana su TikTok, non come una pubblicità. Rispondi solo in JSON.`
const CAPTION_SYSTEM_MEN = `Scrivi i testi a schermo dei Reel di un creator di moda italiano di 20-30 anni. Devono suonare come li scrive davvero un ragazzo italiano su TikTok, non come una pubblicità. Rispondi solo in JSON.`

export function captionPrompt(plan: ShootPlan, format: UgcFormat, line: Line = "donna"): { system: string; prompt: string } {
  return {
    system: line === "uomo" ? CAPTION_SYSTEM_MEN : CAPTION_SYSTEM,
    prompt: `Reel: ${format.label}. ${format.note}
Il capo che indossa (scheda in inglese, solo per sapere cos'è): ${plan.description}.
${format.caption?.brief ?? ""}
Regole: niente hashtag, niente emoji, niente marchi, prezzi, sconti o link; mai parlare di disponibilità, ordini o spedizioni.
JSON: { "hook": string, "line": string }  (hook: l'ipotesi dell'annuncio in 8 parole al massimo; line: la didascalia)`,
  }
}
