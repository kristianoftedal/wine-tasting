'use client';

import { useAtom, useAtomValue } from 'jotai';
import React from 'react';
import { tastingAtom, wineAtom } from '../../store/tasting';

export const Color: React.FC = () => {
  const [tasting, setTasting] = useAtom(tastingAtom);
  const wine = useAtomValue(wineAtom);

  const onChange = (value: string) => {
    setTasting(prev => {
      return { ...prev, farge: value };
    });
  };

  return (
    <article>
      <div className="row">
        <div className="max">
          <p>Druer: {wine.content.ingredients?.map(x => x.formattedValue).join(', ')}</p>
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
