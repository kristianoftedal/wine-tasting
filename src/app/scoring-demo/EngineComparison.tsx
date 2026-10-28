'use client';

import { useMemo, useState } from 'react';
import type { EngineComparison as Data, ComparisonField } from '@/lib/softEngines/comparison';
import type { SoftEngineId } from '@/lib/softEngines/types';
import styles from './page.module.css';

/**
 * Renders the static extract written by scripts/export-engine-comparison.ts:
 * every field of the frozen set scored by every engine, next to the score that
 * is stored on the row. Nothing here computes; the file is the comparison.
 */

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className={styles.deltaZero}>—</span>;
  if (value === 0) return <span className={styles.deltaZero}>0</span>;
  return <span className={value > 0 ? styles.deltaPos : styles.deltaNeg}>{value > 0 ? '+' : ''}{value}</span>;
}

function Scatter({ fields, engine }: { fields: ComparisonField[]; engine: SoftEngineId }) {
  const pts = fields.filter(f => f.storedScore !== null && f.scores[engine]).map(f => ({ x: f.storedScore!, y: f.scores[engine]!.score }));
  const pad = 28, size = 280, inner = size - pad * 2;
  const sx = (v: number) => pad + (v / 100) * inner;
  const sy = (v: number) => size - pad - (v / 100) * inner;
  return (
    <svg className={styles.scatter} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${engine} mot lagret score`}>
      <rect x={pad} y={pad} width={inner} height={inner} fill="#fff" stroke="#e5e7eb" />
      <line x1={sx(0)} y1={sy(0)} x2={sx(100)} y2={sy(100)} stroke="#d1d5db" strokeDasharray="4 4" />
      {[0, 50, 100].map(v => (
        <g key={v}>
          <text x={sx(v)} y={size - pad + 14} fontSize="9" textAnchor="middle" fill="#6b7280">{v}</text>
          <text x={pad - 6} y={sy(v) + 3} fontSize="9" textAnchor="end" fill="#6b7280">{v}</text>
        </g>
      ))}
      {pts.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3} fill="#6366f1" fillOpacity={0.55} />)}
      <text x={size / 2} y={size - 4} fontSize="9" textAnchor="middle" fill="#6b7280">lagret score</text>
      <text x={10} y={size / 2} fontSize="9" textAnchor="middle" fill="#6b7280" transform={`rotate(-90 10 ${size / 2})`}>{engine}</text>
    </svg>
  );
}

export default function EngineComparison({ data }: { data: Data }) {
  const engines = data.meta.engines;
  const [engine, setEngine] = useState<SoftEngineId>(engines[0]?.id ?? 'openai');
  const [minDelta, setMinDelta] = useState(0);
  const [field, setField] = useState<'alle' | 'lukt' | 'smak'>('alle');

  const rows = useMemo(() => {
    return data.fields
      .filter(f => f.scoreable && f.scores[engine] && (field === 'alle' || f.field === field))
      .map(f => ({ f, delta: f.storedScore === null ? null : f.scores[engine]!.score - f.storedScore }))
      .filter(r => r.delta === null || Math.abs(r.delta) >= minDelta)
      .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));
  }, [data, engine, minDelta, field]);

  if (!engines.length) return null;

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Motorsammenligning over smakingene</h3>
      <div className={styles.compareNote}>
        Statisk uttrekk fra {data.meta.frozenSet} ({data.fields.length} felt), generert {data.meta.generatedAt.slice(0, 10)} ved commit {data.meta.commit}
        {data.meta.raters > 0 ? ` · ${data.meta.raters} ratere` : ' · ingen menneskelige vurderinger ennå'}. Lagrede scorer er urørt.
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Motor</th><th>Modell</th><th>Felt</th><th>Snitt</th><th>SD</th><th>ρ lagret</th><th>ρ forrige motor</th><th>ρ mennesker</th>
            </tr>
          </thead>
          <tbody>
            {engines.map(e => (
              <tr key={e.id}>
                <td className={styles.mono}>{e.id}</td>
                <td className={styles.mono}>{e.model}</td>
                <td className={styles.num}>{e.fields}</td>
                <td className={styles.num}>{e.mean.toFixed(1)}</td>
                <td className={styles.num}>{e.sd.toFixed(1)}</td>
                <td className={styles.num}>{e.spearmanVsStored.toFixed(3)}</td>
                <td className={styles.num}>{e.spearmanVsPrevious?.toFixed(3) ?? '—'}</td>
                <td className={styles.num}>{e.spearmanVsHuman?.toFixed(3) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.filterRow}>
        <label>Motor <select value={engine} onChange={e => setEngine(e.target.value as SoftEngineId)}>
          {engines.map(e => <option key={e.id} value={e.id}>{e.id}</option>)}
        </select></label>
        <label>Felt <select value={field} onChange={e => setField(e.target.value as typeof field)}>
          <option value="alle">alle</option><option value="lukt">lukt</option><option value="smak">smak</option>
        </select></label>
        <label>|Δ| ≥ <input type="number" min={0} max={100} value={minDelta} onChange={e => setMinDelta(Number(e.target.value) || 0)} style={{ width: 60 }} /></label>
        <span className={styles.compareNote} style={{ marginTop: 0 }}>{rows.length} rader, størst avvik først</span>
      </div>

      <div className={styles.scatterWrap}>
        <Scatter fields={data.fields.filter(f => f.scoreable)} engine={engine} />
        <div className={styles.tableWrap} style={{ flex: 1, minWidth: 320, maxHeight: 420, overflowY: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr><th>Vin</th><th>Felt</th><th>Notat</th><th>Lagret</th><th>{engine}</th><th>Δ</th><th>Beste treff</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 150).map(({ f, delta }) => (
                <tr key={f.key}>
                  <td className={styles.noteCell}>{f.wine}<br /><span className={styles.alignSim}>{f.event ?? '—'} · {f.taster}</span></td>
                  <td>{f.field}</td>
                  <td className={styles.noteCell}>{f.userNote}</td>
                  <td className={styles.num}>{f.storedScore ?? '—'}</td>
                  <td className={styles.num}>{f.scores[engine]!.score}</td>
                  <td className={styles.num}><Delta value={delta} /></td>
                  <td className={styles.noteCell}>
                    {f.scores[engine]!.alignments.map(a => `${a.word}→${a.best ?? '∅'} ${a.sim.toFixed(2)}`).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
