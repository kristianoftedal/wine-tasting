import { openaiEngine } from './openai';
import { bertEngine, bertIsoEngine } from './bert';
import { colbertIsoEngine, colbertTokenEngine, colbertWordEngine } from './colbert';
import { colbertTableEngine, colbertTunedEngine, coocEngine } from './colbertTable';
import { colbertCoocEngine, openaiCoocEngine } from './blend';
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
  'colbert-table': () => colbertTableEngine,
  'colbert-tuned': () => colbertTunedEngine,
  cooc: () => coocEngine,
  'openai+cooc': () => openaiCoocEngine,
  'colbert+cooc': () => colbertCoocEngine,
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
 * The engine production scores with: `SOFT_ENGINE`, default `colbert-table`
 * since scorer v7 (31 Oct 2026): the mLateOn vocabulary table, no model and
 * no API call at runtime, level-fitted onto the OpenAI engine's scale.
 * Measured on the frozen set under the v6 ladder it agrees with the club's
 * rater at 0.671 (OpenAI 0.658) and with the panel at 0.764 (0.753), with
 * the property gate within noise (+WRONG −4.1 vs −4.4, d 1.29 vs 1.37). An
 * unknown value falls back to the default and says so once, rather than
 * taking scoring down over a typo in an environment variable.
 */
export const DEFAULT_SOFT_ENGINE: SoftEngineId = 'colbert-table';

export function getSoftEngine(): SoftEngine {
  const wanted = process.env.SOFT_ENGINE;
  if (!wanted) return getSoftEngineById(DEFAULT_SOFT_ENGINE);
  if (isSoftEngineId(wanted)) return getSoftEngineById(wanted);
  if (!warned) { console.warn(`SOFT_ENGINE="${wanted}" is not an engine; using ${DEFAULT_SOFT_ENGINE}`); warned = true; }
  return getSoftEngineById(DEFAULT_SOFT_ENGINE);
}

export async function listSoftEngines(): Promise<Array<{ id: SoftEngineId; model: string; available: boolean; reason?: string; active: boolean }>> {
  const active = getSoftEngine().id;
  return Promise.all(SOFT_ENGINE_IDS.map(async id => {
    const engine = getSoftEngineById(id);
    const a = await engine.available();
    return { id, model: engine.model, available: a.ok, reason: a.reason, active: id === active };
  }));
}
