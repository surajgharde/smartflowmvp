/**
 * SmartFlow recommendation engine.
 *
 * This is not a text generator dressed up as analysis. It works the way a traffic
 * consultant does:
 *
 *   1. DIAGNOSE  — classify why each congested corridor is failing (signal-bound,
 *                  capacity-bound, heavy-vehicle-bound, peaked, divertible...).
 *   2. SWEEP     — for every diagnosis, actually run the strategies that treat it
 *                  through the full network simulation. Nothing is estimated by
 *                  a lookup table; every number quoted is a simulated outcome.
 *   3. RANK      — score candidates on delay reduction, cost-effectiveness,
 *                  deployment lead time and how well they match the diagnosis.
 *   4. EXPLAIN   — write the rationale from the evidence that produced the score.
 *
 * It also audits jurisdiction load balance, which is the specific problem the
 * platform exists to solve.
 */

import { STRATEGIES, STRATEGY_BY_ID } from './strategies.js';
import { runScenario, resolveWindow } from './simulator.js';
import { JURISDICTIONS } from '../data/nagpurNetwork.js';

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Intensity used for the candidate sweep — a realistic, fundable deployment level. */
const SWEEP_INTENSITY = 0.8;

/** A corridor enters the candidate pool once it reaches this saturation. */
const ATTENTION_VC = 0.72;

/**
 * Classify why a corridor is failing. Returns weighted tags that strategies
 * declare they can treat.
 */
export function diagnose(corridor, result) {
  const tags = {};
  const evidence = [];

  const signalShare = result.travelTimeMin > 0 ? result.signalDelayMin / result.travelTimeMin : 0;
  if (signalShare > 0.4 && corridor.signals >= 3) {
    tags.signalBound = clamp((signalShare - 0.4) / 0.35, 0.2, 1);
    evidence.push(
      `${Math.round(signalShare * 100)}% of corridor travel time is spent stopped at its ${corridor.signals} signals`
    );
  }

  if (result.vc > 0.9) {
    tags.capacityBound = clamp((result.vc - 0.9) / 0.4, 0.2, 1);
    evidence.push(
      `demand is at ${Math.round(result.vc * 100)}% of capacity (${result.pcuVolume.toLocaleString('en-IN')} PCU/hr against ${result.capacity.toLocaleString('en-IN')})`
    );
  }

  const pcuInflation = result.volume > 0 ? result.pcuVolume / result.volume - 1 : 0;
  if (corridor.heavyPct >= 0.14 && pcuInflation > 0.25) {
    tags.heavyBound = clamp((corridor.heavyPct - 0.12) / 0.2, 0.2, 1);
    evidence.push(
      `heavy vehicles are ${Math.round(corridor.heavyPct * 100)}% of the flow but consume ${Math.round(pcuInflation * 100)}% extra road space`
    );
  }

  if (corridor.transitShare >= 0.14) {
    tags.transitOpportunity = clamp(corridor.transitShare / 0.25, 0.2, 1);
    evidence.push(`${Math.round(corridor.transitShare * 100)}% of trips here already use public transport`);
  }

  const alternates = corridor.alternates || [];
  if (alternates.length) {
    tags.divertible = clamp(alternates.length / 3, 0.3, 1);
  }

  if (corridor.lanes >= 3) {
    tags.directional = 0.7;
  }

  // Sharp twin peaks respond well to demand-spreading policy.
  tags.peaked = corridor.peakBias === 'BAL' ? 0.4 : 0.75;

  return { tags, evidence, signalShare: round(signalShare, 3) };
}

/** Build the candidate (corridor, strategy) pairs worth simulating. */
function buildCandidates(corridors, baselineResults) {
  const resultByCode = Object.fromEntries(baselineResults.map((r) => [r.code, r]));
  const candidates = [];

  const hotspots = corridors
    .filter((c) => (resultByCode[c.code]?.vc ?? 0) >= ATTENTION_VC)
    .sort((a, b) => resultByCode[b.code].vc - resultByCode[a.code].vc);

  for (const corridor of hotspots) {
    const result = resultByCode[corridor.code];
    const { tags, evidence } = diagnose(corridor, result);

    for (const strategy of STRATEGIES) {
      if (!strategy.requires(corridor)) continue;
      const fit = strategy.treats.reduce((s, tag) => s + (tags[tag] || 0), 0) / strategy.treats.length;
      if (fit < 0.2) continue;
      candidates.push({ corridor, strategy, result, fit: round(fit, 3), tags, evidence });
    }
  }

  return { candidates, hotspots };
}

/**
 * Score a simulated candidate. Weighting reflects how an authority actually
 * chooses: relief first, then value for money, then how fast it can be live.
 */
function scoreCandidate({ fit, delayReductionPct, corridorIndexDrop, costLakh, deployDays, worsened }) {
  const relief = clamp(delayReductionPct / 25, 0, 1); // 25% network delay cut = full marks
  const local = clamp(corridorIndexDrop / 30, 0, 1);
  const value = clamp(delayReductionPct / Math.max(2, costLakh) / 0.35, 0, 1);
  const speed = clamp(1 - deployDays / 120, 0, 1);
  const spillover = clamp(1 - worsened / 4, 0, 1);

  return round(
    100 * (0.34 * relief + 0.2 * local + 0.2 * value + 0.13 * speed + 0.08 * fit + 0.05 * spillover),
    1
  );
}

function writeRationale(candidate, outcome) {
  const { corridor, strategy, result, evidence } = candidate;
  const lead = evidence.length
    ? `${corridor.shortName} is failing because ${evidence.slice(0, 2).join(', and ')}.`
    : `${corridor.shortName} is running at ${Math.round(result.vc * 100)}% of capacity in this window.`;

  const action = `${strategy.name} directly targets that: ${strategy.tagline.toLowerCase()}.`;

  const effect =
    `Simulated across the window it lifts corridor speed from ${result.avgSpeed} to ${outcome.corridorAfter.avgSpeed} km/h ` +
    `(${outcome.corridorAfter.los === result.los ? `LOS stays ${result.los}` : `LOS ${result.los} to ${outcome.corridorAfter.los}`}) ` +
    `and cuts network vehicle-delay by ${Math.abs(outcome.delayReductionPct)}%.`;

  const money =
    outcome.paybackMonths != null
      ? `At Rs ${outcome.costLakh} lakh capex it pays back in about ${outcome.paybackMonths} months and can be live in ${strategy.deployDays} days.`
      : `Capex is Rs ${outcome.costLakh} lakh with a ${strategy.deployDays}-day lead time.`;

  const caution =
    outcome.worsened > 0
      ? ` Watch the spillover: ${outcome.worsened} neighbouring corridor${outcome.worsened > 1 ? 's' : ''} absorb${outcome.worsened > 1 ? '' : 's'} displaced traffic.`
      : '';

  return `${lead} ${action} ${effect} ${money}${caution}`;
}

/**
 * Produce ranked recommendations for a peak window.
 * @returns {{ recommendations: Array, hotspots: Array, jurisdictionAdvisory: Object, package: Object }}
 */
export function recommend(corridors, { windowId = 'morning', limit = 5 } = {}) {
  const win = resolveWindow(windowId);
  const baseline = runScenario(corridors, win, []);
  const baselineByCode = Object.fromEntries(baseline.corridors.map((r) => [r.code, r]));

  const { candidates, hotspots } = buildCandidates(corridors, baseline.corridors);

  const scored = [];
  for (const candidate of candidates) {
    const selections = [
      {
        strategyId: candidate.strategy.id,
        intensity: SWEEP_INTENSITY,
        corridorCodes: [candidate.corridor.code],
      },
    ];
    const trial = runScenario(corridors, win, selections);

    const before = baseline.window_totals;
    const after = trial.window_totals;
    const delayReductionPct =
      before.vehicleDelayHours > 0
        ? round(((before.vehicleDelayHours - after.vehicleDelayHours) / before.vehicleDelayHours) * 100, 1)
        : 0;

    // Only propose things that actually help the network.
    if (delayReductionPct <= 0.3) continue;

    const corridorAfter = trial.corridors.find((c) => c.code === candidate.corridor.code);
    const corridorIndexDrop = round(candidate.result.congestionIndex - corridorAfter.congestionIndex, 1);

    const worsened = trial.corridors.filter((c) => {
      const b = baselineByCode[c.code];
      return c.code !== candidate.corridor.code && c.congestionIndex > b.congestionIndex + 1.5;
    }).length;

    const costLakh = trial.totalCostLakh;
    const savingPerWindow = Math.max(0, before.economicLossInr - after.economicLossInr);
    const annualSaving = savingPerWindow * 250;
    const paybackMonths =
      annualSaving > 0 ? round(((costLakh * 100000) / annualSaving) * 12, 1) : null;

    const score = scoreCandidate({
      fit: candidate.fit,
      delayReductionPct,
      corridorIndexDrop,
      costLakh,
      deployDays: candidate.strategy.deployDays,
      worsened,
    });

    const outcome = {
      delayReductionPct,
      corridorIndexDrop,
      corridorAfter,
      costLakh,
      paybackMonths,
      worsened,
      speedGainPct:
        candidate.result.avgSpeed > 0
          ? round(((corridorAfter.avgSpeed - candidate.result.avgSpeed) / candidate.result.avgSpeed) * 100, 1)
          : 0,
      co2ReductionKg: round(before.co2Kg - after.co2Kg, 1),
      annualSavingLakh: round(annualSaving / 100000, 1),
    };

    scored.push({
      id: `${candidate.corridor.code}::${candidate.strategy.id}`,
      corridorCode: candidate.corridor.code,
      corridorName: candidate.corridor.shortName,
      jurisdiction: candidate.corridor.jurisdiction,
      strategyId: candidate.strategy.id,
      strategyName: candidate.strategy.name,
      strategyShort: candidate.strategy.short,
      icon: candidate.strategy.icon,
      category: candidate.strategy.category,
      intensity: SWEEP_INTENSITY,
      score,
      confidence: round(clamp(0.55 + score / 240 + candidate.fit * 0.12, 0.5, 0.96), 2),
      priority: candidate.result.vc >= 1 ? 'Critical' : candidate.result.vc >= 0.85 ? 'High' : 'Medium',
      diagnosis: candidate.evidence,
      rationale: writeRationale(candidate, outcome),
      baseline: {
        vc: candidate.result.vc,
        los: candidate.result.los,
        avgSpeed: candidate.result.avgSpeed,
        congestionIndex: candidate.result.congestionIndex,
        delayMin: candidate.result.delayMin,
      },
      expected: outcome,
      deployDays: candidate.strategy.deployDays,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  // Deduplicate so one corridor cannot monopolise the shortlist: at most two
  // recommendations per corridor, best-scoring first.
  const perCorridor = {};
  const recommendations = [];
  for (const rec of scored) {
    perCorridor[rec.corridorCode] = (perCorridor[rec.corridorCode] || 0) + 1;
    if (perCorridor[rec.corridorCode] > 2) continue;
    recommendations.push(rec);
    if (recommendations.length >= limit) break;
  }

  return {
    windowId: win.id,
    window: baseline.window,
    generatedAt: new Date().toISOString(),
    baselineSummary: baseline.window_totals,
    candidatesEvaluated: candidates.length,
    recommendations,
    hotspots: hotspots.slice(0, 8).map((c) => {
      const r = baselineByCode[c.code];
      const d = diagnose(c, r);
      return {
        code: c.code,
        name: c.shortName,
        jurisdiction: c.jurisdiction,
        vc: r.vc,
        los: r.los,
        status: r.status,
        avgSpeed: r.avgSpeed,
        congestionIndex: r.congestionIndex,
        queueMetres: r.queueMetres,
        delayMin: r.delayMin,
        primaryCause: primaryCause(d.tags),
        evidence: d.evidence,
      };
    }),
    jurisdictionAdvisory: jurisdictionAdvisory(baseline.jurisdiction),
    /** A ready-to-run package of the top non-overlapping recommendations. */
    suggestedPackage: buildPackage(recommendations),
  };
}

const CAUSE_LABEL = {
  capacityBound: 'Capacity shortfall',
  signalBound: 'Signal delay',
  heavyBound: 'Heavy vehicle load',
  peaked: 'Sharp peaking',
  transitOpportunity: 'Low mode shift',
  divertible: 'Divertible demand',
  directional: 'Directional imbalance',
};

function primaryCause(tags) {
  const priority = ['capacityBound', 'signalBound', 'heavyBound', 'peaked'];
  for (const key of priority) {
    if (tags[key] >= 0.3) return CAUSE_LABEL[key];
  }
  const best = Object.entries(tags).sort((a, b) => b[1] - a[1])[0];
  return best ? CAUSE_LABEL[best[0]] || 'Mixed' : 'Mixed';
}

/**
 * Audit how evenly the peak burden falls across planning authorities and say
 * what to do about it. This is the direct answer to the problem statement.
 */
export function jurisdictionAdvisory(balance) {
  const rows = balance.rows;
  if (!rows.length) return { severity: 'none', headline: 'No network data', notes: [] };

  const worst = rows[0];
  const best = rows[rows.length - 1];
  const gini = balance.gini;

  // Severity keys off the worst-to-best load ratio rather than the Gini alone:
  // with only five authorities the Gini is numerically small even when one body
  // is carrying twice the burden of another, which is the case that matters.
  const ratio = balance.imbalanceRatio;
  const severity = ratio >= 2.2 || gini >= 0.25 ? 'high' : ratio >= 1.55 || gini >= 0.12 ? 'moderate' : 'low';

  const headline =
    severity === 'low'
      ? 'Peak burden is reasonably balanced across planning authorities'
      : `${JURISDICTIONS[worst.jurisdiction]?.name || worst.jurisdiction} is absorbing a disproportionate share of the peak`;

  const notes = [
    `${JURISDICTIONS[worst.jurisdiction]?.code || worst.jurisdiction} carries ${worst.loadPerLaneKm.toLocaleString('en-IN')} vehicle-km per lane-km of road it owns — ${balance.imbalanceRatio}x what ${JURISDICTIONS[best.jurisdiction]?.code || best.jurisdiction} carries.`,
    `Load-distribution Gini across the ${rows.length} authorities is ${gini} (0 = perfectly even, 1 = fully concentrated).`,
  ];

  if (worst.severeCorridors > 0) {
    notes.push(
      `${worst.severeCorridors} of ${JURISDICTIONS[worst.jurisdiction]?.code || worst.jurisdiction}'s ${worst.corridors} corridors are already at Level of Service F in this window.`
    );
  }

  if (severity !== 'low') {
    notes.push(
      `Recommended: a joint ${JURISDICTIONS[worst.jurisdiction]?.code || worst.jurisdiction}-${JURISDICTIONS[best.jurisdiction]?.code || best.jurisdiction} diversion agreement so peak demand can be routed across the jurisdiction boundary, and align the peak-hour signal plan across both networks.`
    );
  }

  return { severity, headline, notes, gini, imbalanceRatio: balance.imbalanceRatio, rows };
}

/**
 * Greedy package: take the best recommendation per corridor, cap at four so the
 * combined proposal stays fundable and reviewable.
 */
function buildPackage(recommendations) {
  const seenCorridor = new Set();
  const picks = [];
  for (const rec of recommendations) {
    if (seenCorridor.has(rec.corridorCode)) continue;
    seenCorridor.add(rec.corridorCode);
    picks.push(rec);
    if (picks.length >= 4) break;
  }

  return {
    selections: picks.map((r) => ({
      strategyId: r.strategyId,
      intensity: r.intensity,
      corridorCodes: [r.corridorCode],
    })),
    labels: picks.map((r) => `${r.strategyShort} on ${r.corridorName}`),
    estimatedCostLakh: round(
      picks.reduce((s, r) => s + r.expected.costLakh, 0),
      1
    ),
    maxDeployDays: picks.reduce((m, r) => Math.max(m, r.deployDays), 0),
  };
}

export { STRATEGY_BY_ID };
