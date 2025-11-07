'use client';

import { tastingAtom, wineAtom } from '@/app/store/tasting';
import { useAtomValue } from 'jotai';
import React, { useEffect, useState } from 'react';
import { semanticSimilarity } from '../../../lib/semanticSimilarity';
import { Wine } from '../../models/productModel';
import styles from './summary.module.css';

function calculateNumericSimilarity(userValue: string, actualValue: string): number {
  const userNum = Number.parseFloat(userValue.replace(/[&%]/g, '').replace(/,/g, '.'));
  const actualNum = Number.parseFloat(actualValue.replace(/[&%]/g, '').replace(/,/g, '.'));

  if (isNaN(userNum) || isNaN(actualNum)) return 0;

  const difference = Math.abs(userNum - actualNum);
  const average = (userNum + actualNum) / 2;
  const percentDifference = (difference / average) * 100;

  // Convert to 0-100 score (closer = higher score)
  return Math.max(0, Math.round(100 - percentDifference));
}

export const Summary: React.FC = () => {
  const tastingState = useAtomValue(tastingAtom);
  const wine = useAtomValue<Wine>(wineAtom);

  const [showWine, setShowWine] = useState<boolean>(false);
  const [scores, setScores] = useState(initState());
  const [overallScore, setOverallScore] = useState(0);
  const [isCalculating, setIsCalculating] = useState(true);

  const vmpFylde = wine!.content.characteristics.find(x => x.name.toLocaleLowerCase() === 'fylde')?.value;
  const vmpFriskhet = wine!.content.characteristics.find(x => x.name.toLocaleLowerCase() === 'friskhet')?.value;
  const vmpSnærp = wine!.content.characteristics.find(x => x.name.toLocaleLowerCase() === 'garvestoffer')?.value;
  const vmpSødme = wine!.content.characteristics.find(x => x.name.toLocaleLowerCase() === 'sødme')?.value;

  useEffect(() => {
    async function calculateScores() {
      debugger;
      setIsCalculating(true);

      try {
        // Calculate color score
        const colorScore =
          tastingState.farge.length > 0 && wine.color.length > 0
            ? await semanticSimilarity(tastingState.farge, wine.color!)
            : 0; // Default to 0 if sommelier has no color data

        // Calculate smell score
        const smellScore =
          tastingState.lukt.length > 0
            ? await semanticSimilarity(
                `${tastingState.selectedFlavorsLukt.map(x => x.flavor.name).join(', ')} ${tastingState.lukt}`,
                wine.smell!
              )
            : 0;

        // Calculate taste score
        const tasteScore =
          tastingState.smak.length > 0
            ? await semanticSimilarity(
                `${tastingState.selectedFlavorsSmak.map(x => x.flavor.name).join(', ')} ${tastingState.smak}`,
                wine.taste!
              )
            : 0;

        // Calculate alcohol % score (numeric comparison)
        const prosentScore = calculateNumericSimilarity(
          tastingState.alkohol,
          wine?.content.traits[0].readableValue || '0'
        );

        // Calculate price score (numeric comparison)
        const priceScore = calculateNumericSimilarity(tastingState.pris.toString()!, wine.price.value!.toString());

        const snærpScore =
          wine!.mainCategory.code === 'rødvin'
            ? calculateNumericSimilarity(tastingState.snærp.toString(), vmpSnærp.toString())
            : 0;
        const sødmeScore =
          wine!.mainCategory.code !== 'rødvin'
            ? calculateNumericSimilarity(tastingState.sødme.toString()!, vmpSødme.toString())
            : 0;
        const fyldeScore = calculateNumericSimilarity(tastingState.fylde.toString()!, vmpFylde.toString());
        const friskhetScore = calculateNumericSimilarity(tastingState.friskhet.toString()!, vmpFriskhet.toString());

        const newScores = {
          farge: colorScore,
          lukt: smellScore,
          smak: tasteScore,
          alkoholProsent: prosentScore,
          pris: priceScore,
          snærp: snærpScore,
          sødme: sødmeScore,
          fylde: fyldeScore,
          friskhet: friskhetScore
        };

        setScores(newScores);
        const halfWeightProps = ['pris', 'alkoholProsent'];

        const { total, weightSum } = Object.entries(newScores).reduce(
          (acc, [key, value]) => {
            const weight = halfWeightProps.includes(key) ? 0.5 : 1;
            return {
              total: acc.total + value * weight,
              weightSum: acc.weightSum + weight
            };
          },
          { total: 0, weightSum: 0 }
        );

        const averageScore = Math.round(total / weightSum);

        setOverallScore(averageScore);
      } catch {
        setScores(initState());
        setOverallScore(0);
      } finally {
        setIsCalculating(false);
      }
    }

    calculateScores();
  }, []); // Run once on mount

  if (isCalculating)
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Beregner din smaksscore...</p>
      </div>
    );

  return (
    <article>
      {!showWine && (
        <>
          <div className="row">
            <div className="max">
              <p>Farge: {tastingState.farge}</p>
              <p>
                Lukt: {tastingState.selectedFlavorsLukt.map(x => x.flavor.name).join(', ')}, {tastingState.lukt}
              </p>
              <p>
                Smak: {tastingState.selectedFlavorsSmak.map(x => x.flavor.name).join(', ')}, {tastingState.smak}
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
          <h5>Din score: {overallScore}</h5>
          <div className="grid">
            <div className="s2"></div>
            <div className="s4">Deg</div>
            <div className="s4">VMP</div>
            <div className="s2">Score</div>
          </div>
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Farge</div>
            <div className="s4">{tastingState.farge}</div>
            <div className="s4">{wine!.color}</div>
            <div className="s2">{scores.farge}</div>
          </div>
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Lukt</div>
            <div className="s4">
              {tastingState.selectedFlavorsLukt.map(x => x.flavor.name).join(', ')}, {tastingState.lukt}
            </div>
            <div className="s4">{wine!.smell}</div>
            <div className="s2">{scores.lukt}</div>
          </div>
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Smak</div>
            <div className="s4">
              {tastingState.selectedFlavorsSmak.map(x => x.flavor.name).join(', ')}, {tastingState.smak}
            </div>
            <div className="s4">{wine!.taste}</div>
            <div className="s2">{scores.smak}</div>
          </div>
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Friskhet</div>
            <div className="s4">{tastingState.friskhet}</div>
            <div className="s4">{vmpFriskhet}</div>
            <div className="s2">{scores.friskhet}</div>
          </div>
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Fylde</div>
            <div className="s4">{tastingState.fylde}</div>
            <div className="s4">{vmpFylde}</div>
            <div className="s2">{scores.fylde}</div>
          </div>
          <hr className="tasting-hr"></hr>
          {wine!.mainCategory.code === 'rødvin' && (
            <div className="grid">
              <div className="s2">Snærp</div>
              <div className="s4">{tastingState.snærp}</div>
              <div className="s4">{vmpSnærp}</div>
              <div className="s2">{scores.snærp}</div>
            </div>
          )}
          {wine!.mainCategory.code !== 'rødvin' && (
            <div className="grid">
              <div className="s2">Sødme</div>
              <div className="s4">{tastingState.sødme}</div>
              <div className="s4">{vmpSødme}</div>
              <div className="s2">{scores.sødme}</div>
            </div>
          )}
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Alkohol</div>
            <div className="s4">{tastingState.alkohol}</div>
            <div className="s4">{wine?.content.traits[0].readableValue}</div>
            <div className="s2">{scores.alkoholProsent}</div>
          </div>
          <hr className="tasting-hr"></hr>
          <div className="grid">
            <div className="s2">Pris</div>
            <div className="s4">{tastingState.pris}</div>
            <div className="s4">{wine?.price.value}</div>
            <div className="s2">{scores.pris}</div>
          </div>
        </>
      )}
    </article>
  );
};
function initState():
  | {
      farge: number;
      lukt: number;
      smak: number;
      friskhet: number;
      fylde: number;
      snærp: number;
      sødme: number;
      alkoholProsent: number;
      pris: number;
    }
  | (() => {
      farge: number;
      lukt: number;
      smak: number;
      friskhet: number;
      fylde: number;
      snærp: number;
      sødme: number;
      alkoholProsent: number;
      pris: number;
    }) {
  return {
    farge: 0,
    lukt: 0,
    smak: 0,
    friskhet: 0,
    fylde: 0,
    snærp: 0,
    sødme: 0,
    alkoholProsent: 0,
    pris: 0
  };
}
