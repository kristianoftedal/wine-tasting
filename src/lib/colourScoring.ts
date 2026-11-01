/**
 * Colour scoring without a model.
 *
 * Until scorer v8 the colour score was the cosine of two OpenAI sentence
 * embeddings of the colour phrases, the last API call in a tasting. The
 * colour vocabulary does not need one: across 54 863 catalogue colour notes
 * there are 516 distinct words, and nearly every phrase is a depth word
 * (lys, middels, dyp, mørk, blek) plus a hue word on a line that runs
 *
 *   grønn → grønngul → strågul/gul → gyllen → rav/oransje → rosa → rød → blårød/lilla
 *
 * with tints (grønnskjær, blåskjær, brunskjær) as modifiers. A taster's
 * "lys rubinrød" against the catalogue's "Dyp rubinrød." is the same hue one
 * depth step away, and that is what the score should say. Brown and brick
 * (mursteinsrød, rødbrun) sit beside red as an ageing tint rather than a
 * hue step toward purple, which is the one place the line is not a line.
 *
 * Score = 100 × (0.75 · hue similarity + 0.25 · depth similarity), where hue
 * similarity falls to 0 three hue steps apart (a yellow against a red) and a
 * missing depth word on either side counts as no evidence, not a mismatch.
 * Measured against the stored OpenAI colour scores on 129 tastings
 * (scripts/measure-colour.ts, colour-lexicon-2026-11-01.md): Spearman 0.50,
 * and the disagreements are the embedding's — it gave "Korngul" against
 * "Lys strågul" 21, "Lilla" against "Dyp blårød" 27, and an exact "Dyp rød"
 * 93. So the level is deliberately not fitted onto those scores; an exact
 * match is 100 here. Colour carries 0.2 of the overall weight, and the mean
 * colour score rises from 57 to 83, which moves a typical total by about
 * one point.
 */

/** Hue position 0–7 per surface form; compounds are listed explicitly. */
const HUE: Record<string, number> = {
  // green → yellow
  grønn: 0, grønne: 0, grønt: 0, grønnlig: 0.3,
  grønngul: 1, gulgrønn: 1, grønngyllen: 1.5, lysegrønn: 0.5,
  sitrongul: 1.7, strågul: 2, strå: 2, blekgul: 2, lysegul: 2, lysgul: 2, gul: 2, korngul: 2, halmgul: 2, hvit: 2, hvitvin: 2,
  gyllengul: 2.7, gyllen: 3, gylne: 3, gull: 3, gullgul: 3, gulloransje: 3.3,
  ravgul: 3.5, rav: 3.5, guloransje: 3.6, oransjegul: 3.6, kobber: 3.8, oransje: 4, oransjerosa: 4.4, kobberrosa: 4.4,
  // rosé
  lakserosa: 4.6, laks: 4.6, laksrosa: 4.6, rosa: 5, rosé: 5, rose: 5, rødrosa: 5.3, rosarød: 5.3, lyserød: 5.5, lysrød: 5.5,
  // red
  rød: 6, rødvin: 6, rødlig: 6, kirsebærrød: 6, kirsebær: 6, rubinrød: 6, rubin: 6, jordbærrød: 5.8, dyprød: 6, mørkerød: 6.1, mørkrød: 6.1,
  granatrød: 6.2, burgunderrød: 6.2, burgundrød: 6.2, pinot: 6,
  // red toward purple / blue
  blårød: 6.6, rødblå: 6.6, blålig: 6.8, blå: 7, rødlilla: 6.8, lillarød: 6.8, rødfiolett: 6.8, purpur: 6.8, purpurrød: 6.8,
  lilla: 7, fiolett: 7, fiolette: 7, blålilla: 7, lillatoner: 7,
  // ageing tints: brick and brown sit beside red
  mursteinsrød: 6.3, teglrød: 6.3, brunrød: 6.3, rødbrun: 6.4, brun: 6.5, brunlig: 6.5,
};

const DEPTH: Record<string, number> = {
  blek: 0, lys: 0, lyse: 0, lett: 0, svak: 0, svakt: 0, transparent: 0, ultra: 0,
  middels: 1, medium: 1, klar: 1, ren: 1,
  dyp: 2, intens: 2, tett: 2, mørk: 2, mørke: 2, ugjennomsiktig: 2, kraftig: 2,
};

/** Tints, scored as a small agreement bonus or disagreement penalty. */
const TINT: Record<string, string> = {
  grønnskjær: 'grønn', grønt: 'grønn', grønne: 'grønn', grønnlig: 'grønn',
  blåskjær: 'blå', blålig: 'blå', lillaskjær: 'lilla', lillatoner: 'lilla', fiolette: 'lilla',
  brunskjær: 'brun', brunlig: 'brun', brun: 'brun', oransje: 'oransje', rosaskjær: 'rosa',
};

export type ParsedColour = { hue: number | null; depth: number | null; tints: Set<string>; words: string[] };

export function parseColour(text: string): ParsedColour {
  const words = (text ?? '')
    .toLowerCase()
    .replace(/[.,;:!?()"'«»]/g, ' ')
    .split(/[\s/\-]+/)
    .filter(Boolean);
  const hues: number[] = [];
  let depth: number | null = null;
  const tints = new Set<string>();
  const TINT_MARKERS = new Set(['skjær', 'skjæret', 'kant', 'toner', 'reflekser', 'refleksjoner', 'nyanser', 'hint']);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // "fiolett skjær", "grønn kant": a hue word before a tint marker is a tint, not a second hue.
    if (HUE[w] !== undefined && TINT_MARKERS.has(words[i + 1] ?? '')) { tints.add(TINT[w] ?? w); continue; }
    if (HUE[w] !== undefined) hues.push(HUE[w]);
    else {
      // "mørkerød", "lysegul" style compounds not listed: split a known depth prefix off a known hue.
      for (const d of Object.keys(DEPTH)) if (w.startsWith(d) && HUE[w.slice(d.length)] !== undefined) { depth = depth ?? DEPTH[d]; hues.push(HUE[w.slice(d.length)]); break; }
    }
    if (DEPTH[w] !== undefined) depth = depth === null ? DEPTH[w] : (depth + DEPTH[w]) / 2;
    if (TINT[w]) tints.add(TINT[w]);
  }
  return { hue: hues.length ? hues.reduce((a, b) => a + b, 0) / hues.length : null, depth, tints, words };
}

/** 0–100 colour agreement, or null when neither phrase names a hue. */
export function colourSimilarity(user: string, reference: string): number | null {
  const u = parseColour(user), r = parseColour(reference);
  if (u.hue === null && r.hue === null) return null;
  if (u.hue === null || r.hue === null) {
    // One side has no hue word; depth alone is weak evidence.
    if (u.depth !== null && r.depth !== null) return Math.round(25 * (1 - Math.abs(u.depth - r.depth) / 2));
    return 0;
  }
  const hueSim = Math.max(0, 1 - Math.abs(u.hue - r.hue) / 3);
  const depthSim = u.depth === null || r.depth === null ? 1 : 1 - Math.abs(u.depth - r.depth) / 2;
  let tint = 0;
  for (const t of u.tints) tint += r.tints.has(t) ? 0.05 : -0.05;
  const raw = Math.max(0, Math.min(1, 0.75 * hueSim + 0.25 * depthSim + tint));
  return Math.round(raw * 100);
}
