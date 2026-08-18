/**
 * Network access layer: loads corridors from MongoDB once and keeps them in
 * process memory (the network geometry is reference data — it changes when an
 * operator edits a corridor, not on every request).
 *
 * Also provides the live-monitoring jitter that makes the dashboard behave like
 * a feed rather than a static page.
 */

import { Corridor } from '../models/Corridor.js';

let cache = null;

export async function getCorridors({ refresh = false } = {}) {
  if (!cache || refresh) {
    cache = await Corridor.find().sort({ code: 1 }).lean();
  }
  return cache;
}

export function invalidateCorridorCache() {
  cache = null;
}

export async function getCorridorMap() {
  const list = await getCorridors();
  return Object.fromEntries(list.map((c) => [c.code, c]));
}

/** Deterministic hash so a given corridor + tick always yields the same jitter. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Live detector noise. Real loop detectors never report the modelled mean, so
 * each corridor gets a smooth +/-9% wobble driven by the current 20-second tick.
 * Two harmonics keep it from looking like a sawtooth.
 */
export function liveOverrides(corridors, tick = Math.floor(Date.now() / 20000)) {
  const overrides = {};
  for (const c of corridors) {
    const a = hash(`${c.code}:${tick}`);
    const b = hash(`${c.code}:${tick + 1}`);
    const wobble = 1 + (a - 0.5) * 0.12 + (b - 0.5) * 0.06;
    overrides[c.code] = { volumeFactor: wobble };
  }
  return overrides;
}

/** Current hour as a fractional value, for "what is happening right now". */
export function currentHour(date = new Date()) {
  return date.getHours() + date.getMinutes() / 60;
}
