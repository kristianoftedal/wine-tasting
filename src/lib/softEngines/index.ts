import { openaiEngine } from './openai';
import { bertEngine, bertIsoEngine } from './bert';
import { colbertIsoEngine, colbertTokenEngine, colbertWordEngine } from './colbert';
import { SOFT_ENGINE_IDS, type SoftEngine, type SoftEngineId } from './types';

export type { Availability, NoteInput, SoftEngine, SoftEngineId, SoftEngineUnavailable, SoftResult, TokenAlignment } from './types';
export { SOFT_ENGINE_IDS } from './types';

/**
 * Engine registry. The engine modules are cheap to import: each one loads
 * its model (and the ONNX runtime) on first `score`, never at import, so an
 * engine nobody selects costs nothing.
 */
const factories: Record<SoftEngineId, () => SoftEngine> = {
  openai: () => openaiEngine,
  bert: () => bertEngine,
  'bert-iso': () => bertIsoEngine,
  'colbert-word': () => colbertWordEngine,
  'colbert-token': () => colbertTokenEngine,
  'colbert-iso': () => colbertIsoEngine,
};

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
