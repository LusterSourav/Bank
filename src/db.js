// Opens a single mongoose connection. Called once at startup (local) or lazily
// on first invocation (Vercel serverless).
// ponytail: global cache reuses the same connection across warm serverless
//           invocations. Add connection-pool tuning when the db becomes a bottleneck.
import mongoose from 'mongoose';
import config from './config.js';

let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null };

export default async function connect() {
  if (cached.conn) return cached.conn;
  cached.conn = await mongoose.connect(config.mongoUri);
  console.log('db connected');
  return cached.conn;
}
