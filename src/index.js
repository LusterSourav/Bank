// local dev entry, for vercel see api/index.js
import app from './app.js';
import mongoose from 'mongoose';
import connect from './db.js';
import config from './config.js';
import{startWatching,stopWatching}from './watcher.js';

await connect();
startWatching();
const srv=app.listen(config.port,()=> console.log(`listening on ${config.port}`));

process.on('SIGTERM',async()=>{
  console.log('sigterm recieved, shutting down');
  stopWatching();
  await mongoose.disconnect();
  srv.close(()=>process.exit(0));
});
