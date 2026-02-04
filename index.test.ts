import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';

// Simple in-memory test for the database schema and queries
// We test the SQL operations that the sync service performs

describe('garmin-health-sync', () => {
  let db: Database;

  beforeEach(() => {
    // Use in-memory database for tests
    db = new Database(':memory:');
    
    // Initialize schema (mirrors index.ts)
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
  });

  afterEach(() => {
    db.close();
  });

  describe('meta table', () => {
    it('should store and retrieve session data', () => {
      const sessionData = JSON.stringify({ cookies: 'test-cookie', timestamp: Date.now() });
      const stmt = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
      stmt.run('garmin_session', sessionData);
      
      const row = db.query("SELECT value FROM meta WHERE key = 'garmin_session'").get() as { value: string };
      expect(row).toBeDefined();
      expect(row.value).toBe(sessionData);
    });

    it('should update existing keys', () => {
      const stmt = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
      stmt.run('test_key', 'value1');
      stmt.run('test_key', 'value2');
      
      const row = db.query("SELECT value FROM meta WHERE key = 'test_key'").get() as { value: string };
      expect(row.value).toBe('value2');
    });
  });

  describe('activities table', () => {
    it('should insert and retrieve activities', () => {
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO activities 
        (id, provider, startTime, type, name, distanceMeters, durationSeconds, calories, averageHR, maxHR, rawJson)
        VALUES (?, 'garmin', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertStmt.run(
        '12345',
        '2025-02-04T10:00:00',
        'running',
        'Morning Run',
        5000,
        1800,
        350,
        145,
        165,
        JSON.stringify({ test: true })
      );

      const rows = db.query('SELECT * FROM activities WHERE id = ?').all('12345') as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Morning Run');
      expect(rows[0].type).toBe('running');
      expect(rows[0].distanceMeters).toBe(5000);
    });

    it('should return activities ordered by startTime DESC', () => {
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO activities 
        (id, provider, startTime, type, name, distanceMeters, durationSeconds, calories)
        VALUES (?, 'garmin', ?, ?, ?, ?, ?, ?)
      `);
      
      insertStmt.run('1', '2025-02-01T10:00:00', 'running', 'Run 1', 3000, 1200, 200);
      insertStmt.run('2', '2025-02-03T10:00:00', 'cycling', 'Ride 2', 15000, 3600, 500);
      insertStmt.run('3', '2025-02-02T10:00:00', 'walking', 'Walk 3', 5000, 3000, 150);

      const rows = db.query('SELECT id, startTime FROM activities ORDER BY startTime DESC').all() as any[];
      expect(rows[0].id).toBe('2');
      expect(rows[1].id).toBe('3');
      expect(rows[2].id).toBe('1');
    });
  });

  describe('daily_metrics table', () => {
    it('should insert and retrieve daily metrics', () => {
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO daily_metrics 
        (day, steps, restingHeartRate, bodyBattery, sleepSeconds, sleepScore, hrvStatus, rawJson)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertStmt.run(
        '2025-02-04',
        10500,
        58,
        85,
        28800,
        85,
        'balanced',
        JSON.stringify({ summary: 'test' })
      );

      const row = db.query('SELECT * FROM daily_metrics WHERE day = ?').get('2025-02-04') as any;
      expect(row).toBeDefined();
      expect(row.steps).toBe(10500);
      expect(row.restingHeartRate).toBe(58);
      expect(row.sleepScore).toBe(85);
    });

    it('should return metrics ordered by day DESC', () => {
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO daily_metrics (day, steps) VALUES (?, ?)
      `);
      
      insertStmt.run('2025-02-01', 8000);
      insertStmt.run('2025-02-03', 10000);
      insertStmt.run('2025-02-02', 9000);

      const rows = db.query('SELECT day FROM daily_metrics ORDER BY day DESC LIMIT 10').all() as any[];
      expect(rows[0].day).toBe('2025-02-03');
      expect(rows[1].day).toBe('2025-02-02');
      expect(rows[2].day).toBe('2025-02-01');
    });
  });

  describe('sync_log table', () => {
    it('should insert sync log entries', () => {
      const stmt = db.prepare('INSERT INTO sync_log (startedAt, status, details) VALUES (?, ?, ?)');
      const result = stmt.run('2025-02-04T15:30:00', 'running', 'Sync started');
      
      expect(result.lastInsertRowid).toBeGreaterThan(0);
      
      const row = db.query('SELECT * FROM sync_log WHERE id = ?').get(result.lastInsertRowid) as any;
      expect(row.status).toBe('running');
      expect(row.details).toBe('Sync started');
    });

    it('should update sync status on completion', () => {
      const stmt = db.prepare('INSERT INTO sync_log (startedAt, status, details) VALUES (?, ?, ?)');
      const result = stmt.run('2025-02-04T15:30:00', 'running', 'Sync started');
      
      // Update as success
      db.prepare('UPDATE sync_log SET endedAt = ?, status = ?, details = ? WHERE id = ?').run(
        '2025-02-04T15:31:00',
        'success',
        'Synced 10 activities',
        result.lastInsertRowid
      );
      
      const row = db.query('SELECT * FROM sync_log WHERE id = ?').get(result.lastInsertRowid) as any;
      expect(row.status).toBe('success');
      expect(row.endedAt).toBe('2025-02-04T15:31:00');
    });

    it('should return recent syncs in order', () => {
      const stmt = db.prepare('INSERT INTO sync_log (startedAt, status, details) VALUES (?, ?, ?)');
      stmt.run('2025-02-04T10:00:00', 'success', 'First');
      stmt.run('2025-02-04T11:00:00', 'success', 'Second');
      stmt.run('2025-02-04T12:00:00', 'error', 'Third');
      
      const rows = db.query('SELECT * FROM sync_log ORDER BY id DESC LIMIT 10').all() as any[];
      expect(rows[0].details).toBe('Third');
      expect(rows[1].details).toBe('Second');
      expect(rows[2].details).toBe('First');
    });
  });
});
