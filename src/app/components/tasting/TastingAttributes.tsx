import { tastingAtom, wineAtom } from '@/app/store/tasting';
import { useAtom, useAtomValue } from 'jotai';
import React from 'react';
import { TastingModel } from '../../models/tastingModel';

export const TastingAttributes: React.FC = () => {
  const [tastingState, setTastingState] = useAtom(tastingAtom);
  const wine = useAtomValue(wineAtom);

  const handleChange = (key: string, value: number) => {
    setTastingState((prev: TastingModel) => ({ ...prev, [key]: value }));
  };

  let attributes = ['friskhet', 'fylde', 'sødme', 'snærp', 'karakter'];

  if (wine?.mainCategory.code === 'rødvin') {
    attributes = attributes.filter(x => x !== 'sødme');
  }
  if (wine?.mainCategory.code === 'hvitvin') {
    attributes = attributes.filter(x => x !== 'snærp');
  }

  const getTastingAttribute = (attribute: string) => {
    if (attribute === 'friskhet') {
      return tastingState.friskhet;
    }
    if (attribute === 'fylde') {
      return tastingState.fylde;
    }
    if (attribute === 'sødme') {
      return tastingState.sødme;
    }
    if (attribute === 'snærp') {
      return tastingState.snærp;
    }
    if (attribute === 'karakter') {
      return tastingState.karakter;
    }
  };

  return (
    <div className="grid">
      {attributes.map(attr => (
        <div
          className="l12 s12"
          key={attr}>
          <div className="center middle-align row">{attr}</div>
          <div className="row">
            <p>1</p>
            <label className="max">
              <input
                style={{ width: '100%' }}
                type="range"
                min="1"
                max={attr === 'karakter' ? 6 : 12}
                value={getTastingAttribute(attr)}
                onChange={e => handleChange(attr, parseInt(e.target.value))}
              />
            </label>
            <p>{attr === 'karakter' ? 6 : 12}</p>
          </div>
          <div className="center middle-align row">{getTastingAttribute(attr)}</div>
          <hr />
        </div>
      ))}
    </div>
  );
};
