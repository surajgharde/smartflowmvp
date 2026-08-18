/**
 * SmartFlow traffic-management strategy library.
 *
 * Each strategy is a real intervention a Nagpur planning authority could actually
 * fund, expressed as a transformation of the model inputs (volume, capacity,
 * signal delay, heavy-vehicle share) plus a capital cost and deployment lead time.
 *
 * Strategies never mutate the network. They emit an override bundle that the
 * traffic model consumes, which is what makes "simulate before you implement"
 * possible: the same corridor can be evaluated with and without the bundle.
 */

import { demandAtHour } from './trafficModel.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const STRATEGIES = [
  {
    id: 'adaptive-signals',
    name: 'Adaptive Signal Control',
    short: 'ATCS',
    icon: 'TrafficCone',
    category: 'Signal',
    tagline: 'Retime green splits from live detector counts',
    description:
      'Replaces fixed-time plans with an adaptive controller that reallocates green time to the saturated approach every cycle, and coordinates a green wave along the corridor.',
    treats: ['signalBound'],
    deployDays: 21,
    /** @returns cost in INR lakh */
    cost: (c, i) => 16 * c.signals * i + 6 * i,
    requires: (c) => c.signals >= 3,
    requirementHint: 'Corridor needs at least 3 signalised junctions',
    apply: (ov, c, i) => {
      ov.signalFactor *= 1 - 0.38 * i;
      ov.capacityFactor *= 1 + 0.06 * i;
    },
  },
  {
    id: 'corridor-diversion',
    name: 'Dynamic Corridor Diversion',
    short: 'Diversion',
    icon: 'Split',
    category: 'Demand',
    tagline: 'Push a share of peak demand onto parallel routes',
    description:
      'Variable message signs and navigation-provider feeds divert a controlled share of peak traffic onto parallel corridors that still have spare capacity. Diverted vehicles are added to the alternates, not deleted.',
    treats: ['capacityBound', 'divertible'],
    deployDays: 7,
    cost: (c, i) => 5 + 3.5 * c.lengthKm * i,
    requires: (c) => (c.alternates || []).length > 0,
    requirementHint: 'Corridor needs at least one parallel alternate route',
    /** Diversion is handled specially in buildOverrides because it moves volume between links. */
    diversionShare: (i) => 0.24 * i,
    apply: () => {},
  },
  {
    id: 'reversible-lane',
    name: 'Reversible (Tidal) Lane',
    short: 'Tidal Lane',
    icon: 'ArrowLeftRight',
    category: 'Capacity',
    tagline: 'Flip the centre lane to the peak direction',
    description:
      'A movable barrier or lane-control signal gantry reassigns the centre lane to the dominant peak direction, adding directional capacity without acquiring any land.',
    treats: ['capacityBound', 'directional'],
    deployDays: 30,
    cost: (c, i) => 14 * c.lengthKm * i + 8,
    requires: (c) => c.lanes >= 3,
    requirementHint: 'Corridor needs 3 or more lanes per direction',
    apply: (ov, c, i) => {
      ov.capacityFactor *= 1 + 0.3 * i;
    },
  },
  {
    id: 'staggered-hours',
    name: 'Staggered Office & School Hours',
    short: 'Staggering',
    icon: 'Clock',
    category: 'Demand',
    tagline: 'Flatten the peak by shifting trip start times',
    description:
      'A coordinated policy with major employers, institutes and schools moves start times by 30-45 minutes, shifting trips out of the sharpest peak hour into the shoulder.',
    treats: ['peaked'],
    deployDays: 45,
    cost: () => 2.5,
    requires: () => true,
    apply: (ov, c, i) => {
      ov.volumeFactor *= 1 - 0.17 * i;
    },
  },
  {
    id: 'transit-priority',
    name: 'Bus Priority & Headway Boost',
    short: 'Transit',
    icon: 'BusFront',
    category: 'Mode shift',
    tagline: 'Cut headways and give buses signal priority',
    description:
      'Aapli Bus headways are cut on the corridor and buses receive signal priority. The resulting mode shift removes private vehicles from the peak flow entirely.',
    treats: ['transitOpportunity'],
    deployDays: 60,
    cost: (c, i) => 30 * i + 4 * c.lengthKm * i,
    requires: (c) => c.transitShare >= 0.12,
    requirementHint: 'Corridor needs an existing transit share of 12% or more',
    apply: (ov, c, i) => {
      // Mode shift scales with how much transit the corridor already carries.
      ov.volumeFactor *= 1 - clamp(0.9 * c.transitShare, 0, 0.22) * i;
    },
  },
  {
    id: 'hv-restriction',
    name: 'Heavy Vehicle Peak Restriction',
    short: 'HV Curb',
    icon: 'Truck',
    category: 'Demand',
    tagline: 'Bar goods vehicles during the peak window',
    description:
      'Goods vehicles above 7.5 tonnes are barred from the corridor during the peak window and rescheduled to the night band. Each truck removed frees three passenger-car units of road space.',
    treats: ['heavyBound'],
    deployDays: 14,
    cost: (c, i) => 2 + 1.2 * c.lengthKm * i,
    requires: (c) => c.heavyPct >= 0.12,
    requirementHint: 'Corridor needs a heavy-vehicle share of 12% or more',
    apply: (ov, c, i) => {
      ov.heavyFactor *= 1 - 0.72 * i;
    },
  },
  {
    id: 'junction-improvement',
    name: 'Junction Geometry Upgrade',
    short: 'Junction',
    icon: 'Cog',
    category: 'Capacity',
    tagline: 'Free-left slips, flares and channelisation',
    description:
      'Approach flaring, free-left slip lanes, refuge islands and cleared parking at the critical junctions raise saturation flow and cut the per-cycle lost time.',
    treats: ['signalBound', 'capacityBound'],
    deployDays: 120,
    cost: (c, i) => 42 * Math.max(1, Math.round(c.signals * 0.5)) * i,
    requires: (c) => c.signals >= 2,
    requirementHint: 'Corridor needs at least 2 signalised junctions',
    apply: (ov, c, i) => {
      ov.capacityFactor *= 1 + 0.16 * i;
      ov.signalFactor *= 1 - 0.22 * i;
    },
  },
  {
    id: 'one-way-pair',
    name: 'One-Way Pairing',
    short: 'One-Way',
    icon: 'MoveRight',
    category: 'Capacity',
    tagline: 'Pair the corridor with a parallel street',
    description:
      'The corridor and its nearest parallel street operate as a one-way pair during the peak, removing opposing turns and roughly a third more throughput — at the cost of loading the paired street.',
    treats: ['capacityBound', 'divertible'],
    deployDays: 20,
    cost: (c, i) => 6 + 2.5 * c.lengthKm * i,
    requires: (c) => (c.alternates || []).length > 0,
    requirementHint: 'Corridor needs a parallel street to pair with',
    pairingLoad: (i) => 0.14 * i,
    apply: (ov, c, i) => {
      ov.capacityFactor *= 1 + 0.36 * i;
    },
  },
];

export const STRATEGY_BY_ID = Object.fromEntries(STRATEGIES.map((s) => [s.id, s]));

/** Public-safe strategy catalogue (functions stripped) for the client. */
export function strategyCatalogue() {
  return STRATEGIES.map((s) => ({
    id: s.id,
    name: s.name,
    short: s.short,
    icon: s.icon,
    category: s.category,
    tagline: s.tagline,
    description: s.description,
    deployDays: s.deployDays,
    treats: s.treats,
    requirementHint: s.requirementHint || null,
  }));
}

/**
 * Which corridors each strategy may legally be applied to. Served to the client
 * so the corridor picker greys out ineligible options using the same predicate
 * the simulator enforces, instead of a re-implementation that can drift.
 */
export function eligibilityMap(corridors) {
  return Object.fromEntries(
    STRATEGIES.map((s) => [s.id, corridors.filter((c) => s.requires(c)).map((c) => c.code)])
  );
}

function blankOverride() {
  return { volumeFactor: 1, volumeDelta: 0, capacityFactor: 1, signalFactor: 1, heavyFactor: 1 };
}

/**
 * Turn a list of selected strategies into per-corridor model overrides for one hour.
 *
 * @param {Array} corridors      full network
 * @param {number} hour          hour of day being simulated
 * @param {Array} selections     [{ strategyId, intensity (0-1), corridorCodes: [] }]
 * @returns {{ overrides: Object, applied: Array, skipped: Array, totalCostLakh: number, maxDeployDays: number }}
 */
export function buildOverrides(corridors, hour, selections = []) {
  const byCode = Object.fromEntries(corridors.map((c) => [c.code, c]));
  const overrides = Object.fromEntries(corridors.map((c) => [c.code, blankOverride()]));

  const applied = [];
  const skipped = [];
  let totalCostLakh = 0;
  let maxDeployDays = 0;

  for (const sel of selections) {
    const strategy = STRATEGY_BY_ID[sel.strategyId];
    if (!strategy) {
      skipped.push({ strategyId: sel.strategyId, reason: 'Unknown strategy' });
      continue;
    }
    const intensity = clamp(Number(sel.intensity ?? 0.7), 0.1, 1);
    const codes = (sel.corridorCodes || []).filter((code) => byCode[code]);
    if (!codes.length) {
      skipped.push({ strategyId: strategy.id, reason: 'No corridors selected' });
      continue;
    }

    const eligible = [];
    for (const code of codes) {
      const corridor = byCode[code];
      if (!strategy.requires(corridor)) {
        skipped.push({
          strategyId: strategy.id,
          corridor: code,
          reason: strategy.requirementHint || 'Corridor not eligible',
        });
        continue;
      }
      eligible.push(corridor);
    }
    if (!eligible.length) continue;

    let cost = 0;
    for (const corridor of eligible) {
      strategy.apply(overrides[corridor.code], corridor, intensity);
      cost += strategy.cost(corridor, intensity);

      // Strategies that move traffic onto neighbouring links settle up here so the
      // network conserves vehicles instead of quietly deleting them.
      if (strategy.id === 'corridor-diversion') {
        const share = strategy.diversionShare(intensity);
        moveVolume(corridor, share, corridors, byCode, overrides, hour);
      }
      if (strategy.id === 'one-way-pair') {
        const share = strategy.pairingLoad(intensity);
        moveVolume(corridor, share, corridors, byCode, overrides, hour, { removeFromSource: false });
      }
    }

    totalCostLakh += cost;
    maxDeployDays = Math.max(maxDeployDays, strategy.deployDays);
    applied.push({
      strategyId: strategy.id,
      name: strategy.name,
      short: strategy.short,
      intensity,
      corridorCodes: eligible.map((c) => c.code),
      costLakh: Math.round(cost * 10) / 10,
      deployDays: strategy.deployDays,
    });
  }

  return {
    overrides,
    applied,
    skipped,
    totalCostLakh: Math.round(totalCostLakh * 10) / 10,
    maxDeployDays,
  };
}

/**
 * Move `share` of a corridor's hourly demand onto its alternates, distributed in
 * proportion to each alternate's spare capacity so traffic lands where there is
 * actually room for it.
 *
 * `removeFromSource: false` models one-way pairing, where the paired street picks
 * up the opposing movement without the source shedding demand.
 */
function moveVolume(corridor, share, corridors, byCode, overrides, hour, opts = {}) {
  const { removeFromSource = true } = opts;
  const alternates = (corridor.alternates || []).map((code) => byCode[code]).filter(Boolean);
  if (!alternates.length || share <= 0) return;

  const sourceDemand = demandAtHour(corridor, hour);
  const moved = sourceDemand * share;

  const spare = alternates.map((alt) => {
    const altDemand = demandAtHour(alt, hour);
    const altPcu = altDemand * (1 + alt.heavyPct * 2);
    const altCapacity = alt.lanes * capacityPerLane(alt);
    return Math.max(0, altCapacity - altPcu);
  });
  const totalSpare = spare.reduce((s, x) => s + x, 0);

  if (removeFromSource) overrides[corridor.code].volumeFactor *= 1 - share;

  alternates.forEach((alt, idx) => {
    // With no spare capacity anywhere, split evenly — the model will then show the
    // diversion making the alternates worse, which is the honest outcome.
    const weight = totalSpare > 0 ? spare[idx] / totalSpare : 1 / alternates.length;
    overrides[alt.code].volumeDelta += moved * weight;
  });
}

function capacityPerLane(corridor) {
  const table = {
    Expressway: 2200,
    Highway: 2000,
    Arterial: 1600,
    SubArterial: 1400,
    Collector: 1000,
    CBD: 900,
  };
  return table[corridor.roadClass] || 1600;
}
