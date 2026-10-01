/** Who wears the garment. Existing garments omit the field and stay on the women's line. */

export type Line = "donna" | "uomo"

export function lineOf(garment: { line?: Line | null }): Line {
  return garment.line === "uomo" ? "uomo" : "donna"
}

/**
 * The shot templates are written for a woman. A men's garment reuses them with the pronouns and the noun swapped,
 * so the same reel still reads as the man in the reference image.
 */
export function voice(text: string, line: Line): string {
  if (line !== "uomo") return text
  return text
    .replace(/\bherself\b/g, "himself")
    .replace(/\bHerself\b/g, "Himself")
    .replace(/\bShe's\b/g, "He's")
    .replace(/\bshe's\b/g, "he's")
    .replace(/\bShe\b/g, "He")
    .replace(/\bshe\b/g, "he")
    .replace(/\bHer\b/g, "His")
    .replace(/\bher\b/g, "his")
    .replace(/\bwomen\b/g, "men")
    .replace(/\bWomen\b/g, "Men")
    .replace(/\bwoman\b/g, "man")
    .replace(/\bWoman\b/g, "Man")
    .replace(/very slender build, fine narrow lower legs and narrow ankles/g, "lean build")
    .replace(/very slender frame/g, "lean build")
    .replace(/, with fine narrow lower legs and narrow ankles/g, "")
    .replace(/fine narrow lower legs and narrow ankles/g, "a lean build")
    .replace(/including fine narrow lower legs/g, "as in the reference")
}
