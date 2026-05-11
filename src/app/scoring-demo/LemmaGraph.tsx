'use client';

import { useRef, useMemo, useState } from 'react';
import { GraphCanvas, GraphEdge, GraphNode, InternalGraphNode, useSelection } from 'reagraph';
import type { LemmaGroup } from './page';
import styles from './LemmaGraph.module.css';

const CAT_COLORS: Record<string, string> = {
  Frukt:     '#f59e0b',
  Krydder:   '#f87171',
  Mineral:   '#60a5fa',
  Urter:     '#4ade80',
  Blomster:  '#f472b6',
  'Eik/fat': '#c084fc',
  GENERIC:   '#94a3b8',
};
const FALLBACK_COLOR = '#94a3b8';

function alphaHex(hex: string, a: number): string {
  return hex + Math.round(a * 255).toString(16).padStart(2, '0');
}

function buildGraph(groups: LemmaGroup[]) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  nodes.push({
    id: 'root',
    label: 'Ordbok',
    fill: '#7c3aed',
    size: 18,
  });

  for (const group of groups) {
    const color = CAT_COLORS[group.main] ?? FALLBACK_COLOR;
    const catId = `c:${group.main}`;

    nodes.push({
      id: catId,
      label: group.main,
      fill: color,
      size: 14,
      cluster: group.main,
    });
    edges.push({ id: `e:root>${catId}`, source: 'root', target: catId });

    for (const sub of group.subs) {
      const subLabel = sub.name || group.main;
      const subId = `s:${group.main}:${subLabel}`;

      nodes.push({
        id: subId,
        label: subLabel,
        fill: alphaHex(color, 0.75),
        size: 7,
        cluster: group.main,
      });
      edges.push({ id: `e:${catId}>${subId}`, source: catId, target: subId });

      for (const term of sub.terms) {
        const termId = `l:${term.lemma}`;
        nodes.push({
          id: termId,
          label: term.lemma,
          fill: alphaHex(color, 0.55),
          size: 3,
          labelVisible: false,
          cluster: group.main,
        });
        edges.push({ id: `e:${subId}>${termId}`, source: subId, target: termId });
      }
    }
  }

  return { nodes, edges };
}

type LayoutType = 'forceDirected2d' | 'radialOut2d' | 'forceatlas2';

export default function LemmaGraph({ groups }: { groups: LemmaGroup[] }) {
  const graphRef = useRef<any>(null);
  const { nodes, edges } = useMemo(() => buildGraph(groups), [groups]);
  const [layout, setLayout] = useState<LayoutType>('forceDirected2d');
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const { selections, actives, onNodeClick, onCanvasClick } = useSelection({
    ref: graphRef,
    nodes,
    edges,
    type: 'single',
    pathHoverType: 'all',
    pathSelectionType: 'all',
  });

  const LAYOUTS: { key: LayoutType; label: string }[] = [
    { key: 'forceDirected2d', label: 'Klynger' },
    { key: 'radialOut2d', label: 'Radialt' },
    { key: 'forceatlas2', label: 'Atlas' },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Ordbok — alle gjenkjente termer</h3>
          <p className={styles.subtitle}>
            {nodes.length} noder · {edges.length} forbindelser · klikk en node for å belyse dens nettverk
          </p>
        </div>
        <div className={styles.controls}>
          {LAYOUTS.map(l => (
            <button
              key={l.key}
              className={`${styles.layoutBtn} ${layout === l.key ? styles.layoutBtnActive : ''}`}
              onClick={() => setLayout(l.key)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={styles.canvas}
        onMouseMove={e => setTooltipPos({ x: e.clientX, y: e.clientY })}
      >
        <GraphCanvas
          ref={graphRef}
          nodes={nodes}
          edges={edges}
          layoutType={layout}
          selections={selections}
          actives={actives}
          onNodeClick={onNodeClick}
          onCanvasClick={onCanvasClick}
          labelType="nodes"
          onNodePointerOver={(node: InternalGraphNode) => {
            setHovered(node as GraphNode);
          }}
          onNodePointerOut={() => setHovered(null)}
          theme={{
            canvas: { background: '#0f172a', fog: null },
            node: {
              fill: '#7ca0ab',
              activeFill: '#a78bfa',
              opacity: 1,
              selectedOpacity: 1,
              inactiveOpacity: 0.12,
              label: {
                color: '#f1f5f9',
                stroke: '#0f172a',
                activeColor: '#c4b5fd',
              },
            },
            lasso: {
              background: 'rgba(124,58,237,0.12)',
              border: '#8b5cf6',
            },
            ring: { fill: '#4c1d95', activeFill: '#8b5cf6' },
            edge: {
              fill: '#1e3a5f',
              activeFill: '#818cf8',
              opacity: 0.35,
              selectedOpacity: 0.8,
              inactiveOpacity: 0.04,
              label: {
                color: '#94a3b8',
                stroke: '#0f172a',
                activeColor: '#a78bfa',
              },
            },
            arrow: { fill: '#1e3a5f', activeFill: '#818cf8' },
            cluster: { stroke: '#1e293b', opacity: 0.08 },
          }}
        />

        {hovered && hovered.id.startsWith('l:') && (
          <div
            className={styles.tooltip}
            style={{ left: tooltipPos.x + 14, top: tooltipPos.y - 32 }}
          >
            <span className={styles.tooltipTerm}>{hovered.label}</span>
          </div>
        )}
      </div>

      <div className={styles.legend}>
        {Object.entries(CAT_COLORS).map(([cat, color]) => (
          <div key={cat} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: color }} />
            <span className={styles.legendLabel}>{cat}</span>
          </div>
        ))}
        <div className={styles.legendHint}>
          Hover over en liten node for å se lemmaet
        </div>
      </div>
    </div>
  );
}
