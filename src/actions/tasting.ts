'use server';
import { connectDB } from '@/lib/mongoose';
import { TastingModel } from '../app/models/tastingModel';
import Tasting from '../db-schemas/Tasting';

export const addTasting = async (tastingModel: TastingModel) => {
  try {
    await connectDB();
    const tasting = new Tasting({ ...tastingModel });
    await tasting.save();
  } catch (e) {
    console.log(e);
  }
};
