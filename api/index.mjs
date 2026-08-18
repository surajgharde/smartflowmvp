/**
 * Vercel serverless entry point for the SmartFlow API.
 *
 * `vercel.json` rewrites every `/api/*` request here, and Vercel preserves the
 * original path on `req.url`, so the Express router matches exactly as it does
 * when the server runs standalone.
 *
 * The `.mjs` extension is deliberate: the repository root has no
 * `"type": "module"`, so a plain `.js` file here would be treated as CommonJS
 * and could not import the ESM server code.
 */

import app from '../server/src/app.js';
import { connectDb } from '../server/src/db.js';
import { config, redactUri } from '../server/src/config.js';

/**
 * Held at module scope so a warm instance connects once and every later request
 * reuses it. `connectDb` itself clears this on failure, so a transient Atlas
 * outage does not permanently poison the instance.
 */
let connecting = null;

export default async function handler(req, res) {
  try {
    connecting ??= connectDb();
    await connecting;
  } catch (err) {
    connecting = null;
    console.error('[smartflow] MongoDB unreachable at', redactUri(config.mongoUri), '—', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error:
          'Database unavailable. Check the MONGO_URI environment variable and that Atlas Network Access allows connections from anywhere (0.0.0.0/0).',
      })
    );
    return;
  }

  return app(req, res);
}
