// global cache for serverless. add pool tuning when bottlenecked
import mongoose from 'mongoose';

import config from './config.js';

let cached = global._mongoose;
if (!cached) cached =global._mongoose= {conn: null};

export default async function connect() {
  if(cached.conn) return cached.conn;
  cached.conn=await mongoose.connect(config.mongoUri);
  console.log('db connected');
  return cached.conn;


}
