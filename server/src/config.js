import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Local development reads server/.env. On a hosting platform the variables are
// already in the environment and this call is a harmless no-op.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5050,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartflow',
  jwtSecret: process.env.JWT_SECRET || 'smartflow-nagpur-2026-dev-secret',
  jwtExpiry: '12h',
  clientOrigins: origins,
  /** Allow *.vercel.app preview deployments to call the API. */
  allowVercelPreviews: process.env.ALLOW_VERCEL_PREVIEWS !== 'false',
  /** Request logging is noise in serverless logs; keep it for local runs. */
  requestLogging: process.env.NODE_ENV !== 'production',
};

/** Strip credentials from a connection string before it is ever logged. */
export function redactUri(uri) {
  return String(uri).replace(/\/\/[^@/]+@/, '//***:***@');
}
