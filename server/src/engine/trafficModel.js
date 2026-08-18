/**
 * SmartFlow traffic model.
 *
 * Link performance uses the Bureau of Public Roads (BPR) volume-delay function —
 * the same formulation used in production transport planning tools — plus a
 * Webster-style signal delay term for intersections along the corridor.
 *
 *   t = t0 * (1 + alpha * (v/c)^beta)          alpha = 0.15, beta = 4
 *
 * Every downstream number (speed, delay, queue, CO2, fuel, economic loss) is
 * derived from that single evaluation, so a strategy that changes volume or
 * capacity propagates consistently through the whole KPI set.
 */

import { HOURLY_SHAPE, ROAD_CLASS, biasFactors } from '../data/nagpurNetwork.js';

export const BPR_ALPHA = 0.15;
export const BPR_BETA = 4;

/** Passenger Car Unit equivalents (IRC:106). */
export const PCU_HEAVY = 3.0;

/** Average base delay per signalised intersection, in seconds, at low saturation. */
export const BASE_SIGNAL_DELAY_S = 38;

/**
 * Share of base signal delay that is unavoidable even on an empty road. Used to
 * build the reference travel time that congestion is measured against.
 */
export const UNAVOIDABLE_SIGNAL_SHARE = 0.45;

/** Assumptions used to convert delay into human and economic impact. */
export const ASSUMPTIONS = {
  occupancy: 1.55, // persons per vehicle
  valueOfTimePerHour: 185, // INR per vehicle-hour of delay
  idleFuelLitresPerHour: 0.92, // litres burned per vehicle-hour of delay
  fuelPricePerLitre: 105, // INR
  vehicleLengthM: 6.2, // for queue length
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = (v, d = 2) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/** Level of Service band from volume/capacity ratio (HCM). */
export function levelOfService(vc) {
  if (vc <= 0.6) return 'A';
  if (vc <= 0.7) return 'B';
  if (vc <= 0.8) return 'C';
  if (vc <= 0.9) return 'D';
  if (vc <= 1.0) return 'E';
  return 'F';
}

/** Coarse status band used for map colouring and alerting. */
export function congestionStatus(vc) {
  if (vc >= 1.0) return 'severe';
  if (vc >= 0.85) return 'heavy';
  if (vc >= 0.7) return 'moderate';
  return 'free';
}

/**
 * Demand on a corridor at a given hour, before any strategy is applied.
 * Combines the city-wide 24-hour shape with the corridor's AM/PM bias.
 *
 * Fractional hours are interpolated so the simulation can step at 15-minute
 * resolution and animate smoothly instead of jumping between whole hours.
 */
export function demandAtHour(corridor, hour) {
  const h = ((hour % 24) + 24) % 24;
  const lo = Math.floor(h);
  const frac = h - lo;
  const shapeLo = HOURLY_SHAPE[lo];
  const shapeHi = HOURLY_SHAPE[(lo + 1) % 24];
  const shape = shapeLo + (shapeHi - shapeLo) * frac;

  const bias = biasFactors(corridor.peakBias);
  const window = h >= 12 ? bias.evening : bias.morning;
  return corridor.peakVolume * shape * window;
}

/**
 * Evaluate one corridor for one hour.
 *
 * `overrides` lets a strategy modify the inputs without mutating the corridor:
 *   volumeFactor    multiplies demand (rerouting, mode shift, staggered hours)
 *   volumeDelta     adds/removes absolute vehicles/hour (diverted traffic received)
 *   capacityFactor  multiplies capacity (reversible lane, junction works, one-way)
 *   signalFactor    multiplies signal delay (adaptive signal control)
 *   heavyFactor     multiplies the heavy-vehicle share (HV peak restriction)
 */
export function evaluateCorridor(corridor, hour, overrides = {}) {
  const cls = ROAD_CLASS[corridor.roadClass] || ROAD_CLASS.Arterial;
  const {
    volumeFactor = 1,
    volumeDelta = 0,
    capacityFactor = 1,
    signalFactor = 1,
    heavyFactor = 1,
  } = overrides;

  const baseDemand = demandAtHour(corridor, hour);
  const volume = Math.max(0, baseDemand * volumeFactor + volumeDelta);

  const heavyPct = clamp(corridor.heavyPct * heavyFactor, 0, 0.6);
  // Convert mixed traffic to PCU so heavy vehicles are charged their real road space.
  const pcuVolume = volume * (1 + heavyPct * (PCU_HEAVY - 1));

  const capacity = corridor.lanes * cls.capacityPerLane * capacityFactor;
  const vc = capacity > 0 ? pcuVolume / capacity : 0;

  // BPR running time. Saturation is capped at 1.6 so the quartic term stays sane
  // when a link is heavily oversaturated; the excess is charged as queue delay.
  const bprSat = Math.min(vc, 1.6);
  const freeFlowTimeMin = (corridor.lengthKm / cls.freeFlowSpeed) * 60;
  const runningTimeMin = freeFlowTimeMin * (1 + BPR_ALPHA * bprSat ** BPR_BETA);

  // Signal delay grows sharply once approaches start failing to clear per cycle.
  const oversaturation = Math.max(0, vc - 0.8);
  const signalDelayMin =
    ((corridor.signals * BASE_SIGNAL_DELAY_S) / 60) * (1 + 2.4 * oversaturation) * signalFactor;

  const travelTimeMin = runningTimeMin + signalDelayMin;

  // Reference ("uncongested") travel time. A signalised corridor is never as fast
  // as its free-flow running time even at 3 a.m. — drivers still stop at reds — so
  // the reference includes the unavoidable share of signal delay. Congestion is
  // measured against this, not against a physically impossible ideal.
  const referenceTimeMin = freeFlowTimeMin + ((corridor.signals * BASE_SIGNAL_DELAY_S) / 60) * UNAVOIDABLE_SIGNAL_SHARE;

  const delayMin = Math.max(0, travelTimeMin - referenceTimeMin);
  const avgSpeed = travelTimeMin > 0 ? (corridor.lengthKm / travelTimeMin) * 60 : cls.freeFlowSpeed;

  // Residual queue: vehicles arriving beyond capacity accumulate over the hour.
  const excessPcu = Math.max(0, pcuVolume - capacity);
  const queueVehicles = (excessPcu * 0.3) / Math.max(1, corridor.lanes);
  const queueMetres = queueVehicles * ASSUMPTIONS.vehicleLengthM;

  // Congestion index: 0 = uncongested, 100 = travel time at/over 2.5x reference.
  const timeRatio = referenceTimeMin > 0 ? travelTimeMin / referenceTimeMin : 1;
  const congestionIndex = clamp(((timeRatio - 1) / 1.5) * 100, 0, 100);

  const delayHours = (volume * delayMin) / 60;
  const co2PerKm = 128 + 3400 / Math.max(8, avgSpeed); // g/km/vehicle, worse when crawling
  const co2Kg = (volume * corridor.lengthKm * co2PerKm) / 1000;
  const fuelWastedLitres = delayHours * ASSUMPTIONS.idleFuelLitresPerHour;
  const economicLossInr =
    delayHours * ASSUMPTIONS.valueOfTimePerHour + fuelWastedLitres * ASSUMPTIONS.fuelPricePerLitre;

  return {
    code: corridor.code,
    hour,
    volume: Math.round(volume),
    pcuVolume: Math.round(pcuVolume),
    capacity: Math.round(capacity),
    heavyPct: round(heavyPct, 3),
    vc: round(vc, 3),
    los: levelOfService(vc),
    status: congestionStatus(vc),
    avgSpeed: round(avgSpeed, 1),
    freeFlowSpeed: cls.freeFlowSpeed,
    freeFlowTimeMin: round(freeFlowTimeMin, 2),
    referenceTimeMin: round(referenceTimeMin, 2),
    travelTimeMin: round(travelTimeMin, 2),
    runningTimeMin: round(runningTimeMin, 2),
    signalDelayMin: round(signalDelayMin, 2),
    delayMin: round(delayMin, 2),
    queueVehicles: Math.round(queueVehicles),
    queueMetres: Math.round(queueMetres),
    congestionIndex: round(congestionIndex, 1),
    vehicleDelayHours: round(delayHours, 1),
    personDelayHours: round(delayHours * ASSUMPTIONS.occupancy, 1),
    co2Kg: round(co2Kg, 1),
    fuelWastedLitres: round(fuelWastedLitres, 1),
    economicLossInr: Math.round(economicLossInr),
  };
}

/** Evaluate every corridor for one hour. */
export function evaluateNetwork(corridors, hour, overridesByCode = {}) {
  return corridors.map((c) => evaluateCorridor(c, hour, overridesByCode[c.code] || {}));
}

/**
 * Aggregate link results into network-level KPIs. Averages that describe user
 * experience (speed, v/c, congestion index) are weighted by vehicle-kilometres
 * so a busy 9 km arterial counts more than a quiet 1 km link.
 */
export function summarise(results, corridorsByCode) {
  if (!results.length) return emptySummary();

  let vehKm = 0;
  let weightedSpeed = 0;
  let weightedVc = 0;
  let weightedIndex = 0;

  const totals = {
    volume: 0,
    vehicleDelayHours: 0,
    personDelayHours: 0,
    co2Kg: 0,
    fuelWastedLitres: 0,
    economicLossInr: 0,
    queueVehicles: 0,
  };

  const statusCount = { free: 0, moderate: 0, heavy: 0, severe: 0 };

  for (const r of results) {
    const corridor = corridorsByCode[r.code];
    const km = (corridor?.lengthKm || 1) * r.volume;
    vehKm += km;
    weightedSpeed += r.avgSpeed * km;
    weightedVc += r.vc * km;
    weightedIndex += r.congestionIndex * km;

    totals.volume += r.volume;
    totals.vehicleDelayHours += r.vehicleDelayHours;
    totals.personDelayHours += r.personDelayHours;
    totals.co2Kg += r.co2Kg;
    totals.fuelWastedLitres += r.fuelWastedLitres;
    totals.economicLossInr += r.economicLossInr;
    totals.queueVehicles += r.queueVehicles;
    statusCount[r.status] += 1;
  }

  const safeVehKm = vehKm || 1;

  return {
    corridors: results.length,
    vehicleKm: Math.round(vehKm),
    totalVolume: Math.round(totals.volume),
    avgSpeed: round(weightedSpeed / safeVehKm, 1),
    avgVc: round(weightedVc / safeVehKm, 3),
    congestionIndex: round(weightedIndex / safeVehKm, 1),
    vehicleDelayHours: round(totals.vehicleDelayHours, 1),
    personDelayHours: round(totals.personDelayHours, 1),
    co2Kg: round(totals.co2Kg, 1),
    fuelWastedLitres: round(totals.fuelWastedLitres, 1),
    economicLossInr: Math.round(totals.economicLossInr),
    queueVehicles: Math.round(totals.queueVehicles),
    statusCount,
    congestedCorridors: statusCount.heavy + statusCount.severe,
  };
}

function emptySummary() {
  return {
    corridors: 0,
    vehicleKm: 0,
    totalVolume: 0,
    avgSpeed: 0,
    avgVc: 0,
    congestionIndex: 0,
    vehicleDelayHours: 0,
    personDelayHours: 0,
    co2Kg: 0,
    fuelWastedLitres: 0,
    economicLossInr: 0,
    queueVehicles: 0,
    statusCount: { free: 0, moderate: 0, heavy: 0, severe: 0 },
    congestedCorridors: 0,
  };
}

/**
 * Jurisdiction load balance — the direct measurement of the hackathon problem
 * statement ("uneven distribution of traffic over planning authorities'
 * jurisdiction"). Returns per-authority load plus a Gini coefficient where
 * 0 = perfectly even burden and 1 = one authority carries everything.
 */
export function jurisdictionBalance(results, corridorsByCode) {
  const byAuthority = new Map();

  for (const r of results) {
    const corridor = corridorsByCode[r.code];
    if (!corridor) continue;
    const key = corridor.jurisdiction;
    if (!byAuthority.has(key)) {
      byAuthority.set(key, {
        jurisdiction: key,
        corridors: 0,
        laneKm: 0,
        vehicleKm: 0,
        vcWeighted: 0,
        delayHours: 0,
        severe: 0,
      });
    }
    const a = byAuthority.get(key);
    const km = corridor.lengthKm * r.volume;
    a.corridors += 1;
    a.laneKm += corridor.lengthKm * corridor.lanes;
    a.vehicleKm += km;
    a.vcWeighted += r.vc * km;
    a.delayHours += r.vehicleDelayHours;
    if (r.status === 'severe') a.severe += 1;
  }

  const rows = [...byAuthority.values()].map((a) => ({
    jurisdiction: a.jurisdiction,
    corridors: a.corridors,
    laneKm: round(a.laneKm, 1),
    vehicleKm: Math.round(a.vehicleKm),
    avgVc: round(a.vehicleKm ? a.vcWeighted / a.vehicleKm : 0, 3),
    delayHours: round(a.delayHours, 1),
    severeCorridors: a.severe,
    // Demand carried per lane-km of infrastructure owned: the fairness metric.
    loadPerLaneKm: Math.round(a.laneKm ? a.vehicleKm / a.laneKm : 0),
  }));

  rows.sort((x, y) => y.loadPerLaneKm - x.loadPerLaneKm);

  return {
    rows,
    gini: round(gini(rows.map((r) => r.loadPerLaneKm)), 3),
    imbalanceRatio: round(
      rows.length > 1 && rows[rows.length - 1].loadPerLaneKm > 0
        ? rows[0].loadPerLaneKm / rows[rows.length - 1].loadPerLaneKm
        : 1,
      2
    ),
  };
}

/** Gini coefficient of a non-negative value set. */
export function gini(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return 0;
  const total = v.reduce((s, x) => s + x, 0);
  if (total === 0) return 0;
  let cum = 0;
  for (let i = 0; i < n; i += 1) cum += (i + 1) * v[i];
  return (2 * cum) / (n * total) - (n + 1) / n;
}

/** 24-hour profile of network congestion index — powers the dashboard trend chart. */
export function dailyProfile(corridors) {
  const byCode = Object.fromEntries(corridors.map((c) => [c.code, c]));
  return Array.from({ length: 24 }, (_, hour) => {
    const results = evaluateNetwork(corridors, hour);
    const s = summarise(results, byCode);
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      congestionIndex: s.congestionIndex,
      avgSpeed: s.avgSpeed,
      volume: s.totalVolume,
      delayHours: s.vehicleDelayHours,
    };
  });
}

export const helpers = { clamp, round };
