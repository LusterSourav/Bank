// Opens a single mongoose connection. Called once at startup.
// ponytail: no connection pool tuning, no replica-set awareness. Add those when
//           the db becomes a bottleneck.
import mongoose from 'mongoose';
import config from './config.js';

export default async function connect() {
  await mongoose.connect(config.mongoUri);
  console.log('db connected');
}
