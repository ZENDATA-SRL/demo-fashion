/** Brand vocabulary tied to image LoRAs: trigger tokens the fine-tuned weights listen for. */

export type LoraTagCategory = "fabric" | "texture" | "hardware" | "colour" | "finish"

export type LoraTag = {
  /** Token injected near the material clause in the generation prompt */
  token: string
  label: string
  category: LoraTagCategory
  /** DNA field keys this token is meant to steer */
  fieldKeys: string[]
  /** Short note for the UI: what the LoRA layer latches onto */
  loraNote: string
  /** Example phrase as it would appear beside the token in a prompt */
  promptSnippet: string
}

export type BrandLoraProfile = {
  id: string
  label: string
  maison: string
  lora: { file: string; strength: number; base: string }
  tags: LoraTag[]
}

export const BRAND_LORA_PROFILES: BrandLoraProfile[] = [
  {
    id: "gucci-ophidia",
    label: "Gucci · Ophidia",
    maison: "Gucci",
    lora: { file: "ophidia_mini.safetensors", strength: 0.85, base: "Qwen-Image 2.1" },
    tags: [
      {
        token: "gg_supreme_canvas",
        label: "Tela GG Supreme",
        category: "fabric",
        fieldKeys: ["fabric", "surface_texture"],
        loraNote: "Il LoRA è addestrato sulla trama diagonale beige/ebony: il token ancora la ripetizione del monogramma invece di un canvas generico.",
        promptSnippet: "gg_supreme_canvas, beige and ebony woven GG monogram",
      },
      {
        token: "ophidia_leather_piping",
        label: "Bordatura in pelle",
        category: "texture",
        fieldKeys: ["surface_texture", "stitching", "leather_trim"],
        loraNote: "Attiva il bordo in pelle liscia e il piping continuo lungo il profilo della borsa.",
        promptSnippet: "ophidia_leather_piping, brown leather outline piping",
      },
      {
        token: "double_g_gold",
        label: "Double G oro",
        category: "hardware",
        fieldKeys: ["hardware_finish", "double_g", "trim_size"],
        loraNote: "Fissa dimensione e posizione del logo: una sola placca GG centrata sulla fascia superiore, non un hardware generico.",
        promptSnippet: "double_g_gold, one small interlocking GG plaque, about 2 cm",
      },
      {
        token: "ophidia_chain_18cm",
        label: "Catena corta",
        category: "hardware",
        fieldKeys: ["chain", "fit_notes", "hardware_finish"],
        loraNote: "Il fine-tuning distingue la catena Ophidia (maglie sottili, drop corto) da tracolle o manici piatti.",
        promptSnippet: "ophidia_chain_18cm, fine gold chain, 18 cm drop, hand carry only",
      },
      {
        token: "cognac_ebony_palette",
        label: "Palette cognac/ebony",
        category: "colour",
        fieldKeys: ["colour", "colour_hex"],
        loraNote: "Allinea i toni pelle e canvas alle campionature del dataset Ophidia, riducendo drift verso nero puro o cuoio arancio.",
        promptSnippet: "cognac_ebony_palette, #C4B7A6 canvas, #8A6A4F leather, #C6A15B gold",
      },
      {
        token: "matte_canvas_weave",
        label: "Tessuto opaco",
        category: "finish",
        fieldKeys: ["surface_texture", "fabric_weight"],
        loraNote: "Mantiene la superficie canvas opaca e leggermente granulosa, senza lucido da pelle verniciata.",
        promptSnippet: "matte_canvas_weave, matte woven surface, no patent shine",
      },
    ],
  },
  {
    id: "aurenzi-milano",
    label: "Aurenzi Milano",
    maison: "Aurenzi Milano",
    lora: { file: "aurenzi_cabas_cognac.safetensors", strength: 0.75, base: "Qwen-Image 2.1" },
    tags: [
      {
        token: "aurenzi_cognac_leather",
        label: "Pelle cognac",
        category: "fabric",
        fieldKeys: ["fabric", "colour", "colour_hex"],
        loraNote: "Il LoRA del cabas demo fissa il cognac caldo della pelle liscia, distinto dal marrone Gucci o dal nero.",
        promptSnippet: "aurenzi_cognac_leather, smooth cognac calfskin, warm mid-brown",
      },
      {
        token: "flat_handle_stitch",
        label: "Manici piatti cuciti",
        category: "texture",
        fieldKeys: ["surface_texture", "stitching"],
        loraNote: "Recupera la cucitura a vista sui manici piatti e sul giro borsa del capo demo.",
        promptSnippet: "flat_handle_stitch, visible saddle stitch on flat handles",
      },
      {
        token: "brass_turnlock",
        label: "Chiusura ottone",
        category: "hardware",
        fieldKeys: ["hardware_finish", "closure", "trim_size"],
        loraNote: "Il peso ottone spazzolato e la forma del turnlock sono nel dataset di addestramento.",
        promptSnippet: "brass_turnlock, brushed brass turnlock, about 3 cm",
      },
      {
        token: "cabas_flat_bottom",
        label: "Fondo piano",
        category: "texture",
        fieldKeys: ["silhouette", "back"],
        loraNote: "Mantiene il fondo rettilineo del cabas invece di una base arrotondata da borsa morbida.",
        promptSnippet: "cabas_flat_bottom, structured flat base, upright tote silhouette",
      },
      {
        token: "cognac_warm_hex",
        label: "Hex cognac",
        category: "colour",
        fieldKeys: ["colour_hex"],
        loraNote: "Allinea il campionamento colore al LUT usato nel viewer 3D del progetto qwen-loro.",
        promptSnippet: "cognac_warm_hex, #9A5C38 leather, #7A4A2E shadow",
      },
    ],
  },
  {
    id: "bottega-intreccio",
    label: "Bottega · Intreccio",
    maison: "Bottega Veneta",
    lora: { file: "intreccio_nappa.safetensors", strength: 0.8, base: "Qwen-Image 2.1" },
    tags: [
      {
        token: "intreccio_nappa",
        label: "Nappa intrecciata",
        category: "fabric",
        fieldKeys: ["fabric", "surface_texture"],
        loraNote: "Il LoRA codifica il motivo a treccia continuo; senza token tende a pelle liscia generica.",
        promptSnippet: "intreccio_nappa, woven nappa leather, tight basket weave",
      },
      {
        token: "no_visible_logo",
        label: "Senza logo",
        category: "finish",
        fieldKeys: ["hardware_finish", "no_extra_parts"],
        loraNote: "Negative space training: il modello fine-tuned evita hardware logato quando questo token è presente.",
        promptSnippet: "no_visible_logo, no metal logo, no printed text",
      },
      {
        token: "soft_nappa_sheen",
        label: "Lucido nappa",
        category: "finish",
        fieldKeys: ["surface_texture", "fabric_weight"],
        loraNote: "Controlla il micro-lucido della nappa intrecciata, non plastica.",
        promptSnippet: "soft_nappa_sheen, soft leather sheen, pliable folds",
      },
      {
        token: "intreccio_ivory",
        label: "Avorio intreccio",
        category: "colour",
        fieldKeys: ["colour", "colour_hex"],
        loraNote: "Palette avorio/panna del dataset intreccio, separata dal bianco ottico.",
        promptSnippet: "intreccio_ivory, warm ivory nappa, #F2EBE0",
      },
    ],
  },
]

export function brandProfile(id: string): BrandLoraProfile {
  const b = BRAND_LORA_PROFILES.find((x) => x.id === id)
  if (!b) throw new Error(`brand LoRA sconosciuto: ${id}`)
  return b
}

export const BRAND_LORA_IDS = BRAND_LORA_PROFILES.map((b) => b.id)
