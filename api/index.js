// Vercel serverless entry. Lazily connects to MongoDB on first call, then
// delegates to the Express app for route handling.
// ponytail: async wrapper because top-level await in Vercel Node runtime is
//           unreliable. The `connected` flag ensures one connection per warm
//           invocation.
import app from '../src/app.js';
import connect from '../src/db.js';

let connected = false;

export default async function handler(req, res) {
  if (!connected) { await connect(); connected = true; }
  app(req, res);
}
