'use server';
import { createClient } from '@/lib/supabase/server';
import type { TastingFormData } from '@/lib/types';

// Returns the failure instead of throwing: Next.js replaces a thrown server-action error with a
// generic message in production, and the wizard needs a reason it can show the taster. An
// expired session is reported rather than redirected, because a redirect throws away a
// tasting that is still intact in the wizard's state.
export const addTasting = async (tastingModel: TastingFormData): Promise<{ error: string | null }> => {
  const supabase = await createClient();
  if (!supabase) return { error: 'Tjenesten er ikke konfigurert riktig.' };

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Du er logget ut. Logg inn i en ny fane, og trykk Ferdig her igjen.' };
  }

  // Columns from scripts/025-scored-text.sql. If the migration has not been
  // applied yet the insert is retried without them: a tasting must never be
  // lost over bookkeeping columns.
  const scored = {
    lukt_scored: tastingModel.luktScored ?? null,
    smak_scored: tastingModel.smakScored ?? null,
    scorer_version: tastingModel.scorerVersion ?? null
  };

  const row = {
    user_id: user.id,
    wine_id: tastingModel.wineId,
    event_id: tastingModel.eventId || null,
    farge: tastingModel.farge,
    lukt: tastingModel.lukt,
    smak: tastingModel.smak,
    friskhet: tastingModel.friskhet,
    fylde: tastingModel.fylde,
    sodme: tastingModel.sodme,
    garvestoffer: tastingModel.garvestoffer,
    karakter: tastingModel.karakter,
    egenskaper: tastingModel.egenskaper,
    lukt_intensitet: tastingModel.luktIntensitet,
    smaks_intensitet: tastingModel.smaksIntensitet,
    alkohol: tastingModel.alkohol,
    pris: tastingModel.pris,
    tasted_at: tastingModel.tastedAt || new Date().toISOString(),
    color_score: tastingModel.colorScore,
    smell_score: tastingModel.smellScore,
    taste_score: tastingModel.tasteScore,
    percentage_score: tastingModel.percentageScore,
    price_score: tastingModel.priceScore,
    garvestoffer_score: tastingModel.garvestofferScore,
    sodme_score: tastingModel.sodmeScore,
    fylde_score: tastingModel.fyldeScore,
    friskhet_score: tastingModel.friskhetScore,
    overall_score: tastingModel.overallScore
  };

  let { error } = await supabase.from('tastings').insert({ ...row, ...scored });
  if (error && /scored|scorer_version|schema cache|42703/i.test(`${error.code} ${error.message}`)) {
    console.warn('tastings insert: scored-text columns missing, apply scripts/025-scored-text.sql; retrying without them');
    ({ error } = await supabase.from('tastings').insert(row));
  }

  if (error) {
    console.error('Error adding tasting:', error);
    return { error: `Smakingen ble ikke lagret (${error.message}).` };
  }

  return { error: null };
};
