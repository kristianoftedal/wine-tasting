import { openaiEngine } from './openai';
import { SOFT_ENGINE_IDS, type SoftEngine, type SoftEngineId } from './types';

export type { Availability, NoteInput, SoftEngine, SoftEngineId, SoftEngineUnavailable, SoftResult, TokenAlignment } from './types';
export { SOFT_ENGINE_IDS } from './types';

/**
 * Engine registry. Engines are created lazily so that a model nobody selects
 * is never loaded; `require` inside the factory keeps the ONNX runtime out of
 * the module graph until an engine that needs it is actually asked for.
 */
const factories: Record<SoftEngineId, () => SoftEngine> = {
  openai: () => openaiEngine,
  bert: () => notYet('bert', 'NorBERT3-motoren kommer i fase 08'),
  'colbert-word': () => notYet('colbert-word', 'ColBERT-motoren kommer i fase 08'),
  'colbert-token': () => notYet('colbert-token', 'ColBERT-motoren kommer i fase 08'),
};

function notYet(id: SoftEngineId, reason: string): SoftEngine {
  return {
    id,
    model: '—',
    async available() { return { ok: false, reason }; },
    async score() { throw new Error(`soft engine ${id}: ${reason}`); },
  };
}

const instances = new Map<SoftEngineId, SoftEngine>();

export function isSoftEngineId(value: string | undefined): value is SoftEngineId {
  return !!value && (SOFT_ENGINE_IDS as readonly string[]).includes(value);
}

export function getSoftEngineById(id: SoftEngineId): SoftEngine {
  let engine = instances.get(id);
  if (!engine) { engine = factories[id](); instances.set(id, engine); }
  return engine;
}

let warned = false;

/**
 * The engine production scores with: `SOFT_ENGINE`, default `openai`. An
 * unknown value falls back to `openai` and says so once, rather than taking
 * scoring down over a typo in an environment variable.
 */
export function getSoftEngine(): SoftEngine {
  const wanted = process.env.SOFT_ENGINE;
  if (!wanted || wanted === 'openai') return getSoftEngineById('openai');
  if (isSoftEngineId(wanted)) return getSoftEngineById(wanted);
  if (!warned) { console.warn(`SOFT_ENGINE="${wanted}" is not an engine; using openai`); warned = true; }
  return getSoftEngineById('openai');
}

export async function listSoftEngines(): Promise<Array<{ id: SoftEngineId; model: string; available: boolean; reason?: string; active: boolean }>> {
  const active = getSoftEngine().id;
  return Promise.all(SOFT_ENGINE_IDS.map(async id => {
    const engine = getSoftEngineById(id);
    const a = await engine.available();
    return { id, model: engine.model, available: a.ok, reason: a.reason, active: id === active };
  }));
}
