#!/usr/bin/env node
/*
  Relevance filter for hourly Clawdbot/Moltbot news scan.

  Input (stdin): JSON array of { title, url, snippet }
  Output (stdout):
    {
      relevant: boolean,
      picked?: {title,url,snippet,score,reasons},
      sentence?: string
    }

  Also maintains a simple dedupe store at memory/software-news-seen.json
*/

const fs = require('fs');
const path = require('path');

const SEEN_PATH = path.join(process.cwd(), 'memory', 'software-news-seen.json');

function readStdin() {
  return fs.readFileSync(0, 'utf8');
}

function norm(s) {
  return (s || '').toLowerCase();
}

function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return ''; }
}

function loadSeen() {
  try {
    const obj = JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8'));
    const urls = Array.isArray(obj.urls) ? obj.urls : [];
    return new Set(urls);
  } catch {
    return new Set();
  }
}

function saveSeen(set) {
  const urls = Array.from(set);
  const out = { updatedAtMs: Date.now(), urls };
  fs.mkdirSync(path.dirname(SEEN_PATH), { recursive: true });
  fs.writeFileSync(SEEN_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

function scoreItem(item) {
  const t = norm(item.title);
  const s = norm(item.snippet);
  const u = norm(item.url);
  const text = `${t} ${s} ${u}`;

  const reasons = [];
  let score = 0;

  // Must mention our keywords somewhere
  if (!/(clawdbot|moltbot|\bclawd\b|openclaw)/.test(text)) {
    return { score: -999, reasons: ['missing keyword'] };
  }

  // Source allowlist: X/Twitter + official docs + GitHub
  const host = hostOf(item.url);
  const allowed = (
    host === 'x.com' ||
    host === 'github.com' ||
    host === 'docs.clawd.bot'
  );
  if (!allowed) return { score: -999, reasons: [`disallowed source: ${host || 'unknown'}`] };

  // Heuristics: actionable terms
  const bumps = [
    { re: /(release|released|changelog|tag\b|version\b)/, pts: 4, why: 'release' },
    { re: /(security|cve|ghsa|vuln|vulnerability|exploit|rce)/, pts: 5, why: 'security' },
    { re: /(deprecat|breaking)/, pts: 4, why: 'breaking/deprecation' },
    { re: /(outage|incident|postmortem)/, pts: 4, why: 'outage' },
    { re: /(plugin|skill)/, pts: 2, why: 'plugin/skill' },
    { re: /(hook|hooks|cron)/, pts: 2, why: 'hooks/cron' },
    { re: /(issue|pull\s*request|\bpr\b|#\d+)/, pts: 1, why: 'issue/pr' },
  ];

  for (const b of bumps) {
    if (b.re.test(text)) {
      score += b.pts;
      reasons.push(`+${b.pts}:${b.why}`);
    }
  }

  // Prefer official repo release/tag pages over general listings.
  if (/github\.com\/(clawdbot\/clawdbot|moltbot\/moltbot|openclaw\/openclaw)\/releases\/tag\//.test(u)) {
    score += 2;
    reasons.push('+2:tag-page');
  }

  return { score, reasons };
}

function buildSentence(picked) {
  // One-sentence, Telegram-ready, includes source link.
  // Keep it tight and action oriented.
  const host = hostOf(picked.url);
  const title = (picked.title || '').replace(/\s+/g, ' ').trim();
  return `${title} (${host || 'source'}) — ${picked.url}`;
}

function main() {
  let items;
  try {
    items = JSON.parse(readStdin());
  } catch {
    console.log(JSON.stringify({ relevant: false, error: 'invalid_json' }));
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    console.log(JSON.stringify({ relevant: false }));
    return;
  }

  const seen = loadSeen();

  // Dedup by URL
  const dedup = [];
  const seenInBatch = new Set();
  for (const it of items) {
    const url = (it && it.url) ? String(it.url) : '';
    if (!url) continue;
    if (seen.has(url)) continue;
    if (seenInBatch.has(url)) continue;
    seenInBatch.add(url);
    dedup.push({ title: it.title || '', url, snippet: it.snippet || '' });
  }

  const scored = dedup
    .map((it) => {
      const { score, reasons } = scoreItem(it);
      return { ...it, score, reasons };
    })
    .filter((it) => it.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    console.log(JSON.stringify({ relevant: false }));
    return;
  }

  const picked = scored[0];
  const sentence = buildSentence(picked);

  // Mark as seen
  seen.add(picked.url);
  saveSeen(seen);

  console.log(JSON.stringify({ relevant: true, picked, sentence }));
}

main();
