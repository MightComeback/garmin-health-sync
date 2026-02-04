import Database from 'better-sqlite3';
import http from 'node:http';
import { SyncScheduler } from './scheduler';

const DB_PATH = process.env.GARMIN_DB_PATH || './garmin.sqlite';
const PORT = Number(process.env.GARMIN_SYNC_PORT || 17890);
const GARMIN_USERNAME = process.env.GARMIN_USERNAME || '';
const GARMIN_PASSWORD = process.env.GARMIN_PASSWORD || '';
const AUTO_SYNC_INTERVAL = process.env.GARMIN_AUTO_SYNC_INTERVAL 
  ? parseInt(process.env.GARMIN_AUTO_SYNC_INTERVAL, 10) * 60 * 60 * 1000 // Convert hours to ms
  : 0; // 0 = disabled

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
    averageHR INTEGER,
    maxHR INTEGER,
    averageSpeed REAL,
    maxSpeed REAL,
    elevationGain REAL,
    elevationLoss REAL,
    description TEXT,
    locationName TEXT,
    rawJson TEXT
  );

  CREATE TABLE IF NOT EXISTS daily_metrics (
    day TEXT PRIMARY KEY,
    steps INTEGER,
    restingHeartRate INTEGER,
    bodyBattery INTEGER,
    sleepSeconds INTEGER,
    sleepScore INTEGER,
    deepSleepSeconds INTEGER,
    lightSleepSeconds INTEGER,
    remSleepSeconds INTEGER,
    awakeSleepSeconds INTEGER,
    avgSpO2 REAL,
    avgRespiration REAL,
    avgStressLevel INTEGER,
    hrvStatus TEXT,
    rawJson TEXT
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    startedAt TEXT NOT NULL,
    endedAt TEXT,
    status TEXT NOT NULL,
    details TEXT
  );
`);

type GarminActivity = {
  activityId: number;
  activityName: string;
  startTimeLocal: string;
  duration: number;
  distance?: number;
  calories?: number;
  activityType?: { typeKey: string };
};

type GarminActivityDetail = {
  activityId: number;
  activityName: string;
  description?: string;
  locationName?: string;
  averageHR?: number;
  maxHR?: number;
  averageSpeed?: number;
  maxSpeed?: number;
  elevationGain?: number;
  elevationLoss?: number;
};

type DailySummary = {
  calendarDate: string;
  steps: number;
  restingHeartRate?: number;
  bodyBattery?: { lastDayValue?: number };
  sleepTimeInSeconds?: number;
  hrvStatus?: string;
};

type SleepData = {
  dailySleepDTO?: {
    sleepTimeSeconds?: number;
    deepSleepSeconds?: number;
    lightSleepSeconds?: number;
    remSleepSeconds?: number;
    awakeSleepSeconds?: number;
    averageSpO2Value?: number;
    averageRespirationValue?: number;
    sleepScore?: { value?: number };
  };
};

type BodyBatteryData = {
  bodyBatteryValuesArray?: Array<{
    date: string;
    values: Array<{ value: number }>;
  }>;
};

type StressData = {
  stressValuesArray?: Array<{
    date: string;
    values: Array<{ value: number }>;
  }>;
  avgStressLevel?: number;
};

class GarminConnectClient {
  private baseUrl = 'https://connect.garmin.com';
  private sessionCookies: string = '';
  private authed: boolean = false;

  async login(username: string, password: string): Promise<boolean> {
    try {
      // Step 1: Get login page to extract CSRF token
      const loginPage = await fetch(`${this.baseUrl}/signin`, {
        redirect: 'manual',
      });
      const cookies = loginPage.headers.get('set-cookie') || '';
      
      // Step 2: Post credentials to signin endpoint
      const signinUrl = `https://sso.garmin.com/sso/signin?service=${encodeURIComponent(this.baseUrl)}&clientId=GarminConnect&consumeServiceTicket=false`;
      
      const loginRes = await fetch(signinUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'cookie': cookies,
        },
        body: new URLSearchParams({
          username,
          password,
          embed: 'false',
        }),
        redirect: 'manual',
      });

      // Step 3: Extract ticket from response and validate
      const body = await loginRes.text();
      const ticketMatch = body.match(/ticket=([^"]+)/);
      
      if (!ticketMatch) {
        console.error('Garmin login: no ticket found');
        return false;
      }

      const ticket = ticketMatch[1];
      
      // Step 4: Validate ticket to establish session
      const validateRes = await fetch(`${this.baseUrl}/services/auth/validate-ticket?ticket=${ticket}`, {
        redirect: 'manual',
      });

      const sessionCookies = validateRes.headers.get('set-cookie');
      if (sessionCookies) {
        this.sessionCookies = sessionCookies;
        this.authed = true;
        
        // Store session in DB
        db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
          'garmin_session',
          JSON.stringify({ cookies: this.sessionCookies, timestamp: Date.now() })
        );
        
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Garmin login error:', err);
      return false;
    }
  }

  loadSessionFromDb(): boolean {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'garmin_session'").get() as { value: string } | undefined;
    if (row) {
      try {
        const session = JSON.parse(row.value);
        // Sessions expire after 7 days
        if (Date.now() - session.timestamp < 7 * 24 * 60 * 60 * 1000) {
          this.sessionCookies = session.cookies;
          this.authed = true;
          return true;
        }
      } catch {
        // Invalid session, will re-auth
      }
    }
    return false;
  }

  private async request(endpoint: string): Promise<unknown> {
    if (!this.authed) {
      throw new Error('Not authenticated');
    }

    const url = `${this.baseUrl}/modern/proxy${endpoint}`;
    const res = await fetch(url, {
      headers: {
        'cookie': this.sessionCookies,
        'nk': 'NT', // Required header for Garmin API
      },
    });

    if (res.status === 401 || res.status === 403) {
      this.authed = false;
      throw new Error('Session expired');
    }

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    return res.json();
  }

  async getActivities(limit: number = 20): Promise<GarminActivity[]> {
    const data = await this.request(`/activitylist-service/activities/search/activities?start=0&limit=${limit}`);
    return data as GarminActivity[];
  }

  async getActivityDetail(activityId: number): Promise<GarminActivityDetail | null> {
    try {
      const data = await this.request(`/activity-service/activity/${activityId}`);
      return data as GarminActivityDetail;
    } catch {
      return null;
    }
  }

  async getDailySummary(date: string): Promise<DailySummary | null> {
    try {
      const data = await this.request(`/wellness-service/wellness/dailySummary/${date}`);
      return data as DailySummary;
    } catch {
      return null;
    }
  }

  async getHrvData(date: string): Promise<{ status: string } | null> {
    try {
      const data = await this.request(`/hrv-service/hrv/${date}`);
      return data as { status: string };
    } catch {
      return null;
    }
  }

  async getSleepData(date: string): Promise<SleepData | null> {
    try {
      const data = await this.request(`/wellness-service/wellness/dailySleep/${date}`);
      return data as SleepData;
    } catch {
      return null;
    }
  }

  async getBodyBatteryData(date: string): Promise<BodyBatteryData | null> {
    try {
      const data = await this.request(`/wellness-service/wellness/dailyBodyBattery/${date}`);
      return data as BodyBatteryData;
    } catch {
      return null;
    }
  }

  async getStressData(date: string): Promise<StressData | null> {
    try {
      const data = await this.request(`/wellness-service/wellness/dailyStress/${date}`);
      return data as StressData;
    } catch {
      return null;
    }
  }
}

const garmin = new GarminConnectClient();

async function syncGarminData(): Promise<{ activities: number; days: number }> {
  // Ensure authenticated
  if (!garmin.loadSessionFromDb()) {
    if (!GARMIN_USERNAME || !GARMIN_PASSWORD) {
      throw new Error('GARMIN_USERNAME and GARMIN_PASSWORD env vars required');
    }
    const authed = await garmin.login(GARMIN_USERNAME, GARMIN_PASSWORD);
    if (!authed) {
      throw new Error('Garmin authentication failed');
    }
  }

  let activitiesSynced = 0;
  let daysSynced = 0;

  // Sync recent activities
  const activities = await garmin.getActivities(50);
  const insertActivity = db.prepare(`
    INSERT OR REPLACE INTO activities 
    (id, provider, startTime, type, name, distanceMeters, durationSeconds, calories, 
     averageHR, maxHR, averageSpeed, maxSpeed, elevationGain, elevationLoss, description, locationName, rawJson)
    VALUES (?, 'garmin', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const act of activities) {
    // Fetch detailed activity data for advanced metrics
    const detail = await garmin.getActivityDetail(act.activityId);
    
    insertActivity.run(
      String(act.activityId),
      act.startTimeLocal,
      act.activityType?.typeKey || 'unknown',
      act.activityName,
      act.distance || 0,
      act.duration,
      act.calories || 0,
      detail?.averageHR ?? null,
      detail?.maxHR ?? null,
      detail?.averageSpeed ?? null,
      detail?.maxSpeed ?? null,
      detail?.elevationGain ?? null,
      detail?.elevationLoss ?? null,
      detail?.description ?? null,
      detail?.locationName ?? null,
      JSON.stringify({ summary: act, detail })
    );
    activitiesSynced++;
  }

  // Sync daily metrics for last 30 days
  const today = new Date();
  const insertDaily = db.prepare(`
    INSERT OR REPLACE INTO daily_metrics 
    (day, steps, restingHeartRate, bodyBattery, sleepSeconds, sleepScore, deepSleepSeconds, lightSleepSeconds, remSleepSeconds, awakeSleepSeconds, avgSpO2, avgRespiration, avgStressLevel, hrvStatus, rawJson)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0]!;

    const summary = await garmin.getDailySummary(dateStr);
    if (summary) {
      const [hrv, sleep, bodyBattery, stress] = await Promise.all([
        garmin.getHrvData(dateStr),
        garmin.getSleepData(dateStr),
        garmin.getBodyBatteryData(dateStr),
        garmin.getStressData(dateStr),
      ]);

      const dto = sleep?.dailySleepDTO;
      
      insertDaily.run(
        summary.calendarDate || dateStr,
        summary.steps ?? 0,
        summary.restingHeartRate ?? null,
        summary.bodyBattery?.lastDayValue ?? null,
        summary.sleepTimeInSeconds ?? null,
        dto?.sleepScore?.value ?? null,
        dto?.deepSleepSeconds ?? null,
        dto?.lightSleepSeconds ?? null,
        dto?.remSleepSeconds ?? null,
        dto?.awakeSleepSeconds ?? null,
        dto?.averageSpO2Value ?? null,
        dto?.averageRespirationValue ?? null,
        stress?.avgStressLevel ?? null,
        hrv?.status ?? null,
        JSON.stringify({ summary, hrv, sleep, bodyBattery, stress })
      );
      daysSynced++;
    }
  }

  return { activities: activitiesSynced, days: daysSynced };
}

// Initialize background sync scheduler
const scheduler = AUTO_SYNC_INTERVAL > 0
  ? new SyncScheduler({
      intervalMs: AUTO_SYNC_INTERVAL,
      onSync: async () => { await syncGarminData(); },
      onError: (err) => console.error('Auto-sync error:', err.message),
    })
  : null;

if (scheduler) {
  scheduler.start();
}

// Request context for logging
const requestContexts = new WeakMap<http.ServerResponse, { req: http.IncomingMessage; startTime: number }>();

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
  
  // Log after response is sent
  const ctx = requestContexts.get(res);
  if (ctx) {
    const duration = Date.now() - ctx.startTime;
    const timestamp = new Date().toISOString();
    const method = ctx.req.method?.padEnd(6) || 'GET   ';
    const url = ctx.req.url || '/';
    const statusIcon = status < 400 ? '✓' : status < 500 ? '⚠' : '✗';
    console.log(`${timestamp} ${statusIcon} ${method} ${url} ${status} ${duration}ms`);
  }
}

const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  requestContexts.set(res, { req, startTime });
  
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    const hasCreds = !!(GARMIN_USERNAME && GARMIN_PASSWORD);
    const sessionValid = garmin.loadSessionFromDb();
    return json(res, 200, { 
      ok: true, 
      db: DB_PATH,
      garminConfigured: hasCreds,
      garminAuthenticated: sessionValid
    });
  }

  if (req.method === 'GET' && url.pathname === '/activities') {
    const rows = db.prepare('SELECT id, provider, startTime, type, name, distanceMeters, durationSeconds, calories FROM activities ORDER BY startTime DESC LIMIT 100').all();
    return json(res, 200, { items: rows });
  }

  if (req.method === 'GET' && url.pathname.startsWith('/activities/')) {
    const activityId = url.pathname.split('/')[2] || '';
    if (!activityId) {
      return json(res, 400, { error: 'activity_id_required' });
    }
    const row = db.prepare(`
      SELECT id, provider, startTime, type, name, distanceMeters, durationSeconds, calories,
             averageHR, maxHR, averageSpeed, maxSpeed, elevationGain, elevationLoss, description, locationName
      FROM activities WHERE id = ?
    `).get(activityId) as { 
      id: string; provider: string; startTime: string; type: string; name: string;
      distanceMeters: number; durationSeconds: number; calories: number;
      averageHR: number | null; maxHR: number | null; averageSpeed: number | null; maxSpeed: number | null;
      elevationGain: number | null; elevationLoss: number | null; description: string | null; locationName: string | null;
    } | undefined;
    if (!row) {
      return json(res, 404, { error: 'activity_not_found' });
    }
    return json(res, 200, { 
      id: row.id,
      provider: row.provider,
      startTime: row.startTime,
      type: row.type,
      name: row.name,
      distanceMeters: row.distanceMeters,
      durationSeconds: row.durationSeconds,
      calories: row.calories,
      raw: {
        averageHR: row.averageHR ?? undefined,
        maxHR: row.maxHR ?? undefined,
        averageSpeed: row.averageSpeed ?? undefined,
        maxSpeed: row.maxSpeed ?? undefined,
        elevationGain: row.elevationGain ?? undefined,
        elevationLoss: row.elevationLoss ?? undefined,
        description: row.description ?? undefined,
        locationName: row.locationName ?? undefined,
      }
    });
  }

  if (req.method === 'GET' && url.pathname === '/daily') {
    const rows = db.prepare(`
      SELECT day, steps, restingHeartRate, bodyBattery, sleepSeconds, sleepScore,
             deepSleepSeconds, lightSleepSeconds, remSleepSeconds, awakeSleepSeconds,
             avgSpO2, avgRespiration, avgStressLevel, hrvStatus
      FROM daily_metrics ORDER BY day DESC LIMIT 60
    `).all();
    return json(res, 200, { items: rows });
  }

  if (req.method === 'POST' && url.pathname === '/sync') {
    const logStmt = db.prepare('INSERT INTO sync_log (startedAt, status, details) VALUES (?, ?, ?)');
    const startTime = new Date().toISOString();
    const logId = logStmt.run(startTime, 'running', 'Garmin sync started').lastInsertRowid;

    try {
      const result = await syncGarminData();
      const endTime = new Date().toISOString();
      db.prepare('UPDATE sync_log SET endedAt = ?, status = ?, details = ? WHERE id = ?').run(
        endTime,
        'success',
        `Synced ${result.activities} activities, ${result.days} days`,
        logId
      );
      return json(res, 200, { 
        ok: true, 
        synced: result,
        logId
      });
    } catch (err) {
      const endTime = new Date().toISOString();
      const errorMsg = err instanceof Error ? err.message : String(err);
      db.prepare('UPDATE sync_log SET endedAt = ?, status = ?, details = ? WHERE id = ?').run(
        endTime,
        'error',
        errorMsg,
        logId
      );
      return json(res, 500, { error: errorMsg, logId });
    }
  }

  if (req.method === 'GET' && url.pathname === '/sync/status') {
    const recent = db.prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 10').all();
    return json(res, 200, { recent });
  }

  if (req.method === 'GET' && url.pathname === '/export/activities') {
    const format = url.searchParams.get('format') || 'json';
    const rows = db.prepare(`
      SELECT id, provider, startTime, type, name, distanceMeters, durationSeconds, calories,
             averageHR, maxHR, averageSpeed, maxSpeed, elevationGain, elevationLoss, description, locationName
      FROM activities ORDER BY startTime DESC
    `).all();
    
    if (format === 'csv') {
      const headers = ['id', 'provider', 'startTime', 'type', 'name', 'distanceMeters', 'durationSeconds', 'calories', 'averageHR', 'maxHR', 'averageSpeed', 'maxSpeed', 'elevationGain', 'elevationLoss', 'description', 'locationName'];
      const csvRows = [headers.join(',')];
      for (const row of rows as Record<string, string | number | null>[]) {
        csvRows.push(headers.map(h => {
          const val = row[h];
          if (val === null) return '';
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') || str.includes('\n') ? `"${str}"` : str;
        }).join(','));
      }
      res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="activities.csv"' });
      res.end(csvRows.join('\n'));
      return;
    }
    
    return json(res, 200, { items: rows, count: rows.length });
  }

  if (req.method === 'GET' && url.pathname === '/export/daily') {
    const format = url.searchParams.get('format') || 'json';
    const rows = db.prepare(`
      SELECT day, steps, restingHeartRate, bodyBattery, sleepSeconds, sleepScore,
             deepSleepSeconds, lightSleepSeconds, remSleepSeconds, awakeSleepSeconds,
             avgSpO2, avgRespiration, avgStressLevel, hrvStatus
      FROM daily_metrics ORDER BY day DESC
    `).all();
    
    if (format === 'csv') {
      const headers = ['day', 'steps', 'restingHeartRate', 'bodyBattery', 'sleepSeconds', 'sleepScore', 'deepSleepSeconds', 'lightSleepSeconds', 'remSleepSeconds', 'awakeSleepSeconds', 'avgSpO2', 'avgRespiration', 'avgStressLevel', 'hrvStatus'];
      const csvRows = [headers.join(',')];
      for (const row of rows as Record<string, string | number | null>[]) {
        csvRows.push(headers.map(h => {
          const val = row[h];
          if (val === null) return '';
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') || str.includes('\n') ? `"${str}"` : str;
        }).join(','));
      }
      res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="daily_metrics.csv"' });
      res.end(csvRows.join('\n'));
      return;
    }
    
    return json(res, 200, { items: rows, count: rows.length });
  }

  if (req.method === 'GET' && url.pathname === '/scheduler') {
    const status = scheduler?.getStatus() ?? { enabled: false, intervalMs: 0, lastSyncAt: null, nextSyncAt: null, isSyncing: false };
    return json(res, 200, { 
      autoSync: status,
      env: {
        configured: AUTO_SYNC_INTERVAL > 0,
        intervalHours: AUTO_SYNC_INTERVAL > 0 ? AUTO_SYNC_INTERVAL / (60 * 60 * 1000) : null,
      }
    });
  }

  if (req.method === 'POST' && url.pathname === '/scheduler/trigger') {
    if (!scheduler) {
      return json(res, 503, { error: 'scheduler_not_configured', message: 'Set GARMIN_AUTO_SYNC_INTERVAL to enable' });
    }
    scheduler.triggerNow();
    return json(res, 200, { ok: true, message: 'Sync triggered' });
  }

  return json(res, 404, { error: 'not_found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`garmin-health-sync listening on http://127.0.0.1:${PORT} (db: ${DB_PATH})`);
  console.log('POST /sync to trigger Garmin Connect sync');
});
