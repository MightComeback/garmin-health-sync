import Database from 'better-sqlite3';
import http from 'node:http';

const DB_PATH = process.env.GARMIN_DB_PATH || './garmin.sqlite';
const PORT = Number(process.env.GARMIN_SYNC_PORT || 17890);

const db = new Database(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    startTime TEXT,
    type TEXT,
    name TEXT,
    distanceMeters REAL,
    durationSeconds REAL,
    calories REAL,
    rawJson TEXT
  );

  CREATE TABLE IF NOT EXISTS daily_metrics (
    day TEXT PRIMARY KEY,
    steps INTEGER,
    restingHeartRate INTEGER,
    bodyBattery INTEGER,
    sleepSeconds INTEGER,
    hrvStatus TEXT,
    rawJson TEXT
  );
`);

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, db: DB_PATH });
  }

  if (req.method === 'GET' && url.pathname === '/activities') {
    const rows = db.prepare('SELECT id, provider, startTime, type, name, distanceMeters, durationSeconds, calories FROM activities ORDER BY startTime DESC LIMIT 100').all();
    return json(res, 200, { items: rows });
  }

  if (req.method === 'GET' && url.pathname === '/daily') {
    const rows = db.prepare('SELECT day, steps, restingHeartRate, bodyBattery, sleepSeconds, hrvStatus FROM daily_metrics ORDER BY day DESC LIMIT 60').all();
    return json(res, 200, { items: rows });
  }

  return json(res, 404, { error: 'not_found' });
});

server.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`garmin-health-sync listening on http://127.0.0.1:${PORT} (db: ${DB_PATH})`);
  console.log('Next: implement Garmin Connect login + puller, then write into SQLite.');
});
