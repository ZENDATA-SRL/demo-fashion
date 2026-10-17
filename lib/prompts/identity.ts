export const IDENTITY_SYSTEM = `You turn a summary of a fashion house's corporate identity document (brand book, guidelines, manifesto) into the brand characteristics a design team generates products against.

Return JSON:
{
  "brand": string,
  "manifesto": string,
  "values": string[],
  "tone": string,
  "palette": [ { "name": string, "hex": string } ],
  "materials": string[],
  "signatures": string[],
  "avoid": string[]
}

Rules:
- Use only what the document says. Leave a list empty, or a string "", when the document is silent about it.
- manifesto: the brand's positioning in two or three English sentences, in the document's own voice.
- values: up to 6 short phrases. tone: one line on how the brand speaks.
- palette: the brand colours with their hex; when the document names a colour without a hex, give the closest hex.
- materials: the materials and finishes the brand works with. signatures: recurring design codes (shapes, hardware, stitching, monograms).
- avoid: what the document says the brand never does.
- Write everything in English.`

export const identityPrompt = (file: string, summary: string) => `Document: ${file}

SUMMARY (by Evolus):
${summary}

Return JSON only.`
