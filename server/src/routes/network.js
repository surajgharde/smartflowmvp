import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getCorridors, getCorridorMap, liveOverrides, currentHour } from '../lib/network.js';
import {
  evaluateNetwork,
  evaluateCorridor,
  summarise,
  jurisdictionBalance,
  dailyProfile,
} from '../engine/trafficModel.js';
import { strategyCatalogue, eligibilityMap } from '../engine/strategies.js';
import { JURISDICTIONS, PEAK_WINDOWS, NAGPUR_CENTER, ROAD_CLASS } from '../data/nagpurNetwork.js';

export const networkRouter = Router();

networkRouter.use(requireAuth);

/** Static reference data the client needs once at boot. */
networkRouter.get('/meta', async (req, res) => {
  const corridors = await getCorridors();
  res.json({
    jurisdictions: JURISDICTIONS,
    peakWindows: PEAK_WINDOWS,
    roadClasses: ROAD_CLASS,
    center: NAGPUR_CENTER,
    strategies: strategyCatalogue(),
    eligibility: eligibilityMap(corridors),
  });
});

/** Corridor geometry + attributes for the map layer. */
networkRouter.get('/corridors', async (req, res) => {
  const corridors = await getCorridors();
  res.json({ corridors });
});

/**
 * Network state at a given hour. `live=1` layers detector noise on top so the
 * dashboard ticks; omit it for a clean, reproducible model reading.
 */
networkRouter.get('/state', async (req, res) => {
  const corridors = await getCorridors();
  const byCode = await getCorridorMap();

  const live = req.query.live === '1';
  const hour = req.query.hour != null ? Number(req.query.hour) : currentHour();
  if (!Number.isFinite(hour) || hour < 0 || hour >= 24) {
    return res.status(400).json({ error: 'hour must be between 0 and 23.99' });
  }

  const overrides = live ? liveOverrides(corridors) : {};
  const results = evaluateNetwork(corridors, hour, overrides);

  const jurisdictionFilter = req.query.jurisdiction;
  const filtered =
    jurisdictionFilter && jurisdictionFilter !== 'ALL'
      ? results.filter((r) => byCode[r.code]?.jurisdiction === jurisdictionFilter)
      : results;

  return res.json({
    hour,
    live,
    timestamp: new Date().toISOString(),
    results: filtered,
    summary: summarise(filtered, byCode),
    jurisdiction: jurisdictionBalance(results, byCode),
    inPeakWindow: PEAK_WINDOWS.find((w) => hour >= w.startHour && hour < w.endHour) || null,
  });
});

/** 24-hour city congestion profile for the dashboard trend chart. */
networkRouter.get('/profile', async (req, res) => {
  const corridors = await getCorridors();
  res.json({ profile: dailyProfile(corridors) });
});

/** One corridor in depth, including its own 24-hour curve and alternates. */
networkRouter.get('/corridors/:code', async (req, res) => {
  const byCode = await getCorridorMap();
  const corridor = byCode[req.params.code];
  if (!corridor) return res.status(404).json({ error: 'Corridor not found' });

  const hour = req.query.hour != null ? Number(req.query.hour) : currentHour();
  const profile = Array.from({ length: 24 }, (_, h) => {
    const r = evaluateCorridor(corridor, h);
    return {
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      volume: r.volume,
      vc: r.vc,
      avgSpeed: r.avgSpeed,
      congestionIndex: r.congestionIndex,
    };
  });

  return res.json({
    corridor,
    current: evaluateCorridor(corridor, Number.isFinite(hour) ? hour : 9),
    profile,
    alternates: (corridor.alternates || [])
      .map((code) => byCode[code])
      .filter(Boolean)
      .map((alt) => ({
        code: alt.code,
        name: alt.shortName,
        jurisdiction: alt.jurisdiction,
        current: evaluateCorridor(alt, Number.isFinite(hour) ? hour : 9),
      })),
  });
});
