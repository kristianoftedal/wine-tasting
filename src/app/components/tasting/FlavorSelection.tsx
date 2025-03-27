import { Accordion } from '@/app/components/tasting/FlavorAccordion';
import { SelectedFlavors } from '@/app/components/tasting/SelectedFlavours';
import wineFlavorsData from '@/app/data/flavor.json';
import { default as redWineFlavorsData, default as whiteWineFlavorsData } from '@/app/data/red-flavor.json';
import { Category, Flavor, Subcategory } from '@/app/models/flavorModel';
import { useAtom } from 'jotai';
import React from 'react';
import { TastingModel } from '../../models/tastingModel';
import { tastingAtom } from '../../store/tasting';

interface Props {
  type?: 'lukt' | 'smak';
  vintype: 'rødvin' | 'hvitvin' | 'musserende_vin';
}

export const FlavorSelection: React.FC<Props> = ({ type = 'lukt', vintype }) => {
  const [tastingState, setTastingState] = useAtom(tastingAtom);

  let flavorData = wineFlavorsData;

  if (vintype === 'rødvin') {
    flavorData = redWineFlavorsData;
  } else if (vintype === 'hvitvin') {
    flavorData = whiteWineFlavorsData;
  }

  const handleFlavorClick = (category: Category, subcategory: Subcategory, flavor: Flavor) => {
    setTastingState((prev: TastingModel) => {
      const key = type === 'lukt' ? 'selectedFlavorsLukt' : 'selectedFlavorsSmak';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = prev[key] as any[];
      const updatedFlavors = existing.some(x => x.flavor.name === flavor.name)
        ? existing.filter(x => x.flavor.name !== flavor.name)
        : [...existing, { category, subcategory, flavor }];

      return { ...prev, [key]: updatedFlavors };
    });
  };

  return (
    <div>
      {flavorData.map(categoryItem => (
        <Accordion
          key={categoryItem.name}
          category={categoryItem}
          subcategories={categoryItem.subcategories}
          onFlavorClick={handleFlavorClick}
        />
      ))}

      <SelectedFlavors
        selectedFlavors={tastingState[type === 'lukt' ? 'selectedFlavorsLukt' : 'selectedFlavorsSmak']}
        onFlavorClick={handleFlavorClick}
      />

      <div className="field textarea border">
        <textarea
          value={tastingState[type]}
          onChange={event =>
            setTastingState((prev: TastingModel) => ({ ...prev, [type]: event.target.value }))
          }></textarea>
        <span className="helper">Kommentar</span>
      </div>
    </div>
  );
};
