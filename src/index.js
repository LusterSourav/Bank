import app from './app.js';
import mongoose from 'mongoose';
import connect from './db.js';
import config from './config.js';
import{startWatching,stopWatching}from './watcher.js';
import logger from './logger.js';
import{check}from './license.js';

check();
await connect();
startWatching();
const srv=app.listen(config.port,()=> logger.info({port:config.port}, 'server listening'));

process.on('SIGTERM',async()=>{
  logger.info('sigterm received shutting down');
  stopWatching();
  await mongoose.disconnect();
  srv.close(()=>process.exit(0));
});
