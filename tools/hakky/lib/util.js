const fs = require('fs');
const fsp = fs.promises;

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

async function safeWriteJson(filePath, obj) {
  // Unique temp file to avoid collisions when multiple workers update status concurrently.
  const tmp = `${filePath}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  await fsp.rename(tmp, filePath);
}

async function readJsonSafe(filePath) {
  try {
    const s = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(s);
  } catch {
    return null;
  }
}

module.exports = { ensureDir, nowIso, safeWriteJson, readJsonSafe };
