'use client';

import { tastingAtom, wineAtom } from '@/app/store/tasting';
import { useAtomValue } from 'jotai';
import React, { useState } from 'react';
import { Wine } from '../../models/productModel';

export const Summary: React.FC = () => {
  const tastingState = useAtomValue(tastingAtom);
  const wine = useAtomValue<Wine>(wineAtom);

  const [showWine, setShowWine] = useState<boolean>(false);

  const vmpFylde = wine!.content.characteristics.find(x => x.name.toLocaleLowerCase() === 'fylde')?.value;
  const vmpFriskhet = wine!.content.characteristics.find(x => x.name.toLocaleLowerCase() === 'friskhet')?.value;
  const vmpSnærp = wine!.content.characteristics.find(x => x.name.toLocaleLowerCase() === 'garvestoffer')?.value;
  const vmpSødme = wine!.content.characteristics.find(x => x.name.toLocaleLowerCase() === 'sødme')?.value;

  return (
    <article>
      {!showWine && (
        <>
          <div className="row">
            <div className="max">
              <p>Farge: {tastingState.farge}</p>
              <p>
                Lukt: {tastingState.selectedFlavorsLukt.map(x => x.flavor.name).join(', ')}, {tastingState.lukt} |
                intensitet: {tastingState.luktIntensitet}
              </p>
              <p>
                Smak: {tastingState.selectedFlavorsSmak.map(x => x.flavor.name).join(', ')}, {tastingState.smak} |
                intensitet: {tastingState.smaksIntensitet}
              </p>
              <p>Friskhet: {tastingState.friskhet}</p>
              <p>Fylde: {tastingState.fylde}</p>
              <p>Sødme: {tastingState.sødme}</p>
              <p>Karakter: {tastingState.karakter}</p>
              <p>Alkohol: {tastingState.alkohol}</p>
              <p>Pris: {tastingState.pris}</p>
              <p>Kommentar: {tastingState.egenskaper}</p>
            </div>
          </div>
          <div className="row">
            <div className="max">
              <label className="switch">
                <input
                  type="checkbox"
                  onChange={() => setShowWine(!showWine)}
                />
                <span style={{ paddingLeft: '8px' }}> Sammenlign</span>
              </label>
            </div>
          </div>
        </>
      )}
      {showWine && (
        <>
          <div className="grid">
            <div className="s2"></div>
            <div className="s5">Deg</div>
            <div className="s5">VMP</div>
          </div>
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Farge</div>
            <div className="s5">{tastingState.farge}</div>
            <div className="s5">{wine!.color}</div>
          </div>
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Lukt</div>
            <div className="s5">{tastingState.luktIntensitet}</div>
            <div className="s5">{wine!.smell}</div>
          </div>
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Lukt</div>
            <div className="s5">{tastingState.selectedFlavorsLukt.map(x => x.flavor.name).join(', ')}</div>
            <div className="s5">{wine!.smell}</div>
          </div>
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Smak</div>
            <div className="s5">{tastingState.selectedFlavorsSmak.map(x => x.flavor.name).join(', ')}</div>
            <div className="s5">{wine!.taste}</div>
          </div>
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Friskhet</div>
            <div className="s5">{tastingState.friskhet}</div>
            <div className="s5">{vmpFriskhet}</div>
          </div>
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Fylde</div>
            <div className="s5">{tastingState.fylde}</div>
            <div className="s5">{vmpFylde}</div>
          </div>
          <hr className="tasting-hr"></hr>
          {wine!.mainCategory.code === 'rødvin' && (
            <div className="grid">
              <div className="s2">Snærp</div>
              <div className="s5">{tastingState.snærp}</div>
              <div className="s5">{vmpSnærp}</div>
            </div>
          )}
          {wine!.mainCategory.code !== 'rødvin' && (
            <div className="grid">
              <div className="s2">Sødme</div>
              <div className="s5">{tastingState.sødme}</div>
              <div className="s5">{vmpSødme}</div>
            </div>
          )}
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Alkohol</div>
            <div className="s5">{tastingState.alkohol}</div>
            <div className="s5">{wine?.content.traits[0].readableValue}</div>
          </div>
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Pris</div>
            <div className="s5">{tastingState.pris}</div>
            <div className="s5">{wine?.price.value}</div>
          </div>
        </>
      )}
    </article>
  );
};
