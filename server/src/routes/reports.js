import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Report } from '../models/Report.js';
import { Simulation } from '../models/Simulation.js';
import { getCorridors } from '../lib/network.js';
import { recommend } from '../engine/recommender.js';

export const reportRouter = Router();

reportRouter.use(requireAuth);

async function nextRefId() {
  const year = new Date().getFullYear();
  const count = await Report.countDocuments();
  return `SF/NGP/${year}/${String(count + 1).padStart(4, '0')}`;
}

/** Freeze a saved scenario, plus the current advisory, into a citable report. */
reportRouter.post('/', async (req, res) => {
  const { simulationId, title } = req.body || {};
  const sim = await Simulation.findById(simulationId).lean().catch(() => null);
  if (!sim) return res.status(404).json({ error: 'Scenario not found' });

  const corridors = await getCorridors();
  const advisory = recommend(corridors, { windowId: sim.windowId, limit: 5 });

  const refId = await nextRefId();
  const doc = await Report.create({
    refId,
    title: (title && String(title).trim()) || `Traffic Management Report — ${sim.name}`,
    windowId: sim.windowId,
    simulation: sim._id,
    generatedBy: req.user._id,
    generatedByName: req.user.name,
    authority: req.user.authority,
    payload: {
      scenarioName: sim.name,
      selections: sim.selections,
      summary: sim.summary,
      result: sim.result,
      recommendations: advisory.recommendations,
      hotspots: advisory.hotspots,
      jurisdictionAdvisory: advisory.jurisdictionAdvisory,
      preparedBy: {
        name: req.user.name,
        designation: req.user.designation,
        authority: req.user.authority,
        role: req.user.role,
      },
    },
  });

  return res.status(201).json({ report: doc });
});

reportRouter.get('/', async (req, res) => {
  const docs = await Report.find().sort({ createdAt: -1 }).limit(50).select('-payload').lean();
  res.json({ reports: docs });
});

reportRouter.get('/:id', async (req, res) => {
  const doc = await Report.findById(req.params.id).lean().catch(() => null);
  if (!doc) return res.status(404).json({ error: 'Report not found' });
  return res.json({ report: doc });
});

reportRouter.delete('/:id', async (req, res) => {
  const doc = await Report.findByIdAndDelete(req.params.id).catch(() => null);
  if (!doc) return res.status(404).json({ error: 'Report not found' });
  return res.json({ ok: true });
});
