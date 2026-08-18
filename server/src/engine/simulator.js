/**
 * SmartFlow simulation runner.
 *
 * Executes a peak window twice — once as a do-nothing baseline and once with the
 * selected strategies applied — and returns both, plus the deltas. That paired
 * run is what lets an authority evaluate an intervention before spending on it.
 *
 * Corridor-level numbers are reported at the *design hour* (the worst 15-minute
 * step in the window), while totals are integrated across the whole window.
 */

import {
  evaluateNetwork,
  summarise,
  jurisdictionBalance,
  evaluateCorridor,
} from './trafficModel.js';
import { buildOverrides } from './strategies.js';
import { PEAK_WINDOWS } from '../data/nagpurNetwork.js';

const STEP_HOURS = 0.25; // 15-minute resolution
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export function resolveWindow(windowId) {
  return PEAK_WINDOWS.find((w) => w.id === windowId) || PEAK_WINDOWS[0];
}

export function windowSteps(win) {
  const steps = [];
  for (let t = win.startHour; t < win.endHour; t += STEP_HOURS) {
    steps.push(round(t, 2));
  }
  return steps;
}

export function stepLabel(t) {
  const h = Math.floor(t);
  const m = Math.round((t - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Run one scenario across a peak window.
 * @param {Array} corridors
 * @param {Object} win peak window definition
 * @param {Array} selections strategy selections (empty = baseline)
 */
export function runScenario(corridors, win, selections = []) {
  const byCode = Object.fromEntries(corridors.map((c) => [c.code, c]));
  const steps = windowSteps(win);

  const timeline = [];
  let designStep = null;
  let designSummary = null;
  let designResults = null;

  // Window integrals: each 15-minute step contributes a quarter of its hourly rate.
  const totals = {
    vehicleDelayHours: 0,
    personDelayHours: 0,
    co2Kg: 0,
    fuelWastedLitres: 0,
    economicLossInr: 0,
    vehicleKm: 0,
    volume: 0,
  };
  let speedWeighted = 0;
  let indexWeighted = 0;
  let vcWeighted = 0;

  let build = null;

  for (const t of steps) {
    build = buildOverrides(corridors, t, selections);
    const results = evaluateNetwork(corridors, t, build.overrides);
    const s = summarise(results, byCode);

    totals.vehicleDelayHours += s.vehicleDelayHours * STEP_HOURS;
    totals.personDelayHours += s.personDelayHours * STEP_HOURS;
    totals.co2Kg += s.co2Kg * STEP_HOURS;
    totals.fuelWastedLitres += s.fuelWastedLitres * STEP_HOURS;
    totals.economicLossInr += s.economicLossInr * STEP_HOURS;
    totals.vehicleKm += s.vehicleKm * STEP_HOURS;
    totals.volume += s.totalVolume * STEP_HOURS;

    const w = s.vehicleKm * STEP_HOURS || 1;
    speedWeighted += s.avgSpeed * w;
    indexWeighted += s.congestionIndex * w;
    vcWeighted += s.avgVc * w;

    timeline.push({
      t,
      label: stepLabel(t),
      congestionIndex: s.congestionIndex,
      avgSpeed: s.avgSpeed,
      volume: s.totalVolume,
      delayHours: round(s.vehicleDelayHours, 1),
      queueVehicles: s.queueVehicles,
      congestedCorridors: s.congestedCorridors,
    });

    if (!designSummary || s.congestionIndex > designSummary.congestionIndex) {
      designSummary = s;
      designResults = results;
      designStep = t;
    }
  }

  const wKm = totals.vehicleKm || 1;

  return {
    window: { id: win.id, label: win.label, short: win.short, startHour: win.startHour, endHour: win.endHour },
    designHour: designStep,
    designHourLabel: stepLabel(designStep ?? win.startHour),
    /** Snapshot of every corridor at the worst moment of the window. */
    corridors: designResults || [],
    /** Network KPIs at the worst moment. */
    peak: designSummary,
    /** Integrated KPIs across the whole window. */
    window_totals: {
      vehicleDelayHours: round(totals.vehicleDelayHours, 1),
      personDelayHours: round(totals.personDelayHours, 1),
      co2Kg: round(totals.co2Kg, 1),
      fuelWastedLitres: round(totals.fuelWastedLitres, 1),
      economicLossInr: Math.round(totals.economicLossInr),
      vehicleKm: Math.round(totals.vehicleKm),
      avgSpeed: round(speedWeighted / wKm, 1),
      congestionIndex: round(indexWeighted / wKm, 1),
      avgVc: round(vcWeighted / wKm, 3),
    },
    timeline,
    jurisdiction: jurisdictionBalance(designResults || [], byCode),
    applied: build?.applied || [],
    skipped: build?.skipped || [],
    totalCostLakh: build?.totalCostLakh || 0,
    maxDeployDays: build?.maxDeployDays || 0,
  };
}

const pctChange = (before, after) => (before === 0 ? 0 : round(((after - before) / before) * 100, 1));

/** Full paired run: baseline vs treatment, with deltas and per-corridor comparison. */
export function runSimulation(corridors, { windowId = 'morning', selections = [] } = {}) {
  const win = resolveWindow(windowId);
  const before = runScenario(corridors, win, []);
  const after = runScenario(corridors, win, selections);

  const beforeByCode = Object.fromEntries(before.corridors.map((c) => [c.code, c]));
  const corridorsByCode = Object.fromEntries(corridors.map((c) => [c.code, c]));

  const comparison = after.corridors.map((a) => {
    const b = beforeByCode[a.code];
    const meta = corridorsByCode[a.code];
    return {
      code: a.code,
      name: meta?.shortName || a.code,
      jurisdiction: meta?.jurisdiction,
      before: b,
      after: a,
      delta: {
        vc: round(a.vc - b.vc, 3),
        avgSpeed: round(a.avgSpeed - b.avgSpeed, 1),
        delayMin: round(a.delayMin - b.delayMin, 2),
        travelTimeMin: round(a.travelTimeMin - b.travelTimeMin, 2),
        congestionIndex: round(a.congestionIndex - b.congestionIndex, 1),
        queueVehicles: a.queueVehicles - b.queueVehicles,
        speedPct: pctChange(b.avgSpeed, a.avgSpeed),
        delayPct: pctChange(b.delayMin, a.delayMin),
      },
      losChanged: a.los !== b.los,
      improved: a.congestionIndex < b.congestionIndex - 0.5,
      worsened: a.congestionIndex > b.congestionIndex + 0.5,
    };
  });

  const bt = before.window_totals;
  const at = after.window_totals;

  const delta = {
    congestionIndex: round(at.congestionIndex - bt.congestionIndex, 1),
    congestionIndexPct: pctChange(bt.congestionIndex, at.congestionIndex),
    avgSpeed: round(at.avgSpeed - bt.avgSpeed, 1),
    avgSpeedPct: pctChange(bt.avgSpeed, at.avgSpeed),
    vehicleDelayHours: round(at.vehicleDelayHours - bt.vehicleDelayHours, 1),
    vehicleDelayPct: pctChange(bt.vehicleDelayHours, at.vehicleDelayHours),
    personDelayHours: round(at.personDelayHours - bt.personDelayHours, 1),
    co2Kg: round(at.co2Kg - bt.co2Kg, 1),
    co2Pct: pctChange(bt.co2Kg, at.co2Kg),
    fuelWastedLitres: round(at.fuelWastedLitres - bt.fuelWastedLitres, 1),
    economicLossInr: Math.round(at.economicLossInr - bt.economicLossInr),
    economicLossPct: pctChange(bt.economicLossInr, at.economicLossInr),
    congestedCorridors: after.peak.congestedCorridors - before.peak.congestedCorridors,
    jurisdictionGini: round(after.jurisdiction.gini - before.jurisdiction.gini, 3),
  };

  // Payback: capital cost against the delay-and-fuel saving this window yields,
  // assumed to recur on ~250 working days a year.
  const savingPerWindowInr = Math.max(0, -delta.economicLossInr);
  const annualSavingInr = savingPerWindowInr * 250;
  const capexInr = after.totalCostLakh * 100000;
  const paybackMonths =
    annualSavingInr > 0 ? round((capexInr / annualSavingInr) * 12, 1) : null;

  return {
    windowId: win.id,
    window: before.window,
    before,
    after,
    delta,
    comparison,
    economics: {
      capexLakh: after.totalCostLakh,
      deployDays: after.maxDeployDays,
      savingPerWindowInr: Math.round(savingPerWindowInr),
      annualSavingLakh: round(annualSavingInr / 100000, 1),
      paybackMonths,
    },
    improvedCount: comparison.filter((c) => c.improved).length,
    worsenedCount: comparison.filter((c) => c.worsened).length,
  };
}

/** Cheap single-corridor evaluation used by the recommender's what-if sweeps. */
export function quickEvaluate(corridor, hour, overrides) {
  return evaluateCorridor(corridor, hour, overrides);
}
