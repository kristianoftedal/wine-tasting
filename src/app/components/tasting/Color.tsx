'use client';

import { useAtom, useAtomValue } from 'jotai';
import React from 'react';
import { Wine } from '../../models/productModel';
import { TastingModel } from '../../models/tastingModel';
import { tastingAtom, wineAtom } from '../../store/tasting';

export const Color: React.FC = () => {
  const [tasting, setTasting] = useAtom(tastingAtom);
  const wine = useAtomValue<Wine>(wineAtom);

  const onChange = (value: string) => {
    setTasting((prev: TastingModel) => {
      return { ...prev, farge: value };
    });
  };

  if (!wine) {
    return <p>Ingen vin valgt</p>;
  }

  return (
    <article>
      <div className="row">
        <div className="max">
          <div>
            Druer:
            {wine.content.ingredients?.map(x => <div key={x.code}>{x.formattedValue}</div>)}
          </div>
          <p>Land: {wine.mainCountry.name}</p>
          {wine.district && <p>Område: {wine.district.name}</p>}
          <p>Årgang: {wine.year}</p>
          <div className="field border">
            <input
              type="text"
              value={tasting.farge ?? ''}
              onChange={event => onChange(event.target.value)}
            />
            <span className="helper">Farge</span>
          </div>
        </div>
      </div>
    </article>
  );
};
