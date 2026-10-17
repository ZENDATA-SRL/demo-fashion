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
  /** a second LoRA trained on another product family of the same brand, e.g. its knitwear */
  extraLoras?: Array<{ family: string; file: string; strength: number }>
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
        label: "GG Supreme canvas",
        category: "fabric",
        fieldKeys: ["fabric", "surface_texture"],
        loraNote: "The LoRA is trained on the beige/ebony diagonal weave: the token anchors the monogram repeat instead of a generic canvas.",
        promptSnippet: "gg_supreme_canvas, beige and ebony woven GG monogram",
      },
      {
        token: "ophidia_leather_piping",
        label: "Leather piping",
        category: "texture",
        fieldKeys: ["surface_texture", "stitching", "leather_trim"],
        loraNote: "Turns on the smooth leather edge and the continuous piping along the bag outline.",
        promptSnippet: "ophidia_leather_piping, brown leather outline piping",
      },
      {
        token: "double_g_gold",
        label: "Gold Double G",
        category: "hardware",
        fieldKeys: ["hardware_finish", "double_g", "trim_size"],
        loraNote: "Fixes the logo size and position: one GG plaque centred on the top band, not generic hardware.",
        promptSnippet: "double_g_gold, one small interlocking GG plaque, about 2 cm",
      },
      {
        token: "ophidia_chain_18cm",
        label: "Short chain",
        category: "hardware",
        fieldKeys: ["chain", "fit_notes", "hardware_finish"],
        loraNote: "The fine-tune tells the Ophidia chain (fine links, short drop) apart from shoulder straps or flat handles.",
        promptSnippet: "ophidia_chain_18cm, fine gold chain, 18 cm drop, hand carry only",
      },
      {
        token: "cognac_ebony_palette",
        label: "Cognac/ebony palette",
        category: "colour",
        fieldKeys: ["colour", "colour_hex"],
        loraNote: "Aligns leather and canvas tones with the Ophidia dataset swatches, reducing drift towards pure black or orange tan.",
        promptSnippet: "cognac_ebony_palette, #C4B7A6 canvas, #8A6A4F leather, #C6A15B gold",
      },
      {
        token: "matte_canvas_weave",
        label: "Matte canvas",
        category: "finish",
        fieldKeys: ["surface_texture", "fabric_weight"],
        loraNote: "Keeps the canvas surface matte and slightly grainy, without a patent-leather shine.",
        promptSnippet: "matte_canvas_weave, matte woven surface, no patent shine",
      },
    ],
  },
  {
    id: "aurenzi-milano",
    label: "Aurenzi Milano",
    maison: "Aurenzi Milano",
    lora: { file: "aurenzi_cabas_cognac.safetensors", strength: 0.75, base: "Qwen-Image 2.1" },
    extraLoras: [{ family: "knitwear", file: "aurenzi_knit_rib.safetensors", strength: 0.7 }],
    tags: [
      {
        token: "aurenzi_cognac_leather",
        label: "Cognac leather",
        category: "fabric",
        fieldKeys: ["fabric", "colour", "colour_hex"],
        loraNote: "The demo cabas LoRA fixes the warm cognac of the smooth leather, distinct from a generic brown or black.",
        promptSnippet: "aurenzi_cognac_leather, smooth cognac calfskin, warm mid-brown",
      },
      {
        token: "flat_handle_stitch",
        label: "Stitched flat handles",
        category: "texture",
        fieldKeys: ["surface_texture", "stitching"],
        loraNote: "Brings back the visible stitching on the flat handles and around the bag body.",
        promptSnippet: "flat_handle_stitch, visible saddle stitch on flat handles",
      },
      {
        token: "brass_turnlock",
        label: "Brass closure",
        category: "hardware",
        fieldKeys: ["hardware_finish", "closure", "trim_size"],
        loraNote: "The brushed brass weight and the turnlock shape are in the training dataset.",
        promptSnippet: "brass_turnlock, brushed brass turnlock, about 3 cm",
      },
      {
        token: "cabas_flat_bottom",
        label: "Flat base",
        category: "texture",
        fieldKeys: ["silhouette", "back"],
        loraNote: "Keeps the straight cabas base instead of the rounded bottom of a soft bag.",
        promptSnippet: "cabas_flat_bottom, structured flat base, upright tote silhouette",
      },
      {
        token: "cognac_warm_hex",
        label: "Cognac hex",
        category: "colour",
        fieldKeys: ["colour_hex"],
        loraNote: "Aligns colour sampling with the LUT used by the qwen-loro 3D viewer.",
        promptSnippet: "cognac_warm_hex, #9A5C38 leather, #7A4A2E shadow",
      },
      {
        token: "aurenzi_english_rib",
        label: "English rib knit",
        category: "fabric",
        fieldKeys: ["fabric", "surface_texture", "fabric_weight"],
        loraNote: "Trained on the brand's 5-gauge knitwear: deep, even English rib instead of flat jersey or cable knit.",
        promptSnippet: "aurenzi_english_rib, chunky 5-gauge English rib, deep even ribs",
      },
      {
        token: "rib_mock_neck",
        label: "Ribbed mock neck",
        category: "texture",
        fieldKeys: ["collar", "silhouette"],
        loraNote: "Holds the stand-up ribbed mock neck, about four fingers high, never a rolled turtleneck or a crew neck.",
        promptSnippet: "rib_mock_neck, ribbed stand-up mock neck, four fingers high",
      },
      {
        token: "brass_zip_pull",
        label: "Brass zip pull",
        category: "hardware",
        fieldKeys: ["closure", "hardware_finish", "trim_size"],
        loraNote: "The brand's brass carries over from the bags to the knitwear: brushed brass zip with a flat rectangular pull.",
        promptSnippet: "brass_zip_pull, brushed brass zip, flat rectangular pull",
      },
      {
        token: "fully_fashioned_raglan",
        label: "Fully fashioned raglan",
        category: "texture",
        fieldKeys: ["sleeves", "shoulders", "stitching"],
        loraNote: "Keeps the visible decrease lines of fully fashioned raglan seams, the mark of the brand's knit construction.",
        promptSnippet: "fully_fashioned_raglan, raglan sleeves with visible fully fashioned decreases",
      },
      {
        token: "warm_neutral_yarn",
        label: "Warm neutral yarns",
        category: "colour",
        fieldKeys: ["colour", "colour_hex"],
        loraNote: "Ecru, camel and tobacco from the knit archive; avoids cold greys and optical white.",
        promptSnippet: "warm_neutral_yarn, ecru #E6DCC8, camel #B8875A, tobacco #7A5236",
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
        label: "Woven nappa",
        category: "fabric",
        fieldKeys: ["fabric", "surface_texture"],
        loraNote: "The LoRA encodes the continuous weave pattern; without the token it drifts to generic smooth leather.",
        promptSnippet: "intreccio_nappa, woven nappa leather, tight basket weave",
      },
      {
        token: "no_visible_logo",
        label: "No logo",
        category: "finish",
        fieldKeys: ["hardware_finish", "no_extra_parts"],
        loraNote: "Negative-space training: the fine-tuned model avoids logo hardware when this token is present.",
        promptSnippet: "no_visible_logo, no metal logo, no printed text",
      },
      {
        token: "soft_nappa_sheen",
        label: "Nappa sheen",
        category: "finish",
        fieldKeys: ["surface_texture", "fabric_weight"],
        loraNote: "Controls the micro-sheen of the woven nappa, never plastic.",
        promptSnippet: "soft_nappa_sheen, soft leather sheen, pliable folds",
      },
      {
        token: "intreccio_ivory",
        label: "Intreccio ivory",
        category: "colour",
        fieldKeys: ["colour", "colour_hex"],
        loraNote: "Ivory and cream palette of the intreccio dataset, kept apart from optical white.",
        promptSnippet: "intreccio_ivory, warm ivory nappa, #F2EBE0",
      },
    ],
  },
]

export function brandProfile(id: string): BrandLoraProfile {
  const b = BRAND_LORA_PROFILES.find((x) => x.id === id)
  if (!b) throw new Error(`unknown brand LoRA: ${id}`)
  return b
}

export const BRAND_LORA_IDS = BRAND_LORA_PROFILES.map((b) => b.id)
