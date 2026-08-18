/**
 * End-to-end verification of the SmartFlow API.
 *
 * Walks the full six-step flow the product is built around — sign in, read the
 * network, drill into a corridor, simulate, take recommendations, save, apply and
 * report — and asserts the model behaves correctly along the way (vehicles are
 * conserved under diversion, ineligible targeting is rejected, roles are enforced).
 *
 * Requires the API to be running: `npm run dev`, then `npm run verify`.
 * Everything it creates is deleted before it exits.
 */

const BASE = process.env.SMARTFLOW_API || 'http://localhost:5050/api';
let token = null;
const ok = [];
const bad = [];

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${data.error || ''}`);
  return data;
}

function check(label, cond, detail = '') {
  (cond ? ok : bad).push(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ' :: ' + detail : ''}`);
  console.log(`${cond ? '  ok ' : ' FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
}

console.log('\n=== STEP 0: health & auth ===');
const health = await call('/health');
check('health endpoint', health.ok === true);

try {
  await call('/network/meta');
  check('meta is protected', false, 'unauthenticated request succeeded');
} catch (e) {
  check('meta is protected', String(e).includes('401'));
}

try {
  await call('/auth/login', { method: 'POST', body: { email: 'commissioner@nagpur.gov.in', password: 'wrong' } });
  check('bad password rejected', false);
} catch (e) {
  check('bad password rejected', String(e).includes('401'));
}

console.log('\n=== STEP 1: login & dashboard ===');
const auth = await call('/auth/login', { method: 'POST', body: { email: 'commissioner@nagpur.gov.in', password: 'smartflow' } });
token = auth.token;
check('login returns token', !!token);
check('user role', auth.user.role === 'commissioner', auth.user.role);

const me = await call('/auth/me');
check('/auth/me round-trips', me.user.email === 'commissioner@nagpur.gov.in');

const meta = await call('/network/meta');
check('5 jurisdictions', Object.keys(meta.jurisdictions).length === 5);
check('8 strategies', meta.strategies.length === 8, `${meta.strategies.length}`);
check('2 peak windows', meta.peakWindows.length === 2);
check('eligibility map present', Object.keys(meta.eligibility).length === 8);
const elig = meta.eligibility['reversible-lane'];
check('reversible-lane restricted to 3-lane roads', elig.length > 0 && elig.length < 8, `${elig.length} corridors: ${elig.join(',')}`);

const { corridors } = await call('/network/corridors');
check('20 corridors', corridors.length === 20, `${corridors.length}`);
check('all corridors have geometry', corridors.every((c) => c.path?.length >= 3));
check('all corridors have jurisdiction', corridors.every((c) => c.jurisdiction));

const state = await call('/network/state?hour=9');
check('state returns 20 results', state.results.length === 20);
check('state in peak window at 09:00', state.inPeakWindow?.id === 'morning');
check('congestion spread is varied', new Set(state.results.map((r) => r.status)).size >= 3,
  JSON.stringify(state.summary.statusCount));
check('avg speed plausible', state.summary.avgSpeed > 20 && state.summary.avgSpeed < 55, `${state.summary.avgSpeed} km/h`);
check('avg v/c plausible', state.summary.avgVc > 0.4 && state.summary.avgVc < 1.0, `${state.summary.avgVc}`);
check('jurisdiction imbalance detected', state.jurisdiction.imbalanceRatio > 1.3,
  `${state.jurisdiction.imbalanceRatio}x, gini ${state.jurisdiction.gini}`);

const live1 = await call('/network/state?hour=9&live=1');
const live2 = await call('/network/state?hour=9&live=1');
check('live mode returns data', live1.results.length === 20);
check('off-peak is calmer than peak', (await call('/network/state?hour=3')).summary.congestionIndex < state.summary.congestionIndex);

const { profile } = await call('/network/profile');
check('24-hour profile', profile.length === 24);
const peakHours = [...profile].sort((a, b) => b.congestionIndex - a.congestionIndex).slice(0, 4).map((p) => p.hour);
check('peaks fall in managed windows', peakHours.every((h) => (h >= 8 && h <= 12) || (h >= 16 && h <= 19)), `worst hours: ${peakHours.join(',')}`);

console.log('\n=== STEP 2: corridor drill-down ===');
const worst = [...state.results].sort((a, b) => b.vc - a.vc)[0];
const detail = await call(`/network/corridors/${worst.code}?hour=9`);
check('corridor detail loads', detail.corridor.code === worst.code, worst.code);
check('corridor 24h profile', detail.profile.length === 24);
check('alternates resolved', detail.alternates.length > 0, `${detail.alternates.length} alternates`);

console.log('\n=== STEP 3+4: simulation ===');
const sim = await call('/simulations/run', {
  method: 'POST',
  body: {
    windowId: 'morning',
    selections: [
      { strategyId: 'adaptive-signals', intensity: 0.8, corridorCodes: ['KMP-01', 'AMR-E'] },
      { strategyId: 'hv-restriction', intensity: 0.9, corridorCodes: ['KMP-01', 'WRD-N'] },
    ],
  },
});
check('simulation computes fast', sim.computeMs < 500, `${sim.computeMs} ms`);
check('timeline has 12 steps (3h @ 15min)', sim.after.timeline.length === 12, `${sim.after.timeline.length}`);
check('baseline and treatment aligned', sim.before.timeline.length === sim.after.timeline.length);
check('delay reduced', sim.delta.vehicleDelayPct < 0, `${sim.delta.vehicleDelayPct}%`);
check('speed improved', sim.delta.avgSpeedPct > 0, `${sim.delta.avgSpeedPct}%`);
check('corridors improved', sim.improvedCount > 0, `${sim.improvedCount} improved, ${sim.worsenedCount} worse`);
check('comparison covers whole network', sim.comparison.length === 20);
check('capex is non-trivial', sim.economics.capexLakh > 0, `Rs ${sim.economics.capexLakh} L`);
check('payback is plausible', sim.economics.paybackMonths > 0.5 && sim.economics.paybackMonths < 120,
  `${sim.economics.paybackMonths} months`);
check('strategies recorded as applied', sim.after.applied.length === 2);

// Vehicle conservation: diversion must move traffic, not delete it.
const divert = await call('/simulations/run', {
  method: 'POST',
  body: { windowId: 'morning', selections: [{ strategyId: 'corridor-diversion', intensity: 1, corridorCodes: ['KMP-01'] }] },
});
const src = divert.comparison.find((c) => c.code === 'KMP-01');
const alts = ['KTL-01', 'KRD-01', 'CTR-01'].map((c) => divert.comparison.find((x) => x.code === c));
const removed = src.before.volume - src.after.volume;
const added = alts.reduce((s, a) => s + (a.after.volume - a.before.volume), 0);
check('diversion conserves vehicles', Math.abs(removed - added) / removed < 0.02,
  `removed ${removed}, redistributed ${added}`);
check('diversion relieves the source', src.after.vc < src.before.vc, `${src.before.vc} -> ${src.after.vc}`);

// An empty scenario must be a true no-op.
const noop = await call('/simulations/run', { method: 'POST', body: { windowId: 'morning', selections: [] } });
check('empty scenario is a no-op', Math.abs(noop.delta.vehicleDelayPct) < 0.001, `${noop.delta.vehicleDelayPct}%`);

// Ineligible targeting must be reported, not silently applied.
const inelig = await call('/simulations/run', {
  method: 'POST',
  body: { windowId: 'morning', selections: [{ strategyId: 'reversible-lane', intensity: 1, corridorCodes: ['SIT-01'] }] },
});
check('ineligible corridor is skipped', inelig.after.skipped.length > 0, inelig.after.skipped[0]?.reason);

const evening = await call('/simulations/run', {
  method: 'POST',
  body: { windowId: 'evening', selections: [{ strategyId: 'adaptive-signals', intensity: 0.8, corridorCodes: ['CAV-01'] }] },
});
check('evening window differs from morning', evening.window.startHour === 16);

console.log('\n=== STEP 5: AI recommendations ===');
const rec = await call('/simulations/recommendations?windowId=morning&limit=5');
check('recommendations returned', rec.recommendations.length > 0, `${rec.recommendations.length} of ${rec.candidatesEvaluated} candidates`);
check('ranked descending by score', rec.recommendations.every((r, i, arr) => i === 0 || arr[i - 1].score >= r.score));
check('every rec has a rationale', rec.recommendations.every((r) => r.rationale?.length > 80));
check('every rec has a positive simulated benefit', rec.recommendations.every((r) => r.expected.delayReductionPct > 0));
check('hotspots diagnosed', rec.hotspots.length > 0 && rec.hotspots.every((h) => h.primaryCause));
check('jurisdiction advisory produced', !!rec.jurisdictionAdvisory.headline, rec.jurisdictionAdvisory.severity);
check('suggested package is runnable', rec.suggestedPackage.selections.length > 0);
check('no corridor dominates shortlist', Math.max(...Object.values(
  rec.recommendations.reduce((m, r) => ({ ...m, [r.corridorCode]: (m[r.corridorCode] || 0) + 1 }), {})
)) <= 2);

// The recommended package should actually work when run.
const pkg = await call('/simulations/run', { method: 'POST', body: { windowId: 'morning', selections: rec.suggestedPackage.selections } });
check('recommended package improves the network', pkg.delta.vehicleDelayPct < 0, `${pkg.delta.vehicleDelayPct}%`);

const recPm = await call('/simulations/recommendations?windowId=evening&limit=3');
check('evening recommendations differ from morning',
  JSON.stringify(recPm.recommendations.map((r) => r.id)) !== JSON.stringify(rec.recommendations.slice(0, 3).map((r) => r.id)));

console.log('\n=== STEP 6: save, apply, report ===');
const saved = await call('/simulations', {
  method: 'POST',
  body: { name: 'E2E verification plan', windowId: 'morning', selections: rec.suggestedPackage.selections },
});
check('scenario saved', !!saved.simulation._id);
check('summary denormalised', saved.simulation.summary.vehicleDelayPct < 0);

const applied = await call(`/simulations/${saved.simulation._id}/apply`, { method: 'POST' });
check('scenario applied', applied.simulation.status === 'applied');

const list = await call('/simulations');
check('scenario appears in list', list.simulations.some((s) => s._id === saved.simulation._id));

const { report } = await call('/reports', { method: 'POST', body: { simulationId: saved.simulation._id, title: 'E2E Report' } });
check('report generated', !!report.refId, report.refId);
check('report ref format', /^SF\/NGP\/\d{4}\/\d{4}$/.test(report.refId), report.refId);
check('report freezes simulation result', !!report.payload.result?.comparison?.length);
check('report includes recommendations', report.payload.recommendations.length > 0);
check('report includes advisory', !!report.payload.jurisdictionAdvisory.headline);
check('report records preparer', report.payload.preparedBy.name === 'Dr. Anjali Deshmukh');

const fetched = await call(`/reports/${report._id}`);
check('report retrievable by id', fetched.report.refId === report.refId);

console.log('\n=== role enforcement ===');
const analyst = await call('/auth/login', { method: 'POST', body: { email: 'analyst@nmrda.gov.in', password: 'smartflow' } });
const commissionerToken = token;
token = analyst.token;
const analystSim = await call('/simulations', { method: 'POST', body: { name: 'Analyst draft', windowId: 'morning', selections: [{ strategyId: 'staggered-hours', intensity: 0.6, corridorCodes: ['GNR-01'] }] } });
check('analyst can simulate and save', !!analystSim.simulation._id);
try {
  await call(`/simulations/${analystSim.simulation._id}/apply`, { method: 'POST' });
  check('analyst blocked from applying', false, 'apply succeeded');
} catch (e) {
  check('analyst blocked from applying', String(e).includes('403'));
}
token = commissionerToken;

// cleanup
await call(`/reports/${report._id}`, { method: 'DELETE' });
await call(`/simulations/${saved.simulation._id}`, { method: 'DELETE' });
await call(`/simulations/${analystSim.simulation._id}`, { method: 'DELETE' });

console.log(`\n========================================`);
console.log(`  ${ok.length} passed, ${bad.length} failed`);
console.log(`========================================`);
if (bad.length) {
  bad.forEach((b) => console.log('  ' + b));
  process.exit(1);
}
