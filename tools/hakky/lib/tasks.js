const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

function tasksDir(rootDir) {
  return path.join(rootDir, 'tasks');
}

async function listTaskNames(rootDir) {
  const dir = tasksDir(rootDir);
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.endsWith('.js'))
      .map(e => e.name.replace(/\.js$/, ''))
      .sort();
  } catch {
    return [];
  }
}

function resolveTaskPath(rootDir, taskName) {
  const p = path.join(tasksDir(rootDir), `${taskName}.js`);
  if (!fs.existsSync(p)) throw new Error(`Task not found: ${taskName}`);
  return p;
}

module.exports = { listTaskNames, resolveTaskPath };
