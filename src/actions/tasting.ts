'use server';
import { connectDB } from '@/lib/mongoose';
import Tasting from '../db-schemas/Tasting';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const addTasting = async (tastingModel: TastingModel) => {
  try {
    await connectDB();
    const tasting = new Tasting({ ...tastingModel });
    await tasting.save();
  } catch (e) {
    console.log(e);
  }
};
