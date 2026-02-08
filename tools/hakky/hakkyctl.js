#!/usr/bin/env node
/**
 * Hakky Orchestrator (minimal + safe)
 *
 * - Runs task scripts in parallel (separate Node processes)
 * - Tracks status in tools/hakky/runs/<runId>/run.json
 * - Optionally writes a short run log into Obsidian (HAKKY_VAULT)
 * - Optional Trello actions are opt-in via env vars
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const { listTaskNames, resolveTaskPath } = require('./lib/tasks');
const { ensureDir, nowIso, safeWriteJson, readJsonSafe } = require('./lib/util');
const { maybeAppendObsidianRunLog } = require('./lib/obsidian');
const { maybeCreateRunCard } = require('./lib/trello');

const ROOT = __dirname;
const RUNS_DIR = path.join(ROOT, 'runs');

function usage(exitCode = 0) {
  const cmd = path.basename(process.argv[1]);
  console.log(`\nHakky Orchestrator\n\nUsage:\n  ${cmd} tasks\n  ${cmd} run <task...> [--concurrency N] [--id RUN_ID] [--dry-run]\n  ${cmd} status [--id RUN_ID | --last]\n\nTasks live in: tools/hakky/tasks/*.js\n\nEnv (optional):\n  HAKKY_VAULT=/path/to/obsidian/vault\n  HAKKY_OBSIDIAN_LOG=1   # write run summary to Obsidian\n\nExit codes:\n  0 success (all tasks exit 0)\n  1 usage/invalid\n  2 at least one task failed\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) out._.push(a);
    else if (a === '--concurrency') out.concurrency = Number(argv[++i]);
    else if (a.startsWith('--concurrency=')) out.concurrency = Number(a.split('=')[1]);
    else if (a === '--id') out.id = String(argv[++i]);
    else if (a.startsWith('--id=')) out.id = String(a.split('=')[1]);
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--last') out.last = true;
    else usage(1);
  }
  return out;
}

async function latestRunId() {
  try {
    const entries = await fsp.readdir(RUNS_DIR, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    return dirs[dirs.length - 1] || null;
  } catch {
    return null;
  }
}

async function cmdTasks() {
  const tasks = await listTaskNames(ROOT);
  if (!tasks.length) {
    console.log('No tasks found in tools/hakky/tasks/*.js');
    return;
  }
  for (const t of tasks) console.log(t);
}

async function cmdStatus(args) {
  await ensureDir(RUNS_DIR);
  let runId = args.id || null;
  if (args.last) runId = await latestRunId();
  if (!runId) {
    console.error('ERR: provide --id RUN_ID or --last');
    process.exit(1);
  }
  const runPath = path.join(RUNS_DIR, runId, 'run.json');
  const run = await readJsonSafe(runPath);
  if (!run) {
    console.error(`ERR: run not found: ${runPath}`);
    process.exit(1);
  }
  console.log(`Run: ${run.id}`);
  console.log(`Started: ${run.startedAt}`);
  console.log(`Host: ${run.host}`);
  console.log('Tasks:');
  for (const t of run.tasks) {
    const dur = t.endedAt ? ` (${Math.round((Date.parse(t.endedAt) - Date.parse(t.startedAt)) / 1000)}s)` : '';
    console.log(`  - ${t.name}: ${t.status}${typeof t.exitCode === 'number' ? ` (exit ${t.exitCode})` : ''}${dur}`);
  }
  if (run.endedAt) console.log(`Ended: ${run.endedAt}`);
  if (run.summary) console.log(`Summary: ${run.summary}`);
}

async function runOneTask({ runDir, taskName, env }) {
  const taskPath = resolveTaskPath(ROOT, taskName);
  const logPath = path.join(runDir, `${taskName}.log`);
  const out = fs.openSync(logPath, 'a');

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [taskPath], {
      env,
      stdio: ['ignore', out, out],
    });

    const startedAt = nowIso();
    child.on('exit', (code, signal) => {
      try { fs.closeSync(out); } catch {}
      resolve({
        name: taskName,
        startedAt,
        endedAt: nowIso(),
        status: code === 0 ? 'ok' : 'failed',
        exitCode: code,
        signal: signal || null,
        logPath,
      });
    });
  });
}

async function cmdRun(args) {
  const taskNames = args._.slice(1);
  if (!taskNames.length) {
    console.error('ERR: provide at least one task');
    usage(1);
  }

  // Validate tasks early.
  const available = new Set(await listTaskNames(ROOT));
  const unknown = taskNames.filter(t => !available.has(t));
  if (unknown.length) {
    console.error(`ERR: unknown task(s): ${unknown.join(', ')}`);
    console.error(`Known tasks: ${Array.from(available).join(', ') || '(none)'}`);
    process.exit(1);
  }

  const concurrency = Number.isFinite(args.concurrency) && args.concurrency > 0
    ? Math.floor(args.concurrency)
    : Math.max(1, Math.min(os.cpus().length, 3)); // conservative default

  const runId = (args.id || nowIso().replace(/[:.]/g, '-'));
  const runDir = path.join(RUNS_DIR, runId);

  await ensureDir(runDir);

  const run = {
    id: runId,
    startedAt: nowIso(),
    endedAt: null,
    host: os.hostname(),
    cwd: process.cwd(),
    concurrency,
    dryRun: !!args.dryRun,
    tasks: taskNames.map(name => ({
      name,
      status: args.dryRun ? 'skipped' : 'queued',
      startedAt: null,
      endedAt: null,
      exitCode: null,
      signal: null,
      logPath: path.join(runDir, `${name}.log`),
    })),
    summary: null,
  };

  const runJsonPath = path.join(runDir, 'run.json');
  // In-memory state + a simple write lock to avoid concurrent write races.
  const runState = run;
  let writeLock = Promise.resolve();
  await safeWriteJson(runJsonPath, runState);

  if (args.dryRun) {
    run.endedAt = nowIso();
    run.summary = `dry-run: would run ${taskNames.join(', ')}`;
    await safeWriteJson(runJsonPath, run);
    console.log(run.summary);
    return;
  }

  // Prepare environment for tasks.
  const env = {
    ...process.env,
    HAKKY_RUN_ID: runId,
    HAKKY_RUN_DIR: runDir,
  };

  const updateRunTask = (result) => {
    writeLock = writeLock.then(async () => {
      const idx = runState.tasks.findIndex(t => t.name === result.name);
      if (idx >= 0) runState.tasks[idx] = { ...runState.tasks[idx], ...result };
      await safeWriteJson(runJsonPath, runState);
    });
    return writeLock;
  };

  const queue = [...taskNames];
  const results = [];

  const worker = async () => {
    while (queue.length) {
      const name = queue.shift();
      const startedAt = nowIso();
      await updateRunTask({ name, status: 'running', startedAt });
      const res = await runOneTask({ runDir, taskName: name, env });
      results.push(res);
      await updateRunTask(res);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, taskNames.length) }, () => worker());
  await Promise.all(workers);

  const ok = results.every(r => r.exitCode === 0);
  await writeLock; // flush any pending task updates first
  runState.endedAt = nowIso();
  runState.summary = ok
    ? `ok: ${results.length} task(s) completed`
    : `failed: ${results.filter(r => r.exitCode !== 0).length}/${results.length} task(s)`;
  await safeWriteJson(runJsonPath, runState);

  await maybeAppendObsidianRunLog(runState);
  try {
    await maybeCreateRunCard(runState);
  } catch (e) {
    // Trello is strictly opt-in; failures shouldn't hide task results.
    console.error('WARN: Trello update failed:', e && e.message ? e.message : String(e));
  }

  if (!ok) process.exit(2);
}

(async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];

  await ensureDir(RUNS_DIR);

  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') usage(0);
  if (cmd === 'tasks') return cmdTasks();
  if (cmd === 'status') return cmdStatus(args);
  if (cmd === 'run') return cmdRun(args);

  usage(1);
})().catch((err) => {
  console.error('ERR:', err && err.stack ? err.stack : String(err));
  process.exit(2);
});
