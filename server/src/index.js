/**
 * Standalone server entry point — used for local development and for any host
 * that runs a long-lived Node process (Render, Railway, Fly, a VM).
 *
 * On Vercel this file is not used; `api/index.mjs` drives the same app instead.
 */

import app from './app.js';
import { config, redactUri } from './config.js';
import { connectDb } from './db.js';

async function start() {
  try {
    await connectDb();
    console.log(`[smartflow] MongoDB connected → ${redactUri(config.mongoUri)}`);
  } catch (err) {
    console.error('\n[smartflow] Could not reach MongoDB at', redactUri(config.mongoUri));
    console.error('[smartflow] Check MONGO_URI in server/.env, then run `npm run seed`.\n');
    console.error(err.message);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`[smartflow] API listening on http://localhost:${config.port}`);
  });

  // Without this, a port clash surfaces as an unhandled 'error' event and a
  // stack trace. During a demo the useful thing to see is how to free the port.
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[smartflow] Port ${config.port} is already in use.`);
      console.error('[smartflow] Another SmartFlow server is probably still running.');
      console.error('[smartflow] Free it with:');
      console.error(`[smartflow]   Windows      npx kill-port ${config.port}`);
      console.error(`[smartflow]   macOS/Linux  lsof -ti:${config.port} | xargs kill`);
      console.error('[smartflow] Or set a different PORT in server/.env\n');
    } else {
      console.error('[smartflow] Server failed to start:', err.message);
    }
    process.exit(1);
  });
}

start();
