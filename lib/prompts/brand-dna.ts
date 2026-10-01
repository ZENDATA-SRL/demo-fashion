import type { GarmentDna } from "../types"
import type { BrandLoraProfile } from "../brand-lora"

export const BRAND_DNA_SYSTEM = `You refine GARMENT DNA fields using a luxury brand's LoRA vocabulary.

The LoRA was fine-tuned on that house's materials and hardware. At inference, specific trigger tokens (snake_case) are placed next to material clauses in the image prompt; the adapter then pulls texture, colour and hardware toward the training distribution.

Return JSON:
{
  "summary": string,
  "fields": [ { "key": string, "value": string, "source": "invented" | "archive" | "note" } ],
  "appliedTags": string[]
}

Rules:
- Keep garment construction from the current DNA and designer note; only rewrite material, colour, surface, hardware and closely related keys.
- Embed the brand trigger tokens inside English field values where natural (prefix or inline), e.g. "gg_supreme_canvas, beige and ebony woven GG monogram".
- appliedTags: list every trigger token you actually used.
- summary: one English line, max 40 words, updated if materials changed materially.
- Do not invent new field keys; only keys that already exist in CURRENT DNA.
- When a key is "none", leave it unless the brand note clearly applies.`

export function brandDnaPrompt(
  input: { name: string; brief: string; maison: string },
  dna: GarmentDna,
  brand: BrandLoraProfile,
  note?: string,
): string {
  const tagBlock = brand.tags
    .map(
      (t) =>
        `- ${t.token} (${t.category}) → DNA keys: ${t.fieldKeys.join(", ")}. LoRA: ${t.loraNote} Example: "${t.promptSnippet}"`,
    )
    .join("\n")

  return `Product: ${input.name}
House on file: ${input.maison}
Designer note: "${input.brief}"

Selected brand LoRA: ${brand.label}
Weights: ${brand.lora.file} @ ${brand.lora.strength} on ${brand.lora.base}

TRIGGER TAGS (use in field values where relevant):
${tagBlock}

${note ? `OPERATOR NOTE (follow it; @token names a trigger tag the operator chose, use it without the @):
"${note}"

` : ""}CURRENT DNA summary: ${dna.summary}

CURRENT fields:
${dna.fields.map((f) => `- ${f.key}: ${f.value} [${f.source}]`).join("\n")}

Rewrite the material-related fields using the LoRA tags. Return JSON only.`
}
