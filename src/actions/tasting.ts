'use server';
import { createClient } from '@/lib/supabase/server';
import type { TastingFormData } from '@/lib/types';
import { redirect } from 'next/navigation';

export const addTasting = async (tastingModel: TastingFormData) => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { error } = await supabase.from('tastings').insert({
    user_id: user.id,
    wine_id: tastingModel.wineId,
    event_id: tastingModel.eventId || null,
    farge: tastingModel.farge,
    lukt: tastingModel.lukt,
    smak: tastingModel.smak,
    friskhet: tastingModel.friskhet,
    fylde: tastingModel.fylde,
    sodme: tastingModel.sodme,
    snaerp: tastingModel.snaerp,
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
    snaerp_score: tastingModel.snaerpScore,
    sodme_score: tastingModel.sodmeScore,
    fylde_score: tastingModel.fyldeScore,
    friskhet_score: tastingModel.friskhetScore,
    overall_score: tastingModel.overallScore
  });

  if (error) {
    console.error('Error adding tasting:', error);
    throw new Error('Failed to add tasting');
  }
};
