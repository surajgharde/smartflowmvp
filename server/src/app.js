/**
 * The Express application, with no server attached.
 *
 * Kept separate from `index.js` so the same app can be driven two ways:
 *   - `index.js`   binds it to a port for local development
 *   - `api/index.mjs` hands it straight to Vercel's serverless runtime
 *
 * Nothing in here may call `listen()` or `process.exit()` — in a serverless
 * environment there is no long-lived process to own either.
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { networkRouter } from './routes/network.js';
import { simulationRouter } from './routes/simulations.js';
import { reportRouter } from './routes/reports.js';

export const app = express();

// Behind Vercel's proxy, trust the forwarded headers so req.protocol/ip are real.
app.set('trust proxy', 1);

/**
 * When the API is deployed alongside the client (the default), every request is
 * same-origin and CORS never fires. The allow-list only matters if the API is
 * hosted separately — set CLIENT_ORIGIN to a comma-separated list of front-end
 * origins in that case.
 */
app.use(
  cors({
    origin(origin, callback) {
      // Same-origin requests and curl/server-to-server calls have no Origin header.
      if (!origin) return callback(null, true);
      if (config.clientOrigins.includes(origin)) return callback(null, true);
      // Vercel gives every deployment a preview URL; allow them for this project.
      if (config.allowVercelPreviews && /^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);

/**
 * Body parsing, defensively.
 *
 * Vercel's Node runtime parses JSON bodies itself and hands the function a
 * ready-made `req.body`. Running `express.json()` after that reads an
 * already-consumed stream, which resolves to an empty object and silently wipes
 * the payload — logins and simulation runs would arrive with no data.
 *
 * So: parse only when the platform has not already done it.
 */
const jsonParser = express.json({ limit: '4mb' });
app.use((req, res, next) => {
  if (req.body !== undefined && req.body !== null) return next();
  return jsonParser(req, res, next);
});

if (config.requestLogging) app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'smartflow-api',
    env: config.env,
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/network', networkRouter);
app.use('/api/simulations', simulationRouter);
app.use('/api/reports', reportRouter);

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[smartflow]', err);
  const status = /CORS/.test(err.message) ? 403 : err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

export default app;
