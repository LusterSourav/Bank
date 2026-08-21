import mongoose from 'mongoose';
import config from './config.js';
import logger from './logger.js';

mongoose.connection.on('disconnected',()=>logger.error('db disconnected'));

let cached= global._mongoose;
if(!cached) cached=global._mongoose= {conn: null};

export default async function connect(){
  if(cached.conn)return cached.conn;
  cached.conn=await mongoose.connect(config.mongoUri);
  logger.info('db connected');
  return cached.conn;
}
