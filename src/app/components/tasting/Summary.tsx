'use client';

import { semanticSimilarity } from '@/actions/similarity';
import { tastingAtom, wineAtom } from '@/app/store/tasting';
import type { Wine } from '@/lib/types';
import { useAtomValue } from 'jotai';
import type React from 'react';
import { useEffect, useState } from 'react';
import styles from './summary-1.module.css';

function calculateNumericSimilarity(
  userValue: string | number | undefined,
  actualValue: string | number | undefined,
  userScale = 10,
  expertScale = 12
): number {
  const normalizeNumber = (val: string | number | undefined): number => {
    if (val === undefined || val === null || val === '' || val === '-') return Number.NaN;
    const str = String(val);
    const cleaned = str.replace(/[^\d.,]/g, '').replace('prosent', '');
    return Number.parseFloat(cleaned.replace(',', '.'));
  };

  const userNum = normalizeNumber(userValue);
  const actualNum = normalizeNumber(actualValue);

  // If either value is invalid, return 0
  if (isNaN(userNum) || isNaN(actualNum)) return 0;

  // Normalize both values to percentage (0-1 scale)
  const userNormalized = userNum / userScale;
  const expertNormalized = actualNum / expertScale;

  // Calculate difference on normalized scale
  const difference = Math.abs(userNormalized - expertNormalized);

  // Convert to 0-100 score (closer = higher score)
  // Max difference is 1.0, so multiply by 100 to get percentage
  return Math.max(0, Math.round((1 - difference) * 100));
}

function calculateDirectSimilarity(
  userValue: string | number | undefined,
  actualValue: string | number | undefined
): number {
  const normalizeNumber = (val: string | number | undefined): number => {
    if (val === undefined || val === null || val === '' || val === '-') return Number.NaN;
    const str = String(val);
    const cleaned = str.replace(/[^\d.,]/g, '').replace('prosent', '');
    return Number.parseFloat(cleaned.replace(',', '.'));
  };

  const userNum = normalizeNumber(userValue);
  const actualNum = normalizeNumber(actualValue);

  if (isNaN(userNum) || isNaN(actualNum)) return 0;
  if (userNum === 0 && actualNum === 0) return 100;

  const maxVal = Math.max(Math.abs(userNum), Math.abs(actualNum));
  if (maxVal === 0) return 100;

  const difference = Math.abs(userNum - actualNum);
  const percentDifference = (difference / maxVal) * 100;

  return Math.max(0, Math.round(100 - Math.min(percentDifference, 100)));
}

export const Summary: React.FC = () => {
  const tastingState = useAtomValue(tastingAtom);
  const wine = useAtomValue<Wine>(wineAtom);

  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [scores, setScores] = useState(initState());
  const [overallScore, setOverallScore] = useState(0);
  const [isCalculating, setIsCalculating] = useState(true);

  const isRedWine = wine?.main_category?.code === 'rødvin';

  const vmpFylde = wine?.content?.characteristics?.find(x => x.name.toLowerCase() === 'fylde')?.value;
  const vmpFriskhet = wine?.content?.characteristics?.find(x => x.name.toLowerCase() === 'friskhet')?.value;
  const vmpSnærp = wine?.content?.characteristics?.find(x => x.name.toLowerCase() === 'garvestoffer')?.value;
  const vmpSødme = wine?.content?.characteristics?.find(x => x.name.toLowerCase() === 'sødme')?.value;

  useEffect(() => {
    async function calculateScores() {
      setIsCalculating(true);
      try {
        // Calculate color score
        const colorScore =
          tastingState.farge.length > 0 && wine?.color && wine.color.length > 0
            ? await semanticSimilarity(tastingState.farge, wine.color!)
            : 0;

        // Calculate smell score
        const userSmellText = `${tastingState.selectedFlavorsLukt.map(x => x.flavor.name).join(', ')} ${
          tastingState.lukt
        }`;
        const smellScore = wine?.smell ? await semanticSimilarity(userSmellText, wine.smell!) : 0;

        // Calculate taste score
        const userTasteText = `${tastingState.selectedFlavorsSmak.map(x => x.flavor.name).join(', ')} ${
          tastingState.smak
        }`;
        const tasteScore = wine?.taste ? await semanticSimilarity(userTasteText, wine.taste!) : 0;

        const prosentScore = calculateDirectSimilarity(
          tastingState.alkohol,
          wine?.content?.traits?.[0]?.readableValue || '0'
        );

        const priceScore = calculateDirectSimilarity(tastingState.pris?.toString(), wine?.price?.value?.toString());

        const snærpScore = vmpSnærp ? calculateNumericSimilarity(tastingState.snaerp, vmpSnærp, 10, 12) : 0;
        const sødmeScore = vmpSødme ? calculateNumericSimilarity(tastingState.sodme, vmpSødme, 10, 12) : 0;
        const fyldeScore = vmpFylde ? calculateNumericSimilarity(tastingState.fylde, vmpFylde, 10, 12) : 0;
        const friskhetScore = vmpFriskhet ? calculateNumericSimilarity(tastingState.friskhet, vmpFriskhet, 10, 12) : 0;

        const newScores = {
          farge: colorScore,
          lukt: smellScore,
          smak: tasteScore,
          friskhet: friskhetScore,
          fylde: fyldeScore,
          snaerp: snærpScore,
          sodme: sødmeScore,
          alkoholProsent: prosentScore,
          pris: priceScore
        };

        setScores(newScores);

        const halfWeightProps = ['pris', 'alkoholProsent'];
        const scoreEntries = Object.entries(newScores).filter(([key, value]) => {
          // Skip characteristics that don't have expert data
          if (key === 'friskhet' && !vmpFriskhet) return false;
          if (key === 'fylde' && !vmpFylde) return false;
          if (key === 'snaerp' && !vmpSnærp) return false;
          if (key === 'sodme' && !vmpSødme) return false;
          return true;
        });

        const { total, weightSum } = scoreEntries.reduce(
          (acc, [key, value]) => {
            const weight = halfWeightProps.includes(key) ? 0.2 : 1;
            return {
              total: acc.total + value * weight,
              weightSum: acc.weightSum + weight
            };
          },
          { total: 0, weightSum: 0 }
        );

        const averageScore = weightSum > 0 ? Math.round(total / weightSum) : 0;

        setOverallScore(averageScore);
      } catch (error) {
        console.log(JSON.stringify(error));
        setScores(initState());
        setOverallScore(0);
      } finally {
        setIsCalculating(false);
      }
    }

    calculateScores();
  }, [
    tastingState.farge,
    tastingState.alkohol,
    tastingState.selectedFlavorsLukt,
    tastingState.lukt,
    tastingState.selectedFlavorsSmak,
    tastingState.smak,
    tastingState.pris,
    tastingState.snaerp,
    tastingState.sodme,
    tastingState.fylde,
    tastingState.friskhet,
    wine,
    vmpSnærp,
    vmpSødme,
    vmpFylde,
    vmpFriskhet
  ]);

  const vmpLuktWords = wine?.smell?.toLowerCase().split(/[\s,]+/) || [];
  const vmpSmakWords = wine?.taste?.toLowerCase().split(/[\s,]+/) || [];

  if (isCalculating)
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Beregner din smaksscore...</p>
      </div>
    );

  return (
    <div className={styles.summaryContainer}>
      {!showComparison && (
        <>
          <div className={styles.scoreHeader}>
            <p className={styles.overallScore}>{overallScore}%</p>
            <p className={styles.scoreLabel}>Din smaksscore</p>
          </div>

          <div className={styles.summaryTable}>
            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Farge</div>
              <div className={styles.summaryValue}>{tastingState.farge}</div>
            </div>

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Lukt</div>
              <div className={styles.summaryValue}>
                <div className={styles.flavorPills}>
                  {tastingState.selectedFlavorsLukt.map((x, i) => (
                    <span
                      key={i}
                      className={styles.flavorPill}>
                      {x.flavor.name}
                    </span>
                  ))}
                </div>
                {tastingState.lukt && <p className={styles.commentText}>{tastingState.lukt}</p>}
              </div>
            </div>

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Smak</div>
              <div className={styles.summaryValue}>
                <div className={styles.flavorPills}>
                  {tastingState.selectedFlavorsSmak.map((x, i) => (
                    <span
                      key={i}
                      className={styles.flavorPill}>
                      {x.flavor.name}
                    </span>
                  ))}
                </div>
                {tastingState.smak && <p className={styles.commentText}>{tastingState.smak}</p>}
              </div>
            </div>

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Friskhet</div>
              <div className={styles.summaryValue}>{tastingState.friskhet}</div>
            </div>

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Fylde</div>
              <div className={styles.summaryValue}>{tastingState.fylde}</div>
            </div>

            {isRedWine && (
              <div className={styles.summaryRow}>
                <div className={styles.summaryLabel}>Snærp</div>
                <div className={styles.summaryValue}>{tastingState.snaerp || '-'}</div>
              </div>
            )}

            {!isRedWine && (
              <div className={styles.summaryRow}>
                <div className={styles.summaryLabel}>Sødme</div>
                <div className={styles.summaryValue}>{tastingState.sodme || '-'}</div>
              </div>
            )}

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Karakter</div>
              <div className={styles.summaryValue}>{tastingState.karakter}</div>
            </div>

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Alkohol</div>
              <div className={styles.summaryValue}>{tastingState.alkohol}%</div>
            </div>

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Pris</div>
              <div className={styles.summaryValue}>{tastingState.pris} kr</div>
            </div>

            {tastingState.egenskaper && (
              <div className={styles.summaryRow}>
                <div className={styles.summaryLabel}>Kommentar</div>
                <div className={styles.summaryValue}>{tastingState.egenskaper}</div>
              </div>
            )}
          </div>

          <div className={styles.comparisonToggle}>
            <button
              className={styles.revealButton}
              onClick={() => setShowComparison(true)}>
              Sammenlign med eksperten
            </button>
          </div>
        </>
      )}
      {showComparison && (
        <>
          <div className={styles.scoreHeader}>
            <p className={styles.overallScore}>{overallScore}%</p>
            <p className={styles.scoreLabel}>Din smaksscore</p>
          </div>

          <div className={styles.comparisonTable}>
            <div className={styles.tableHeader}>
              <div></div>
              <div>Min score</div>
              <div>Eksperten</div>
              <div></div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Farge</div>
              <div className={styles.attributeValue}>{tastingState.farge}</div>
              <div className={styles.attributeValue}>{wine!.color}</div>
              <div className={styles.scoreValue}>{scores.farge}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Lukt</div>
              <div className={styles.attributeValue}>
                <div className={styles.flavorPills}>
                  {tastingState.selectedFlavorsLukt.map((x, i) => (
                    <span
                      key={i}
                      className={styles.flavorPill}>
                      {x.flavor.name}
                    </span>
                  ))}
                </div>
                {tastingState.lukt}
              </div>
              <div className={styles.attributeValue}>{wine!.smell}</div>
              <div className={styles.scoreValue}>{scores.lukt}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Smak</div>
              <div className={styles.attributeValue}>
                <div className={styles.flavorPills}>
                  {tastingState.selectedFlavorsSmak.map((x, i) => (
                    <span
                      key={i}
                      className={styles.flavorPill}>
                      {x.flavor.name}
                    </span>
                  ))}
                </div>
                {tastingState.smak}
              </div>
              <div className={styles.attributeValue}>{wine!.taste}</div>
              <div className={styles.scoreValue}>{scores.smak}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Friskhet</div>
              <div className={styles.attributeValue}>{tastingState.friskhet}</div>
              <div className={styles.attributeValue}>{vmpFriskhet || 'Ikke tilgjengelig'}</div>
              <div className={styles.scoreValue}>{vmpFriskhet ? `${scores.friskhet}%` : '-'}</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Fylde</div>
              <div className={styles.attributeValue}>{tastingState.fylde}</div>
              <div className={styles.attributeValue}>{vmpFylde || 'Ikke tilgjengelig'}</div>
              <div className={styles.scoreValue}>{vmpFylde ? `${scores.fylde}%` : '-'}</div>
            </div>

            {isRedWine && (
              <div className={styles.tableRow}>
                <div className={styles.attributeName}>Snærp</div>
                <div className={styles.attributeValue}>{tastingState.snaerp || '-'}</div>
                <div className={styles.attributeValue}>{vmpSnærp || 'Ikke tilgjengelig'}</div>
                <div className={styles.scoreValue}>{vmpSnærp ? `${scores.snaerp}%` : '-'}</div>
              </div>
            )}

            {!isRedWine && (
              <div className={styles.tableRow}>
                <div className={styles.attributeName}>Sødme</div>
                <div className={styles.attributeValue}>{tastingState.sodme || '-'}</div>
                <div className={styles.attributeValue}>{vmpSødme || 'Ikke tilgjengelig'}</div>
                <div className={styles.scoreValue}>{vmpSødme ? `${scores.sodme}%` : '-'}</div>
              </div>
            )}

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Karakter</div>
              <div className={styles.attributeValue}>{tastingState.karakter}</div>
              <div className={styles.attributeValue}>-</div>
              <div className={styles.scoreValue}>-</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Alkohol</div>
              <div className={styles.attributeValue}>{tastingState.alkohol}%</div>
              <div className={styles.attributeValue}>{wine?.content?.traits?.[0]?.readableValue}</div>
              <div className={styles.scoreValue}>{scores.alkoholProsent}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Pris</div>
              <div className={styles.attributeValue}>{tastingState.pris} kr</div>
              <div className={styles.attributeValue}>{wine?.price?.value} kr</div>
              <div className={styles.scoreValue}>{scores.pris}%</div>
            </div>
          </div>

          <div className={styles.comparisonToggle}>
            <button
              className={styles.reviewButton}
              onClick={() => setShowComparison(false)}>
              Gjennomgå notatene mine
            </button>
          </div>
        </>
      )}
    </div>
  );
};

function initState() {
  return {
    farge: 0,
    lukt: 0,
    smak: 0,
    friskhet: 0,
    fylde: 0,
    snaerp: 0,
    sodme: 0,
    alkoholProsent: 0,
    pris: 0
  };
}
