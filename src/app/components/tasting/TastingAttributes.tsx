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

  const numbers = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <div className="grid">
      {attributes.map(attr => (
        <div
          className="l12 s12"
          key={attr}>
          <div className="center middle-align row">{attr}</div>
          <div className="center middle-align row">{getTastingAttribute(attr)}</div>
          <div className="center middle-align row">
            <nav className="no-space">
              <button
                style={{ padding: 0, minInlineSize: '1.95rem' }}
                className={`border left-round small ${getTastingAttribute(attr) === 1 ? 'fill' : ''}`}
                onClick={() => handleChange(attr, 1)}>
                <span>1</span>
              </button>
              {numbers
                .filter(x => attr !== 'karakter' || (attr === 'karakter' && x < 6))
                .map((x, i) => (
                  <button
                    key={i}
                    style={{ padding: 0, minInlineSize: '1.95rem' }}
                    className={`border no-round small ${getTastingAttribute(attr) === x ? 'fill' : ''}`}
                    onClick={() => handleChange(attr, x)}>
                    {x}
                  </button>
                ))}
              <button
                style={{ padding: 0, minInlineSize: '1.95rem' }}
                className={`border right-round small ${getTastingAttribute(attr) === (attr === 'karakter' ? 6 : 12) ? 'fill' : ''}`}
                onClick={() => handleChange(attr, attr === 'karakter' ? 6 : 12)}>
                <span>{attr === 'karakter' ? 6 : 12}</span>
              </button>
            </nav>
          </div>
          <hr style={{ marginTop: '1rem' }} />
        </div>
      ))}
      <div className="l12 s12">
        <div className="field border">
          <input
            type="text"
            value={tastingState.alkohol ?? ''}
            onChange={event => setTastingState((prev: TastingModel) => ({ ...prev, alkohol: event.target.value }))}
          />
          <span className="helper">Alkohol</span>
        </div>
        <div className="field border">
          <input
            type="text"
            value={tastingState.pris ?? ''}
            onChange={event => setTastingState((prev: TastingModel) => ({ ...prev, pris: event.target.value }))}
          />
          <span className="helper">Pris</span>
        </div>
      </div>
    </div>
  );
};
