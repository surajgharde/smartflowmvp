import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: Number(process.env.PORT) || 5050,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartflow',
  jwtSecret: process.env.JWT_SECRET || 'smartflow-nagpur-2026-dev-secret',
  jwtExpiry: '12h',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
