import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sqlite3 from 'sqlite3';
import { garminService, Activity, WellnessData } from './garminService';
import { randomUUID } from 'crypto';

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());

const PORT = 17890;
const SYNC_URL_KEY = '@garmin_sync_url';

// Database setup
let db: sqlite3.Database | null = null;

async function initDatabase() {
  db = new sqlite3.Database('garmin.sqlite');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sync_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      garmin_configured INTEGER DEFAULT 0,
      garmin_authenticated INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL UNIQUE,
      steps INTEGER,
      resting_heart_rate REAL,
      body_battery INTEGER,
      sleep_seconds INTEGER,
      hrv_status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      status TEXT,
      activities_count INTEGER,
      synced_days INTEGER
    );
  `);

  // Initialize sync status if not exists
  const statusCount = await new Promise<number>((resolve, reject) => {
    db?.get('SELECT COUNT(*) as count FROM sync_status', (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve((row as any)?.count || 0);
      }
    });
  });

  if (statusCount === 0) {
    await new Promise<void>((resolve, reject) => {
      db?.run('INSERT INTO sync_status (garmin_configured, garmin_authenticated) VALUES (0, 0)', function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

// API endpoints

app.get('/health', (req, res) => {
  db?.get('SELECT * FROM sync_status ORDER BY id DESC LIMIT 1', (err, row: any) => {
    if (err) {
      res.status(500).json({ ok: false, error: err.message });
      return;
    }
    res.json({
      ok: true,
      garminConfigured: row?.garmin_configured || 0,
      garminAuthenticated: row?.garmin_authenticated || 0,
      authenticated: garminService.isAuthenticated(),
    });
  });
});

// Garmin Connect authorization - email/password login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password required' });
  }

  try {
    await garminService.login(email, password);

    // Update database
    await new Promise<void>((resolve, reject) => {
      db?.run(
        'UPDATE sync_status SET garmin_authenticated = 1, garmin_configured = 1 WHERE id = 1',
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        },
      );
    });

    res.json({ ok: true, message: 'Authenticated successfully' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Authentication failed' });
  }
});

app.post('/auth/logout', async (req, res) => {
  try {
    await garminService.clearTokens();

    // Reset database
    await new Promise<void>((resolve, reject) => {
      db?.run('UPDATE sync_status SET garmin_authenticated = 0, garmin_configured = 0 WHERE id = 1', function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    res.json({ ok: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Logout failed' });
  }
});

// Get activities
app.get('/activities', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const activities = await garminService.getActivities(days);

    // Save to database
    for (const activity of activities) {
      const date = new Date(activity.startDateLocal).toISOString().split('T')[0];

      await new Promise<void>((resolve, reject) => {
        db?.run(
          `INSERT INTO daily_metrics (date, steps, resting_heart_rate, body_battery, sleep_seconds, hrv_status)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET
             steps = excluded.steps,
             resting_heart_rate = excluded.resting_heart_rate,
             body_battery = excluded.body_battery,
             sleep_seconds = excluded.sleep_seconds,
             hrv_status = excluded.hrv_status`,
          [
            date,
            activity.summary.totalCalories || null,
            null,
            null,
            null,
            null,
          ],
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
        );
      });
    }

    res.json({ ok: true, activities, count: activities.length });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Failed to fetch activities' });
  }
});

// Get wellness data for a specific date
app.get('/wellness/:date', async (req, res) => {
  const { date } = req.params;

  try {
    const wellness = await garminService.getWellnessData(date);

    // Save to database
    await new Promise<void>((resolve, reject) => {
      db?.run(
        `INSERT INTO daily_metrics (date, steps, resting_heart_rate, body_battery, sleep_seconds, hrv_status)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           steps = excluded.steps,
           resting_heart_rate = excluded.resting_heart_rate,
           body_battery = excluded.body_battery,
           sleep_seconds = excluded.sleep_seconds,
           hrv_status = excluded.hrv_status`,
        [
          date,
          null,
          wellness.restingHeartRate || null,
          wellness.bodyBattery || null,
          wellness.sleep?.duration || null,
          wellness.hrvStatus || null,
        ],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        },
      );
    });

    res.json({ ok: true, date, wellness });
  } catch (error) {
    console.error('Error fetching wellness data:', error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Failed to fetch wellness data' });
  }
});

// Fetch wellness data for all days in range
app.post('/wellness/daily', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ ok: false, error: 'startDate and endDate required' });
    }

    const activities = await garminService.getActivities(7); // Get 7 days of activities for wellness data
    const wellnessData = [];

    for (const dateStr of activities.map(a => a.startDateLocal.split('T')[0]).reverse()) {
      try {
        const wellness = await garminService.getWellnessData(dateStr);

        // Save to database
        await new Promise<void>((resolve, reject) => {
          db?.run(
            `INSERT INTO daily_metrics (date, steps, resting_heart_rate, body_battery, sleep_seconds, hrv_status)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(date) DO UPDATE SET
               steps = excluded.steps,
               resting_heart_rate = excluded.resting_heart_rate,
               body_battery = excluded.body_battery,
               sleep_seconds = excluded.sleep_seconds,
               hrv_status = excluded.hrv_status`,
            [
              dateStr,
              null,
              wellness.restingHeartRate || null,
              wellness.bodyBattery || null,
              wellness.sleep?.duration || null,
              wellness.hrvStatus || null,
            ],
            (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            },
          );
        });

        wellnessData.push({
          date: dateStr,
          restingHeartRate: wellness.restingHeartRate,
          bodyBattery: wellness.bodyBattery,
          sleepDuration: wellness.sleep?.duration,
        });
      } catch (error) {
        console.error(`Error fetching wellness for ${dateStr}:`, error);
      }
    }

    res.json({ ok: true, wellness: wellnessData, count: wellnessData.length });
  } catch (error) {
    console.error('Error fetching wellness data:', error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Failed to fetch wellness data' });
  }
});

app.get('/daily', (req, res) => {
  db?.all('SELECT * FROM daily_metrics ORDER BY date DESC LIMIT 7', (err, rows) => {
    if (err) {
      res.status(500).json({ ok: false, error: err.message });
      return;
    }
    res.json({ items: rows || [] });
  });
});

app.get('/sync/status', (req, res) => {
  db?.all('SELECT * FROM sync_logs ORDER BY id DESC LIMIT 10', (err, rows) => {
    if (err) {
      res.status(500).json({ ok: false, error: err.message });
      return;
    }
    res.json({ recent: rows || [] });
  });
});

app.post('/sync', async (req, res) => {
  try {
    const logId = await new Promise<number>((resolve, reject) => {
      db?.run('INSERT INTO sync_logs (started_at) VALUES (?)', [new Date().toISOString()], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });

    try {
      // Check if authenticated
      if (!garminService.isAuthenticated()) {
        throw new Error('Not authenticated with Garmin Connect. Please authorize first.');
      }

      // Sync activities
      const activities = await garminService.getActivities(30);
      const activitiesCount = activities.length;

      // Sync wellness data for each activity day
      const wellnessData = [];
      for (const activity of activities) {
        const date = activity.startDateLocal.split('T')[0];
        try {
          const wellness = await garminService.getWellnessData(date);
          wellnessData.push({ date, wellness });

          // Save to database
          await new Promise<void>((resolve, reject) => {
            db?.run(
              `INSERT INTO daily_metrics (date, steps, resting_heart_rate, body_battery, sleep_seconds, hrv_status)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(date) DO UPDATE SET
                 steps = excluded.steps,
                 resting_heart_rate = excluded.resting_heart_rate,
                 body_battery = excluded.body_battery,
                 sleep_seconds = excluded.sleep_seconds,
                 hrv_status = excluded.hrv_status`,
              [
                date,
                null,
                wellness.restingHeartRate || null,
                wellness.bodyBattery || null,
                wellness.sleep?.duration || null,
                wellness.hrvStatus || null,
              ],
              (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              },
            );
          });
        } catch (wellnessError) {
          console.error(`Error syncing wellness for ${date}:`, wellnessError);
        }
      }

      // Update log
      await new Promise<void>((resolve, reject) => {
        db?.run(
          'UPDATE sync_logs SET ended_at = ?, status = ?, activities_count = ?, synced_days = ? WHERE id = ?',
          [new Date().toISOString(), 'success', activitiesCount, wellnessData.length, logId],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
        );
      });

      res.json({
        ok: true,
        synced: { activities: activitiesCount, days: wellnessData.length },
      });
    } catch (error) {
      console.error('Sync error:', error);

      // Update log with error
      await new Promise<void>((resolve, reject) => {
        db?.run(
          'UPDATE sync_logs SET ended_at = ?, status = ?, activities_count = ?, synced_days = ? WHERE id = ?',
          [new Date().toISOString(), 'error', 0, 0, logId],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
        );
      });

      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  } catch (error) {
    console.error('Sync log error:', error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Failed to start sync' });
  }
});

server.listen(PORT, async () => {
  await initDatabase();
  console.log(`Server running on port ${PORT}`);
});

export { app, server };
