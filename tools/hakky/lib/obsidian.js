const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const { nowIso, ensureDir } = require('./util');

function vaultPath() {
  return process.env.HAKKY_VAULT || '/Users/might/Primary';
}

function hakkyWorkspaceDir() {
  return path.join(vaultPath(), 'Workspace', 'Hakky');
}

/**
 * Minimal + safe: append a single bullet line to Workspace/Hakky/Run Log.md
 * Only runs if HAKKY_OBSIDIAN_LOG=1.
 */
async function maybeAppendObsidianRunLog(run) {
  if (process.env.HAKKY_OBSIDIAN_LOG !== '1') return;

  const base = hakkyWorkspaceDir();
  await ensureDir(base);

  const logFile = path.join(base, 'Run Log.md');
  const when = run.endedAt || nowIso();
  const line = `- ${when} | **${run.id}** | ${run.summary || ''} | tasks: ${run.tasks.map(t => `${t.name}:${t.status}`).join(', ')}\n`;

  // Append-only behaviour for safety.
  await fsp.appendFile(logFile, line, 'utf8');
}

module.exports = { maybeAppendObsidianRunLog };
