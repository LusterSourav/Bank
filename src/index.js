// Local dev entry. Imports the Express app, connects to MongoDB, then listens.
// For Vercel, see api/index.js instead.
import app from './app.js';
import connect from './db.js';
import config from './config.js';

await connect();
app.listen(config.port, () => console.log(`listening on ${config.port}`));
