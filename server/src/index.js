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

async function start() {
  try {
    await connectDb();
    console.log(`[smartflow] MongoDB connected → ${config.mongoUri}`);
  } catch (err) {
    console.error('\n[smartflow] Could not reach MongoDB at', config.mongoUri);
    console.error('[smartflow] Start MongoDB, then run `npm run seed` and try again.\n');
    console.error(err.message);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`[smartflow] API listening on http://localhost:${config.port}`);
  });
}

start();
