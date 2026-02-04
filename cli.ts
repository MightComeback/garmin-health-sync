#!/usr/bin/env bun
/**
 * Garmin Health Sync CLI
 * Manual sync operations and status checking
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const API_URL = process.env.GARMIN_SYNC_URL || 'http://127.0.0.1:17890';

const command = process.argv[2];

async function fetchApi(path: string, method = 'GET', body?: unknown) {
  const options: RequestInit = {
    method,
    headers: { 'content-type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
  return res.json();
}

async function status() {
  try {
    const health = await fetchApi('/health');
    const syncStatus = await fetchApi('/sync/status');
    
    console.log('\n📊 Garmin Health Sync Status\n');
    console.log(`  Database: ${health.db}`);
    console.log(`  Garmin Configured: ${health.garminConfigured ? '✅' : '❌'}`);
    console.log(`  Garmin Authenticated: ${health.garminAuthenticated ? '✅' : '❌'}`);
    
    if (syncStatus.recent?.length > 0) {
      console.log('\n  Recent Syncs:');
      for (const sync of syncStatus.recent.slice(0, 5)) {
        const icon = sync.status === 'success' ? '✅' : sync.status === 'error' ? '❌' : '⏳';
        console.log(`    ${icon} ${sync.startedAt} - ${sync.status}`);
        if (sync.details) console.log(`       ${sync.details}`);
      }
    }
    console.log('');
  } catch (err) {
    console.error('❌ Cannot connect to sync service:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

async function sync() {
  console.log('🔄 Triggering sync...\n');
  try {
    const result = await fetchApi('/sync', 'POST');
    console.log('✅ Sync complete!');
    console.log(`   Activities: ${result.synced.activities}`);
    console.log(`   Days: ${result.synced.days}`);
    console.log(`   Log ID: ${result.logId}\n`);
  } catch (err) {
    console.error('❌ Sync failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

async function activities(limit = 10) {
  try {
    const data = await fetchApi('/activities');
    const items = data.items.slice(0, limit);
    
    console.log(`\n🏃 Last ${items.length} Activities\n`);
    for (const act of items) {
      const date = new Date(act.startTime).toLocaleDateString('en-US', { 
        month: 'short', day: 'numeric' 
      });
      const dist = act.distanceMeters >= 1000 
        ? `${(act.distanceMeters / 1000).toFixed(2)}km` 
        : `${act.distanceMeters}m`;
      console.log(`  ${date} | ${act.type.padEnd(12)} | ${act.name.slice(0, 30).padEnd(32)} | ${dist}`);
    }
    console.log('');
  } catch (err) {
    console.error('❌ Failed to fetch activities:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

async function daily() {
  try {
    const data = await fetchApi('/daily');
    
    console.log('\n📅 Daily Metrics (Last 7 Days)\n');
    console.log('  Date       | Steps    | RHR | Battery | Sleep');
    console.log('  ' + '-'.repeat(50));
    
    for (const m of data.items.slice(0, 7)) {
      const steps = m.steps?.toLocaleString().padStart(6) || '    --';
      const rhr = m.restingHeartRate?.toString().padStart(3) || '--';
      const battery = m.bodyBattery?.toString().padStart(3) || '--';
      const sleep = m.sleepSeconds 
        ? `${Math.floor(m.sleepSeconds / 3600)}h${Math.floor((m.sleepSeconds % 3600) / 60)}m` 
        : '--';
      console.log(`  ${m.day} | ${steps} | ${rhr} | ${battery}% | ${sleep}`);
    }
    console.log('');
  } catch (err) {
    console.error('❌ Failed to fetch daily metrics:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

function help() {
  console.log(`
Garmin Health Sync CLI

Usage: bun cli.ts <command>

Commands:
  status       Show sync service status and recent sync history
  sync         Trigger manual sync with Garmin Connect
  activities   List recent activities (default: 10)
  daily        Show daily metrics for last 7 days
  help         Show this help message

Environment:
  GARMIN_SYNC_URL   API endpoint (default: http://127.0.0.1:17890)
`);
}

switch (command) {
  case 'status':
    await status();
    break;
  case 'sync':
    await sync();
    break;
  case 'activities':
    await activities(parseInt(process.argv[3] || '10', 10));
    break;
  case 'daily':
    await daily();
    break;
  case 'help':
  default:
    help();
    break;
}
