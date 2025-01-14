import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Accordion } from '@/app/components/flavorAccordion';
import { SelectedFlavors } from '@/app/components/selectedFlavours';
import { Category, Flavor, SelectedFlavor, Subcategory } from '@/app/models/flavorModel';
import { Wine } from '@/app/models/productModel';
import Image from 'next/image';
import wineFlavorsData from '../../data/flavor.json';
import winesData from '../../data/wines.json';
import TastingWizard from '@/app/components/tastingWizard';


interface TastingProps {
  params: Promise<{ id: string }>
}

export default async function Tasting({
  params
}: {
  TastingProps
  }) {
  const { id } = await params;
  const wine = await getWine(id);

  return (
    <TastingWizard wine={wine} />
  );
}

const getWine = async (id) => {
  const res = await fetch(`${process.env.API_URL}/api/wine/${id}`);
  const data = await res.json();
  const model = data;
  return model;
};