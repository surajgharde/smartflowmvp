import mongoose from 'mongoose';
import { config } from './config.js';

/**
 * Serverless-safe MongoDB connection.
 *
 * On Vercel every request may land on a fresh function invocation, but warm
 * instances are reused. Calling `mongoose.connect()` per request would open a
 * new pool each time and exhaust the Atlas connection limit within minutes.
 *
 * The connection promise is therefore cached on `globalThis`, which survives
 * across invocations on a warm instance. Concurrent callers share the single
 * in-flight promise rather than racing to open their own connection.
 */
const cache = (globalThis.__smartflowMongo ??= { conn: null, promise: null });

mongoose.set('strictQuery', true);

export async function connectDb() {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(config.mongoUri, {
        serverSelectionTimeoutMS: 10000,
        // A serverless instance handles one request at a time, so a large pool
        // buys nothing and costs Atlas connections.
        maxPoolSize: 5,
        minPoolSize: 0,
      })
      .then((m) => m.connection);
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Clear the rejected promise so the next request can retry instead of
    // replaying the same failure forever on this warm instance.
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}

export async function disconnectDb() {
  if (cache.conn) await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
}
