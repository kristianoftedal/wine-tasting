'use client';

import { useEffect, useState, useTransition } from 'react';
import { getScoringBreakdown, type ScoringBreakdown, type TermDetail, type SoftEngineComparison } from '@/actions/scoring-debug';
import type { SoftEngineId, SoftEngineUnavailable, TokenAlignment } from '@/lib/softEngines/types';
import type { PastTasting } from './page';
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
  // Surface forms outside the dictionary that normalizeWineSynonyms maps onto it.
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

export type EngineInfo = { id: SoftEngineId; model: string; available: boolean; reason?: string; active: boolean };

const ENGINE_STORAGE_KEY = 'scoring-demo.engines';

function AlignmentPanel({ title, model, alignments, disagreeWith }: {
  title: string; model: string; alignments: TokenAlignment[]; disagreeWith?: TokenAlignment[];
}) {
  const other = new Map((disagreeWith ?? []).map(a => [a.word, a.best]));
  return (
    <div className={styles.alignPanel}>
      <div className={styles.alignTitle}><span>{title}</span><span className={styles.alignSim}>{model}</span></div>
      {alignments.length === 0 && <div className={styles.unavailable}>ingen innholdsord</div>}
      {alignments.map(a => {
        const disagree = other.size > 0 && other.has(a.word) && other.get(a.word) !== a.best;
        return (
          <div key={a.word} className={`${styles.alignRow} ${disagree ? styles.alignDisagree : ''}`} title={disagree ? 'Motorene er uenige om beste treff' : undefined}>
            <span className={styles.mono}>{a.word}</span>
            <span className={styles.alignArrow}>→</span>
            <span className={styles.mono}>{a.best ?? '∅'}</span>
            <span className={styles.alignSim}>{a.sim.toFixed(2)}{a.weight !== 1 ? ` ×${a.weight.toFixed(2)}` : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

type EngineSection = {
  id: SoftEngineId | string;
  model: string;
  active: boolean;
  available: boolean;
  reason?: string;
  softScore: number;
  total: number;
  delta: number;
  raw?: number;
  baseline?: number;
  ms?: number;
  alignments: TokenAlignment[];
};

/**
 * One accordion item per soft engine: the engine in production first (its
 * numbers are the breakdown's own), then every engine selected for
 * comparison. The lexical half is the same for all of them; what differs is
 * the soft term and therefore the total.
 */
function EngineAccordion({ data, engines }: { data: ScoringBreakdown; engines: EngineInfo[] }) {
  const activeId = data.engine ?? 'openai';
  const sections: EngineSection[] = [
    {
      id: activeId, model: engines.find(e => e.id === activeId)?.model ?? '', active: true, available: true,
      softScore: data.softScore, total: data.currentScore, delta: 0, alignments: data.alignments,
    },
    ...data.softEngines.map((r): EngineSection => r.available
      ? { id: r.engine, model: r.model, active: false, available: true, softScore: r.softScore, total: r.combinedScore, delta: r.delta, raw: r.raw, baseline: r.baseline, ms: r.ms, alignments: r.alignments }
      : { id: r.engine, model: r.model, active: false, available: false, reason: (r as SoftEngineUnavailable).reason, softScore: 0, total: 0, delta: 0, alignments: [] }),
  ];
  const [open, setOpen] = useState<Set<string>>(() => new Set([activeId]));
  const toggle = (id: string) => setOpen(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const precisionPct = Math.round(data.precision * 100);

  return (
    <div className={styles.engineAccordion}>
      {sections.map(sec => {
        const isOpen = open.has(sec.id);
        return (
          <div key={sec.id} className={styles.engineItem}>
            <button className={styles.engineItemBtn} onClick={() => toggle(sec.id)} aria-expanded={isOpen}>
              <span className={styles.mono} style={{ fontWeight: 600 }}>{sec.id}</span>
              {sec.active && <span className={styles.engineActive}>i drift</span>}
              <span className={styles.engineItemModel}>{sec.model}</span>
              <span className={styles.engineItemScores}>
                {sec.available ? (
                  <>
                    <span className={styles.engineItemTotal} style={{ color: scoreColor(sec.total) }}>{sec.total}</span>
                    {!sec.active && (
                      <span className={styles.engineItemDelta} style={{ color: sec.delta > 0 ? '#16a34a' : sec.delta < 0 ? '#dc2626' : '#9ca3af' }}>
                        {sec.delta > 0 ? '+' : ''}{sec.delta}
                      </span>
                    )}
                  </>
                ) : (
                  <span className={styles.unavailable}>ikke tilgjengelig</span>
                )}
              </span>
              <span className={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className={styles.engineItemContent}>
                {!sec.available ? (
                  <div className={styles.unavailable}>{sec.reason}</div>
                ) : (
                  <>
                    <div className={styles.scoreGrid}>
                      <ScoreCard title="Treffscore" value={Math.round(data.hitScore)} description={`Metning på ${data.hitMass.toFixed(1)} treffmasse (lik for alle motorer)`} />
                      <ScoreCard
                        title="Token-likhet"
                        value={Math.round(sec.softScore)}
                        description={sec.raw !== undefined ? `rå ${sec.raw.toFixed(3)}${sec.baseline ? `, gulv ${sec.baseline.toFixed(3)}` : ''}${sec.ms !== undefined ? ` · ${Math.round(sec.ms)} ms` : ''}` : 'MaxSim-presisjon (nærsynonymer)'}
                      />
                      <div className={styles.scoreCard}>
                        <div className={styles.scoreCardTitle}>Presisjon</div>
                        <div className={styles.scoreCardValue} style={{ color: '#8b5cf6' }}>{precisionPct}%</div>
                        <div className={styles.formula}>{data.hitMass.toFixed(1)} / {data.userMass.toFixed(1)} masse</div>
                        <div className={styles.scoreCardDesc}>Andel av det du skrev som traff</div>
                      </div>
                      <div className={styles.finalCard}>
                        <ScoreRing value={sec.total} label="Totalscore" sub={sec.active ? 'beregnet nå' : `${sec.delta > 0 ? '+' : ''}${sec.delta} mot drift`} />
                        <div className={styles.finalFormula}>
                          0.55 × {Math.round(data.hitScore)} + 0.45 × {Math.round(sec.softScore)} → {sec.total}
                        </div>
                      </div>
                    </div>
                    <div className={styles.alignGrid}>
                      <AlignmentPanel
                        title="Ordtreff"
                        model={sec.model}
                        alignments={sec.alignments}
                        disagreeWith={sec.active ? undefined : data.alignments}
                      />
                    </div>
                    {!sec.active && (
                      <div className={styles.compareNote}>Oransje rader: denne motoren velger et annet referanseord enn motoren i drift.</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Results({ data, storedScore, engines }: { data: ScoringBreakdown; storedScore: number | null; engines: EngineInfo[] }) {
  const idfBoosted = data.userTerms.filter(t => t.idfMultiplier > 1.0 && t.matched);
  const diff = storedScore !== null ? data.currentScore - storedScore : null;
  const precisionPct = Math.round(data.precision * 100);

  return (
    <div className={styles.results}>
      {/* Main scores row */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Komponentscorer</h3>
        {data.styleWeights && (
          <div className={styles.compareNote}>Stilvekter på: deskriptorvekter relativt til {data.styleCategory}. Termtabellen under viser de globale vektene.</div>
        )}
        {!data.scoreable && (
          <div className={styles.compareNote}>
            Vinnotatet nevner ingen aroma, bare struktur. Komponenten telles ikke med i en ekte smaking, så scoren her er 0.
          </div>
        )}
        <div className={styles.tokenRows}>
          <TokenChips rawTokens={data.userRawTokens} flavorTokens={data.userFlavorTokens} terms={data.userTerms} label="Ditt notat" />
          <TokenChips rawTokens={data.wineRawTokens} flavorTokens={data.wineFlavorTokens} terms={data.wineTerms} label="Vinnota" />
          {data.unknownWords.length > 0 && (
            <div className={styles.tokenRow}>
              <span className={styles.tokenRowLabel}>Lest som</span>
              {data.unknownWords.map((u, i) => (
                <span
                  key={i}
                  className={`${styles.tokenChip} ${u.applied ? styles.tokenChipMatched : u.sim >= data.oovThreshold ? styles.tokenChipRecognized : styles.tokenChipUnknown}`}
                  title={u.applied ? 'Brukt i scoringen (OOV_MAPPING_ENABLED)' : u.sim >= data.oovThreshold ? 'Ville blitt brukt med OOV_MAPPING_ENABLED=true' : `Under terskelen ${data.oovThreshold}`}
                >
                  {u.from} → {u.to} {u.sim.toFixed(2)}
                </span>
              ))}
            </div>
          )}
          {data.negated.length > 0 && (
            <div className={styles.tokenRow}>
              <span className={styles.tokenRowLabel}>Negert</span>
              {data.negated.map((w, i) => (
                <span key={i} className={`${styles.tokenChip} ${styles.tokenChipStripped}`} title="Fjernet fra scoringen fordi du skrev at det ikke var der">
                  {w}
                </span>
              ))}
              {data.contradicted.length > 0 && (
                <span className={styles.compareNote}>Vinnotatet nevner: {data.contradicted.join(', ')}</span>
              )}
            </div>
          )}
        </div>
        <EngineAccordion data={data} engines={engines} />
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
                  <span>Treffscore</span><strong>{Math.round(data.hitScore)}</strong>
                </div>
                <div className={styles.compareRow}>
                  <span>Token-likhet</span><strong>{Math.round(data.softScore)}</strong>
                </div>
                <div className={styles.compareRow}>
                  <span>Presisjon</span><strong>{precisionPct}%</strong>
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

export default function ScoringDemo({ pastTastings, engines, styleCategories, styleDefault }: {
  pastTastings: PastTasting[];
  engines: EngineInfo[];
  styleCategories: string[];
  styleDefault: boolean;
}) {
  const [category, setCategory] = useState<string>('');
  const [styleWeights, setStyleWeights] = useState<boolean>(styleDefault);
  const [userNote, setUserNote] = useState('');
  const [wineNote, setWineNote] = useState('');
  const [selectedTasting, setSelectedTasting] = useState<PastTasting | null>(null);
  const [noteType, setNoteType] = useState<'smak' | 'lukt'>('smak');
  const [result, setResult] = useState<ScoringBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedEngines, setSelectedEngines] = useState<SoftEngineId[]>([]);

  // Remember which engines to compare; a per-viewer convenience only.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ENGINE_STORAGE_KEY) ?? '[]') as SoftEngineId[];
      setSelectedEngines(saved.filter(id => engines.some(e => e.id === id && e.available && !e.active)));
    } catch { /* ignore */ }
  }, [engines]);
  const toggleEngine = (id: SoftEngineId) => {
    setSelectedEngines(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem(ENGINE_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const analyze = () => {
    if (!userNote.trim() || !wineNote.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const data = await getScoringBreakdown(userNote, wineNote, { engines: selectedEngines, category: category || null, styleWeights });
        setResult(data);
      } catch (e) {
        setError('Analyse feilet. Sjekk at motoren i drift har det den trenger (OPENAI_API_KEY for openai).');
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
    setCategory(styleCategories.find(c => c.toLowerCase() === String(t.wineCategory ?? '').toLowerCase()) ?? '');
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

      <div className={styles.engineRow}>
        <span className={styles.engineRowLabel}>Sammenlign motorer</span>
        {engines.map(e => (
          <button
            key={e.id}
            className={`${styles.engineChip} ${selectedEngines.includes(e.id) || e.active ? styles.engineChipOn : ''}`}
            onClick={() => !e.active && toggleEngine(e.id)}
            disabled={!e.available || e.active}
            title={e.active ? `I drift (SOFT_ENGINE) · ${e.model}` : e.available ? e.model : e.reason}
          >
            {e.id}{e.active && <span className={styles.engineActive}>i drift</span>}
          </button>
        ))}
      </div>

      <div className={styles.engineRow}>
        <span className={styles.engineRowLabel}>Stilvekter</span>
        <button
          className={`${styles.engineChip} ${styleWeights ? styles.engineChipOn : ''}`}
          onClick={() => setStyleWeights(v => !v)}
          title="Deskriptorvekt relativt til vinens stil (STYLE_WEIGHTS_ENABLED): sitrus på en hvitvin teller mindre enn solbær på en rødvin"
        >
          {styleWeights ? 'på' : 'av'}
        </button>
        <select className={styles.engineChip} value={category} onChange={e => setCategory(e.target.value)} title="Vinens hovedkategori; uten kategori brukes globale vekter">
          <option value="">ingen kategori</option>
          {styleCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
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
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {result && (
        <Results
          data={result}
          engines={engines}
          storedScore={
            selectedTasting
              ? (noteType === 'smak' ? selectedTasting.tasteScore : selectedTasting.smellScore)
              : null
          }
        />
      )}
    </div>
  );
}
