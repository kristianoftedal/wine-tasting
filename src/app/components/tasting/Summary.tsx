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

  console.log('[v0] calculateNumericSimilarity:', { userValue, actualValue, userNum, actualNum });

  // If either value is invalid, return 0
  if (isNaN(userNum) || isNaN(actualNum)) return 0;

  // If both are 0, perfect match
  if (userNum === 0 && actualNum === 0) return 100;

  // If one is 0, use the non-zero value as the base
  const maxVal = Math.max(Math.abs(userNum), Math.abs(actualNum));
  if (maxVal === 0) return 100;

  const difference = Math.abs(userNum - actualNum);

  // Use the max value as the base for percentage calculation
  // This handles cases where one value is 0 better
  const percentDifference = (difference / maxVal) * 100;

  // Convert to 0-100 score (closer = higher score)
  // Cap at 100% difference to avoid negative scores
  return Math.max(0, Math.round(100 - Math.min(percentDifference, 100)));
}

export const Summary: React.FC = () => {
  const tastingState = useAtomValue(tastingAtom);
  const wine = useAtomValue<Wine>(wineAtom);

  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [scores, setScores] = useState(initState());
  const [overallScore, setOverallScore] = useState(0);
  const [isCalculating, setIsCalculating] = useState(true);

  const vmpFylde = wine?.content?.characteristics?.find(x => x.name.toLocaleLowerCase() === 'fylde')?.value || '0';
  const vmpFriskhet =
    wine?.content?.characteristics?.find(x => x.name.toLocaleLowerCase() === 'friskhet')?.value || '0';
  const vmpSnærp =
    wine?.content?.characteristics?.find(x => x.name.toLocaleLowerCase() === 'garvestoffer')?.value || '0';
  const vmpSødme = wine?.content?.characteristics?.find(x => x.name.toLocaleLowerCase() === 'sødme')?.value || '0';

  useEffect(() => {
    async function calculateScores() {
      setIsCalculating(true);
      debugger;
      try {
        console.log('[v0] Starting score calculation...');
        console.log('[v0] Wine data:', {
          color: wine?.color,
          smell: wine?.smell,
          taste: wine?.taste,
          price: wine?.price?.value,
          traits: wine?.content?.traits?.[0]?.readableValue
        });
        console.log('[v0] User data:', {
          farge: tastingState.farge,
          lukt: tastingState.selectedFlavorsLukt.map(x => x.flavor.name),
          smak: tastingState.selectedFlavorsSmak.map(x => x.flavor.name),
          friskhet: tastingState.friskhet,
          fylde: tastingState.fylde,
          snærp: tastingState.snaerp,
          sødme: tastingState.sodme
        });
        console.log('[v0] VMP characteristics:', { vmpFylde, vmpFriskhet, vmpSnærp, vmpSødme });

        // Calculate color score
        const colorScore =
          tastingState.farge.length > 0 && wine?.color && wine.color.length > 0
            ? await semanticSimilarity(tastingState.farge, wine.color!)
            : 0;
        console.log('[v0] Color score:', colorScore);

        // Calculate smell score
        const userSmellText = `${tastingState.selectedFlavorsLukt.map(x => x.flavor.name).join(', ')} ${
          tastingState.lukt
        }`;
        const smellScore = wine?.smell ? await semanticSimilarity(userSmellText, wine.smell!) : 0;
        console.log('[v0] Smell score:', smellScore, 'userSmell:', userSmellText, 'wineSmell:', wine?.smell);

        // Calculate taste score
        const userTasteText = `${tastingState.selectedFlavorsSmak.map(x => x.flavor.name).join(', ')} ${
          tastingState.smak
        }`;
        const tasteScore = wine?.taste ? await semanticSimilarity(userTasteText, wine.taste!) : 0;
        console.log('[v0] Taste score:', tasteScore, 'userTaste:', userTasteText, 'wineTaste:', wine?.taste);

        const prosentScore = calculateNumericSimilarity(
          tastingState.alkohol,
          wine?.content?.traits?.[0]?.readableValue || '0'
        );
        console.log('[v0] Prosent score:', prosentScore);

        const priceScore = calculateNumericSimilarity(tastingState.pris?.toString(), wine?.price?.value?.toString());
        console.log('[v0] Price score:', priceScore);

        const snærpScore = calculateNumericSimilarity(tastingState.snaerp, vmpSnærp);
        console.log('[v0] Snærp score:', snærpScore);

        const sødmeScore = calculateNumericSimilarity(tastingState.sodme, vmpSødme);
        console.log('[v0] Sødme score:', sødmeScore);

        const fyldeScore = calculateNumericSimilarity(tastingState.fylde, vmpFylde);
        console.log('[v0] Fylde score:', fyldeScore);

        const friskhetScore = calculateNumericSimilarity(tastingState.friskhet, vmpFriskhet);
        console.log('[v0] Friskhet score:', friskhetScore);

        const newScores = {
          farge: colorScore,
          lukt: smellScore,
          smak: tasteScore,
          friskhet: friskhetScore,
          fylde: fyldeScore,
          snærp: snærpScore,
          sødme: sødmeScore,
          alkoholProsent: prosentScore,
          pris: priceScore
        };

        console.log('[v0] All scores:', newScores);
        setScores(newScores);
        const halfWeightProps = ['pris', 'alkoholProsent'];

        const { total, weightSum } = Object.entries(newScores).reduce(
          (acc, [key, value]) => {
            const weight = halfWeightProps.includes(key) ? 0.2 : 1;
            return {
              total: acc.total + value * weight,
              weightSum: acc.weightSum + weight
            };
          },
          { total: 0, weightSum: 0 }
        );

        const averageScore = Math.round(total / weightSum);

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

  const vmpLuktWords = wine.smell?.toLowerCase().split(/[\s,]+/) || [];
  const vmpSmakWords = wine.taste?.toLowerCase().split(/[\s,]+/) || [];

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

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Snærp</div>
              <div className={styles.summaryValue}>{tastingState.snaerp || '-'}</div>
            </div>

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Sødme</div>
              <div className={styles.summaryValue}>{tastingState.sodme || '-'}</div>
            </div>

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
                      className={`${styles.flavorPill} ${
                        vmpLuktWords.some(
                          w => w.includes(x.flavor.name.toLowerCase()) || x.flavor.name.toLowerCase().includes(w)
                        )
                          ? styles.matched
                          : ''
                      }`}>
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
                      className={`${styles.flavorPill} ${
                        vmpSmakWords.some(
                          w => w.includes(x.flavor.name.toLowerCase()) || x.flavor.name.toLowerCase().includes(w)
                        )
                          ? styles.matched
                          : ''
                      }`}>
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
              <div className={styles.attributeValue}>{vmpFriskhet}</div>
              <div className={styles.scoreValue}>{scores.friskhet}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Fylde</div>
              <div className={styles.attributeValue}>{tastingState.fylde}</div>
              <div className={styles.attributeValue}>{vmpFylde}</div>
              <div className={styles.scoreValue}>{scores.fylde}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Snærp</div>
              <div className={styles.attributeValue}>{tastingState.snaerp || '-'}</div>
              <div className={styles.attributeValue}>{vmpSnærp || '-'}</div>
              <div className={styles.scoreValue}>{scores.snærp}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Sødme</div>
              <div className={styles.attributeValue}>{tastingState.sodme || '-'}</div>
              <div className={styles.attributeValue}>{vmpSødme || '-'}</div>
              <div className={styles.scoreValue}>{scores.sødme}%</div>
            </div>

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
    snærp: 0,
    sødme: 0,
    alkoholProsent: 0,
    pris: 0
  };
}
