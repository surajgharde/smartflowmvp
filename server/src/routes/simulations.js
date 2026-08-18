import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getCorridors } from '../lib/network.js';
import { runSimulation } from '../engine/simulator.js';
import { recommend } from '../engine/recommender.js';
import { Simulation } from '../models/Simulation.js';

export const simulationRouter = Router();

simulationRouter.use(requireAuth);

function normaliseSelections(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && s.strategyId && Array.isArray(s.corridorCodes) && s.corridorCodes.length)
    .map((s) => ({
      strategyId: String(s.strategyId),
      intensity: Math.max(0.1, Math.min(1, Number(s.intensity ?? 0.7))),
      corridorCodes: s.corridorCodes.map(String),
    }));
}

/** Run a paired baseline/treatment simulation without persisting anything. */
simulationRouter.post('/run', async (req, res) => {
  const corridors = await getCorridors();
  const windowId = req.body?.windowId === 'evening' ? 'evening' : 'morning';
  const selections = normaliseSelections(req.body?.selections);

  const started = Date.now();
  const result = runSimulation(corridors, { windowId, selections });

  res.json({ ...result, computeMs: Date.now() - started });
});

/** Ranked, simulation-backed recommendations for a peak window. */
simulationRouter.get('/recommendations', async (req, res) => {
  const corridors = await getCorridors();
  const windowId = req.query.windowId === 'evening' ? 'evening' : 'morning';
  const limit = Math.max(1, Math.min(10, Number(req.query.limit) || 5));

  const started = Date.now();
  const out = recommend(corridors, { windowId, limit });

  res.json({ ...out, computeMs: Date.now() - started });
});

/** Save a scenario so it can be reopened, compared or turned into a report. */
simulationRouter.post('/', async (req, res) => {
  const { name, windowId, selections } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Give the scenario a name' });
  }

  const corridors = await getCorridors();
  const win = windowId === 'evening' ? 'evening' : 'morning';
  const sels = normaliseSelections(selections);
  if (!sels.length) {
    return res.status(400).json({ error: 'Select at least one strategy before saving' });
  }

  const result = runSimulation(corridors, { windowId: win, selections: sels });

  const doc = await Simulation.create({
    name: String(name).trim(),
    windowId: win,
    selections: sels,
    createdBy: req.user._id,
    createdByName: req.user.name,
    summary: {
      congestionIndexBefore: result.before.window_totals.congestionIndex,
      congestionIndexAfter: result.after.window_totals.congestionIndex,
      congestionIndexPct: result.delta.congestionIndexPct,
      avgSpeedBefore: result.before.window_totals.avgSpeed,
      avgSpeedAfter: result.after.window_totals.avgSpeed,
      avgSpeedPct: result.delta.avgSpeedPct,
      delayHoursBefore: result.before.window_totals.vehicleDelayHours,
      delayHoursAfter: result.after.window_totals.vehicleDelayHours,
      vehicleDelayPct: result.delta.vehicleDelayPct,
      co2Pct: result.delta.co2Pct,
      economicLossPct: result.delta.economicLossPct,
      capexLakh: result.economics.capexLakh,
      paybackMonths: result.economics.paybackMonths,
      deployDays: result.economics.deployDays,
      improvedCount: result.improvedCount,
      worsenedCount: result.worsenedCount,
    },
    result,
  });

  return res.status(201).json({ simulation: doc });
});

simulationRouter.get('/', async (req, res) => {
  const docs = await Simulation.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .select('-result')
    .lean();
  res.json({ simulations: docs });
});

simulationRouter.get('/:id', async (req, res) => {
  const doc = await Simulation.findById(req.params.id).lean().catch(() => null);
  if (!doc) return res.status(404).json({ error: 'Scenario not found' });
  return res.json({ simulation: doc });
});

/** Commit a scenario as the live management plan. */
simulationRouter.post('/:id/apply', requireRole('commissioner', 'engineer'), async (req, res) => {
  const doc = await Simulation.findById(req.params.id).catch(() => null);
  if (!doc) return res.status(404).json({ error: 'Scenario not found' });

  doc.status = 'applied';
  doc.appliedAt = new Date();
  await doc.save();

  return res.json({ simulation: { ...doc.toObject(), result: undefined } });
});

simulationRouter.delete('/:id', requireRole('commissioner', 'engineer'), async (req, res) => {
  const doc = await Simulation.findByIdAndDelete(req.params.id).catch(() => null);
  if (!doc) return res.status(404).json({ error: 'Scenario not found' });
  return res.json({ ok: true });
});
