/**
 * Skill across tastings, read from the my_taster_skill() RPC
 * (scripts/026-taster-skill.sql). Positive means the taster scores above
 * others on the same wines; the shrinkage (k = 5) keeps a lucky first night
 * from reading as talent.
 *
 * Shown only from MIN_TASTINGS under one scorer version: measured on the live
 * data (28 Oct 2026) five tasters qualify, and on a hard wine the residual is
 * what separates a taster from the note they were graded against.
 */
export type TasterSkill = {
  scorer_version: string;
  tastings: number;
  fields: number;
  raw_residual: number;
  skill: number;
};

export const MIN_TASTINGS = 10;

export function displayableSkill(rows: TasterSkill[] | null | undefined): TasterSkill | null {
  if (!rows?.length) return null;
  const eligible = rows.filter(r => r.tastings >= MIN_TASTINGS).sort((a, b) => b.tastings - a.tastings);
  return eligible[0] ?? null;
}

export function formatSkill(skill: number): string {
  const rounded = Math.round(skill * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}`;
}
