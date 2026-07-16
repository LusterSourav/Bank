// local dev entry — for vercel see api/index.js
import app from './app.js';

import connect from './db.js';
import config from './config.js';

import { startWatching } from './watcher.js';

await connect();
startWatching();
app.listen(config.port, () => console.log(`listening on ${config.port}`));
