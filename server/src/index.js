import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { config } from './config.js';
import { connectDb } from './db.js';
import { authRouter } from './routes/auth.js';
import { networkRouter } from './routes/network.js';
import { simulationRouter } from './routes/simulations.js';
import { reportRouter } from './routes/reports.js';

const app = express();

app.use(cors({ origin: [config.clientOrigin, 'http://127.0.0.1:5173'], credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'smartflow-api', time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/network', networkRouter);
app.use('/api/simulations', simulationRouter);
app.use('/api/reports', reportRouter);

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[smartflow]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

/**
 * Strip credentials out of a connection string before it is logged. The console
 * ends up in terminals, CI logs and on a projector during a demo — none of which
 * should ever see the database password.
 */
function redactUri(uri) {
  return String(uri).replace(/\/\/[^@/]+@/, '//***:***@');
}

async function start() {
  try {
    await connectDb();
    console.log(`[smartflow] MongoDB connected → ${redactUri(config.mongoUri)}`);
  } catch (err) {
    console.error('\n[smartflow] Could not reach MongoDB at', redactUri(config.mongoUri));
    console.error('[smartflow] Start MongoDB, then run `npm run seed` and try again.\n');
    console.error(err.message);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`[smartflow] API listening on http://localhost:${config.port}`);
  });

  // Without this, a port clash surfaces as an unhandled 'error' event and a stack
  // trace. During a demo the useful thing to see is how to free the port.
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[smartflow] Port ${config.port} is already in use.`);
      console.error('[smartflow] Another SmartFlow server is probably still running.');
      console.error('[smartflow] Free it with:');
      console.error(`[smartflow]   Windows  npx kill-port ${config.port}`);
      console.error(`[smartflow]   macOS/Linux  lsof -ti:${config.port} | xargs kill`);
      console.error(`[smartflow] Or set a different PORT in server/.env\n`);
    } else {
      console.error('[smartflow] Server failed to start:', err.message);
    }
    process.exit(1);
  });
}

start();
