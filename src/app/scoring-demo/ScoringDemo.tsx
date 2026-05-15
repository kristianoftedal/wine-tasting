'use client';

import { useState, useTransition } from 'react';
import { getScoringBreakdown, type ScoringBreakdown, type TermDetail } from '@/actions/scoring-debug';
import type { PastTasting, LemmaGroup } from './page';
import styles from './page.module.css';

const EXAMPLES = [
  {
    label: 'God match',
    user: 'Mørke bær, kirsebær og solbær. Myke tanniner og frisk syre. Lang avslutning.',
    wine: 'Mørke bær og kirsebær med innslag av solbær. Frisk og balansert med myke tanniner. Lang finish.',
  },
  {
    label: 'Delvis match',
    user: 'Solbær og litt pepper. Frisk og god struktur.',
    wine: 'Mørke bær, bjørnebær og pepper. God syre og mineralske toner. Lang avslutning med fat.',
  },
  {
    label: 'Dårlig match',
    user: 'Sitrus og blomster. Frisk og lett.',
    wine: 'Mørke bær, kirsebær og sjokolade. Fyldige tanniner og lang finish.',
  },
  {
    label: 'Sjeldne (IDF)',
    user: 'Mørke bær med tydelig laurbær og litt tjære. Balansert med god syre og lang finish.',
    wine: 'Intens mørke frukt, laurbær og tjæreaktige toner. Godt balansert med frisk syre og lang avslutning.',
  },
  // ── Synonym normalization examples ────────────────────────────────────────
  // Toggle "Synonymnorm på/av" to see the score change.
  {
    label: 'Synonym: OOV (bærete/mineralaktig)',
    user: 'Bærete med mineralaktig ettersmak. Tanninrik og balansert, lang fruktig avslutning.',
    wine: 'Bær og mineral. Rik på tannin med god frukt og lang avslutning.',
  },
  {
    label: 'Synonym: -preget former',
    user: 'Eikepreget med vaniljepreget sødme og sjokoladepreget ettersmak. Urtepreget innslag.',
    wine: 'Eik og vanilje med sjokolade. Urt og krydder i bakgrunnen.',
  },
  {
    label: 'Synonym: adjektiv-varianter',
    user: 'Fruktig og bærete nese med syrlig friskhet og mineralaktig, sitrusaktig finish.',
    wine: 'Frukt og bær med syre og mineral. Sitrus i avslutningen.',
  },
];

function scoreColor(score: number): string {
  if (score >= 70) return '#16a34a';
  if (score >= 40) return '#d97706';
  return '#dc2626';
}

function ScoreRing({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const color = scoreColor(value);
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div className={styles.ringWrap}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
        <text x="40" y="44" textAnchor="middle" fontSize="15" fontWeight="700" fill={color}>
          {value}
        </text>
      </svg>
      <span className={styles.ringLabel}>{label}</span>
      {sub && <span className={styles.ringSub}>{sub}</span>}
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className={styles.barBg}>
      <div
        className={styles.barFg}
        style={{ width: `${Math.min(value, 100)}%`, background: color, transition: 'width 0.4s ease' }}
      />
    </div>
  );
}

function ScoreCard({ title, value, description }: { title: string; value: number; description?: string }) {
  const color = scoreColor(value);
  return (
    <div className={styles.scoreCard}>
      <div className={styles.scoreCardTitle}>{title}</div>
      <div className={styles.scoreCardValue} style={{ color }}>{value}</div>
      <Bar value={value} color={color} />
      {description && <div className={styles.scoreCardDesc}>{description}</div>}
    </div>
  );
}

function TermTable({ terms, title }: { terms: TermDetail[]; title: string }) {
  if (terms.length === 0) return null;

  const matched = terms.filter(t => t.matched).length;
  const porterCount = terms.filter(t => t.foundViaPorter).length;
  const idfBoosted = terms.filter(t => t.idfMultiplier > 1.0).length;

  return (
    <div className={styles.termSection}>
      <div className={styles.termHeader}>
        <span className={styles.termTitle}>{title}</span>
        <span className={styles.accordionMeta}>
          <span className={styles.termBadge} style={{ background: '#dcfce7', color: '#16a34a' }}>{matched} treff</span>
          {idfBoosted > 0 && <span className={styles.termBadge} style={{ background: '#fef3c7', color: '#b45309' }}>{idfBoosted} IDF↑</span>}
          {porterCount > 0 && <span className={styles.termBadge} style={{ background: '#ede9fe', color: '#7c3aed' }}>{porterCount} Porter</span>}
          <span className={styles.termBadge} style={{ background: '#f3f4f6', color: '#374151' }}>{terms.length} ord</span>
        </span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Original</th>
              <th>Lemma</th>
              <th>Kategori</th>
              <th>Grunnvekt</th>
              <th>IDF ×</th>
              <th>Endelig vekt</th>
              <th>Porter</th>
              <th>Treff</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((t, i) => (
              <tr key={i} className={t.matched ? styles.rowMatch : styles.rowMiss}>
                <td className={styles.mono}>{t.original}</td>
                <td className={styles.mono}>{t.lemma}</td>
                <td>
                  <span className={styles.catBadge} data-main={t.main}>
                    {t.main === 'GENERIC' ? t.sub || 'GENERIC' : `${t.main}${t.sub ? `/${t.sub}` : ''}`}
                  </span>
                </td>
                <td className={styles.num}>{t.baseWeight.toFixed(1)}</td>
                <td className={styles.num} style={{ color: t.idfMultiplier > 1 ? '#d97706' : '#6b7280' }}>
                  {t.idfMultiplier > 1.0 ? `${t.idfMultiplier.toFixed(2)} ↑` : t.idfMultiplier.toFixed(2)}
                </td>
                <td className={styles.num} style={{ fontWeight: 600 }}>{t.finalWeight.toFixed(2)}</td>
                <td className={styles.centered}>{t.foundViaPorter ? '✓' : '—'}</td>
                <td className={styles.centered}>
                  {t.matched
                    ? <span className={styles.matchYes}>✓ Treff</span>
                    : <span className={styles.matchNo}>✗</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LemmaBrowser({ groups }: { groups: LemmaGroup[] }) {
  const [openMain, setOpenMain] = useState<string | null>(null);

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Ordbok — alle gjenkjente termer</h3>
      <div className={styles.lemmaGroups}>
        {groups.map(group => {
          const isOpen = openMain === group.main;
          return (
            <div key={group.main} className={styles.lemmaGroup}>
              <button
                className={styles.lemmaGroupBtn}
                onClick={() => setOpenMain(isOpen ? null : group.main)}
              >
                <span className={styles.catBadge} data-main={group.main}>{group.main}</span>
                <span className={styles.lemmaGroupCount}>{group.total} termer</span>
                <span className={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div className={styles.lemmaGroupContent}>
                  {group.subs.map(sub => (
                    <div key={sub.name} className={styles.lemmaSub}>
                      {sub.name && (
                        <div className={styles.lemmaSubTitle}>{sub.name}</div>
                      )}
                      <div className={styles.lemmaChips}>
                        {sub.terms.map(term => (
                          <span key={term.lemma} className={styles.lemmaChip}>{term.lemma}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TokenChips({ rawTokens, flavorTokens, terms, label }: {
  rawTokens: string[];
  flavorTokens: string[];
  terms: TermDetail[];
  label: string;
}) {
  const matchedOriginals = new Set(terms.filter(t => t.matched).map(t => t.original));
  const recognizedOriginals = new Set(terms.map(t => t.original));
  const flavorSet = new Set(flavorTokens);

  return (
    <div className={styles.tokenRow}>
      <span className={styles.tokenRowLabel}>{label}</span>
      {rawTokens.map((tok, i) => {
        const isStripped = recognizedOriginals.has(tok) && !flavorSet.has(tok);
        const cls = isStripped
          ? styles.tokenChipStripped
          : matchedOriginals.has(tok)
            ? styles.tokenChipMatched
            : recognizedOriginals.has(tok)
              ? styles.tokenChipRecognized
              : styles.tokenChipUnknown;
        return <span key={i} className={`${styles.tokenChip} ${cls}`}>{tok}</span>;
      })}
    </div>
  );
}

function Results({ data, storedScore }: { data: ScoringBreakdown; storedScore: number | null }) {
  const formulaStr = `${data.precision} × 0.35 = +${data.precisionBonus}`;
  const idfBoosted = data.userTerms.filter(t => t.idfMultiplier > 1.0 && t.matched);
  const diff = storedScore !== null ? data.currentScore - storedScore : null;
  const semanticFloor = data.blendedSemanticScore;

  return (
    <div className={styles.results}>
      {/* Main scores row */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Komponentscorer</h3>
        <div className={styles.tokenRows}>
          <TokenChips rawTokens={data.userRawTokens} flavorTokens={data.userFlavorTokens} terms={data.userTerms} label="Ditt notat" />
          <TokenChips rawTokens={data.wineRawTokens} flavorTokens={data.wineFlavorTokens} terms={data.wineTerms} label="Vinnota" />
        </div>
        <div className={styles.scoreGrid}>
          <ScoreCard title="Semantisk" value={data.semanticScore} description="OpenAI embedding cosine" />
          {data.bertScoreValue !== null && (
            <ScoreCard title="BERTScore" value={data.bertScoreValue} description="Token-nivå F1 (nærsynonymer)" />
          )}
          {data.bertScoreValue !== null && (
            <ScoreCard title="Blandet sem." value={semanticFloor} description="0.65 × sem + 0.35 × BERT (gulv)" />
          )}
          <ScoreCard title="Lemma-treff" value={data.lemmaScore} description="Vektet ordoverlapps-presisjon" />
          {data.categorySemanticScore !== null
            ? <ScoreCard title="Kat.semantikk" value={data.categorySemanticScore} description="Per-kategori embedding" />
            : <ScoreCard title="Kategori-treff" value={data.categoryScore} description="Hierarkisk kategorikreditt" />
          }
          <div className={styles.scoreCard}>
            <div className={styles.scoreCardTitle}>Presisjonsbonus</div>
            <div className={styles.scoreCardValue} style={{ color: '#8b5cf6' }}>+{data.precisionBonus.toFixed(1)}</div>
            <div className={styles.formula}>{formulaStr}</div>
            <div className={styles.scoreCardDesc}>Presisjon = {data.precision}</div>
          </div>
          <div className={styles.finalCard}>
            <ScoreRing value={data.currentScore} label="Totalscore" sub="beregnet nå" />
            <div className={styles.finalFormula}>
              {semanticFloor} + {data.precisionBonus.toFixed(1)} = {data.currentScore}
            </div>
          </div>
        </div>
      </div>

      {/* Stored vs calculated comparison — only shown when scores differ */}
      {storedScore !== null && diff !== null && diff !== 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Beregnet score vs. lagret score</h3>
          <div className={styles.compareGrid}>
            <div className={styles.compareCard}>
              <div className={styles.compareHeader}>Beregnet nå</div>
              <div className={styles.compareBody}>
                <div className={styles.compareRow}>
                  <span>Semantisk</span><strong>{data.semanticScore}</strong>
                </div>
                <div className={styles.compareRow}>
                  <span>Presisjon</span><strong>{data.precision}</strong>
                </div>
                <div className={styles.compareRow}>
                  <span>Bonus</span><strong>+{data.precisionBonus.toFixed(1)}</strong>
                </div>
                <div className={styles.compareTotal}>
                  <span>Totalt</span>
                  <strong style={{ color: scoreColor(data.currentScore) }}>{data.currentScore}</strong>
                </div>
              </div>
            </div>
            <div className={styles.compareDivider}>
              <div className={styles.diffBadge} style={{
                background: diff >= 0 ? '#dcfce7' : '#fee2e2',
                color: diff >= 0 ? '#16a34a' : '#dc2626',
              }}>
                {diff >= 0 ? '+' : ''}{diff}
              </div>
            </div>
            <div className={styles.compareCard} style={{ opacity: 0.85 }}>
              <div className={styles.compareHeader}>Lagret fra smakingen</div>
              <div className={styles.compareBody}>
                <div className={styles.compareTotal} style={{ marginTop: 0, paddingTop: 0, border: 'none' }}>
                  <span>Score</span>
                  <strong style={{ color: scoreColor(storedScore) }}>{storedScore}</strong>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.compareNote}>
            Differansen viser effekten av algoritmeendringer siden smakingen ble registrert
          </div>
        </div>
      )}

      {/* IDF highlights */}
      {idfBoosted.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>IDF-boost (sjeldne deskriptorer som traff)</h3>
          <div className={styles.idfGrid}>
            {idfBoosted.map((t, i) => (
              <div key={i} className={styles.idfCard}>
                <div className={styles.idfLemma}>{t.lemma}</div>
                <div className={styles.idfMult}>×{t.idfMultiplier.toFixed(2)}</div>
                <div className={styles.idfDetail}>
                  {t.baseWeight.toFixed(1)} → {t.finalWeight.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Term tables */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Termdetaljer</h3>
        <TermTable terms={data.userTerms} title="Ditt notat" />
        <TermTable terms={data.wineTerms} title="Vinnota" />
      </div>
    </div>
  );
}

function TastingSelector({
  tastings,
  onSelect,
}: {
  tastings: PastTasting[];
  onSelect: (t: PastTasting) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = query
    ? tastings.filter(t => t.wineName.toLowerCase().includes(query.toLowerCase()))
    : tastings;

  if (tastings.length === 0) return null;

  return (
    <div className={styles.selectorWrap}>
      <button className={styles.selectorToggle} onClick={() => setOpen(o => !o)}>
        <span>Velg fra dine smakinger ({tastings.length})</span>
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.selectorDropdown}>
          <input
            className={styles.selectorSearch}
            placeholder="Søk etter vin…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <div className={styles.selectorList}>
            {filtered.length === 0 && (
              <div className={styles.selectorEmpty}>Ingen resultater</div>
            )}
            {filtered.map(t => (
              <button
                key={t.id}
                className={styles.selectorItem}
                onClick={() => { onSelect(t); setOpen(false); setQuery(''); }}
              >
                <div className={styles.selectorItemMain}>
                  <span className={styles.selectorWineName}>{t.wineName}</span>
                  {t.wineYear && <span className={styles.selectorYear}>{t.wineYear}</span>}
                </div>
                <div className={styles.selectorMeta}>
                  <span className={styles.selectorDate}>
                    {new Date(t.tastedAt).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  {t.userSmak && (
                    <span className={styles.selectorPreview}>{t.userSmak.slice(0, 60)}{t.userSmak.length > 60 ? '…' : ''}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScoringDemo({ pastTastings, lemmaGroups, defaultRecall, defaultFlavorFilter, defaultBertScore, defaultCategorySemantic }: {
  pastTastings: PastTasting[];
  lemmaGroups: LemmaGroup[];
  defaultRecall: boolean;
  defaultFlavorFilter: boolean;
  defaultBertScore: boolean;
  defaultCategorySemantic: boolean;
}) {
  const [userNote, setUserNote] = useState('');
  const [wineNote, setWineNote] = useState('');
  const [selectedTasting, setSelectedTasting] = useState<PastTasting | null>(null);
  const [noteType, setNoteType] = useState<'smak' | 'lukt'>('smak');
  const [result, setResult] = useState<ScoringBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [recall, setRecall] = useState(defaultRecall);
  const [flavorFilter, setFlavorFilter] = useState(defaultFlavorFilter);
  const [bertScore, setBertScore] = useState(defaultBertScore);
  const [categorySemantic, setCategorySemantic] = useState(defaultCategorySemantic);

  const analyze = () => {
    if (!userNote.trim() || !wineNote.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const data = await getScoringBreakdown(userNote, wineNote, { recall, flavorFilter, bertScore, categorySemantic });
        setResult(data);
      } catch (e) {
        setError('Analyse feilet. Sjekk at OpenAI API-nøkkelen er satt.');
        console.error(e);
      }
    });
  };

  const loadExample = (ex: typeof EXAMPLES[0]) => {
    setUserNote(ex.user);
    setWineNote(ex.wine);
    setSelectedTasting(null);
    setResult(null);
  };

  const loadTasting = (t: PastTasting, type: 'smak' | 'lukt') => {
    const isSmak = type === 'smak';
    setUserNote(isSmak ? t.userSmak : t.userLukt);
    setWineNote(isSmak ? t.wineTaste : t.wineSmell);
    setSelectedTasting(t);
    setNoteType(type);
    setResult(null);
  };

  return (
    <div className={styles.demo}>
      <div className={styles.examples}>
        {EXAMPLES.map(ex => (
          <button key={ex.label} className={styles.exampleBtn} onClick={() => loadExample(ex)}>
            {ex.label}
          </button>
        ))}
      </div>

      <TastingSelector
        tastings={pastTastings}
        onSelect={t => loadTasting(t, noteType)}
      />

      {selectedTasting && (
        <div className={styles.selectedBanner}>
          <div className={styles.selectedInfo}>
            <strong>{selectedTasting.wineName}</strong>
            {selectedTasting.wineYear && <span> · {selectedTasting.wineYear}</span>}
            <span className={styles.selectedDate}>
              {' '}· {new Date(selectedTasting.tastedAt).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className={styles.noteTypeTabs}>
            <button
              className={`${styles.noteTab} ${noteType === 'smak' ? styles.noteTabActive : ''}`}
              onClick={() => loadTasting(selectedTasting, 'smak')}
            >
              Smak
            </button>
            <button
              className={`${styles.noteTab} ${noteType === 'lukt' ? styles.noteTabActive : ''}`}
              onClick={() => loadTasting(selectedTasting, 'lukt')}
              disabled={!selectedTasting.userLukt || !selectedTasting.wineSmell}
            >
              Lukt
            </button>
          </div>
        </div>
      )}

      <div className={styles.inputGrid}>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Ditt smakingsnotat</label>
          <textarea
            className={styles.textarea}
            value={userNote}
            onChange={e => { setUserNote(e.target.value); setSelectedTasting(null); }}
            placeholder="Skriv inn ditt smakingsnotat her…"
            rows={4}
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Vinens referansenotat</label>
          <textarea
            className={styles.textarea}
            value={wineNote}
            onChange={e => { setWineNote(e.target.value); setSelectedTasting(null); }}
            placeholder="Skriv inn vinens notat her…"
            rows={4}
          />
        </div>
      </div>

      <div className={styles.analyzeRow}>
        <button
          className={styles.analyzeBtn}
          onClick={analyze}
          disabled={isPending || !userNote.trim() || !wineNote.trim()}
        >
          {isPending ? 'Analyserer…' : 'Analyser'}
        </button>
        <div className={styles.flagToggles}>
          <button
            className={`${styles.flagToggle} ${recall ? styles.flagToggleOn : ''}`}
            onClick={() => setRecall(r => !r)}
            title="Normaliser mot vinnotatets lengde — korte notater straffes for å mangle deskriptorer"
          >
            Recall {recall ? 'på' : 'av'}
          </button>
          <button
            className={`${styles.flagToggle} ${flavorFilter ? styles.flagToggleOn : ''}`}
            onClick={() => setFlavorFilter(f => !f)}
            title="Fjern strukturtermer (fylde, syre, osv.) fra semantisk sammenligning"
          >
            Smakfilter {flavorFilter ? 'på' : 'av'}
          </button>
          <button
            className={`${styles.flagToggle} ${bertScore ? styles.flagToggleOn : ''}`}
            onClick={() => setBertScore(b => !b)}
            title="Blend setningsembedding med token-nivå BERTScore (65% + 35%) — fanger nærsynonymer bedre"
          >
            BERTScore {bertScore ? 'på' : 'av'}
          </button>
          <button
            className={`${styles.flagToggle} ${categorySemantic ? styles.flagToggleOn : ''}`}
            onClick={() => setCategorySemantic(c => !c)}
            title="Bruk semantisk embedding per smakskategori i stedet for hierarkisk lemmatreff"
          >
            Kat.semantikk {categorySemantic ? 'på' : 'av'}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {result && (
        <Results
          data={result}
          storedScore={
            selectedTasting
              ? (noteType === 'smak' ? selectedTasting.tasteScore : selectedTasting.smellScore)
              : null
          }
        />
      )}
      <LemmaBrowser groups={lemmaGroups} />
    </div>
  );
}
