#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const vault = process.env.HAKKY_VAULT || '/Users/might/Primary';
const dash = path.join(vault, 'Workspace', 'Hakky', 'Dashboard.md');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function extractSection(md, header) {
  const lines = md.split(/\r?\n/);
  const idx = lines.findIndex(l => l.trim().toLowerCase() === header.toLowerCase());
  if (idx === -1) return null;
  const out = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,6}\s+/.test(line)) break;
    out.push(line);
  }
  return out.join('\n').trim();
}

function firstUncheckedTask(block) {
  if (!block) return null;
  const lines = block.split(/\r?\n/);
  for (const l of lines) {
    const m = l.match(/^\s*- \[ \]\s+(.*)$/);
    if (m) return m[1].trim();
  }
  return null;
}

const md = readFileSafe(dash);
if (!md) {
  console.error(`ERR: dashboard not found: ${dash}`);
  process.exit(1);
}

const nowBlock = extractSection(md, '### Now');
const backlogBlock = extractSection(md, '### Backlog');
const doing = firstUncheckedTask(nowBlock) || firstUncheckedTask(backlogBlock) || null;

// “Next” = next unchecked after “doing” in the same block if possible
function nextAfter(block, current) {
  if (!block || !current) return null;
  const lines = block.split(/\r?\n/);
  const tasks = lines
    .map(l => l.match(/^\s*- \[ \]\s+(.*)$/))
    .filter(Boolean)
    .map(m => m[1].trim());
  const i = tasks.indexOf(current);
  if (i >= 0 && i + 1 < tasks.length) return tasks[i + 1];
  return null;
}

let next = nextAfter(nowBlock, doing) || nextAfter(backlogBlock, doing);
if (!next) {
  // fallback: first unchecked in other block
  if (doing && firstUncheckedTask(nowBlock) === doing) next = firstUncheckedTask(backlogBlock);
  else next = firstUncheckedTask(nowBlock);
}

const oneLine = (s) => (s || '').replace(/\s+/g, ' ').trim();

console.log(`Doing: ${doing ? oneLine(doing) : '—'}`);
console.log(`Next: ${next ? oneLine(next) : '—'}`);
