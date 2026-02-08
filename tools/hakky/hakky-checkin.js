#!/usr/bin/env node
// hakky-checkin: schedule-aware 1-sentence check-in prompt
// Uses Google Calendar via `gog calendar events` but supports a local override file
// when calendar blocks are inaccurate.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ACCOUNT = process.env.HAKKY_ACCOUNT || 'kuznetsovivan496@gmail.com';
const CLIENT = process.env.HAKKY_CLIENT || 'hakky';
const CFG_PATH = process.env.HAKKY_CHECKIN_CONFIG || path.join(process.env.HOME || '', '.hakky-checkin.json');

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function parseHHMM(s) {
  const m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function loadCfg() {
  try {
    const raw = fs.readFileSync(CFG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toIsoLocal(date) {
  // YYYY-MM-DDTHH:mm:ss.sssZ is UTC; for messaging we only need end time, so ISO is fine.
  return date.toISOString();
}

function buildShiftEvent(now, shift) {
  const startParts = parseHHMM(shift?.start);
  const endParts = parseHHMM(shift?.end);
  if (!startParts || !endParts) return null;

  const start = new Date(now);
  start.setHours(startParts.hh, startParts.mm, 0, 0);

  let end = new Date(now);
  end.setHours(endParts.hh, endParts.mm, 0, 0);
  if (end <= start) {
    // crosses midnight
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  const inShift = start.getTime() <= now.getTime() && now.getTime() <= end.getTime();
  const label = (shift?.label || 'Work').replace(/\s+/g, ' ').trim();

  return {
    kind: inShift ? 'current' : 'next',
    summary: label,
    start: start.getTime(),
    end: end.getTime(),
    startIso: toIsoLocal(start),
    endIso: toIsoLocal(end),
    inShift,
  };
}

function eventLooksUnreliable(ev) {
  const name = (ev.summary || '').toLowerCase();
  const durMs = Math.max(0, (ev.end || 0) - (ev.start || 0));
  const hours = durMs / (60 * 60 * 1000);

  // “Free time” (or similar) blocks that span most of the day often mean "no schedule entered".
  if (/free\s*time|available|personal|off\b/.test(name) && hours >= 6) return true;
  return false;
}

function pickEvent(events) {
  const now = Date.now();
  const upcoming = [];

  for (const e of events) {
    const s = e.start?.dateTime || e.start?.date;
    const en = e.end?.dateTime || e.end?.date;
    if (!s || !en) continue;
    const start = Date.parse(s);
    const end = Date.parse(en);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

    if (start <= now && now <= end) {
      return { kind: 'current', summary: e.summary || 'Calendar block', start, end, startIso: s, endIso: en };
    }
    if (start > now) {
      upcoming.push({ summary: e.summary || 'Calendar block', start, end, startIso: s, endIso: en });
    }
  }

  upcoming.sort((a, b) => a.start - b.start);
  return upcoming[0] ? { kind: 'next', ...upcoming[0] } : null;
}

function main() {
  const cfg = loadCfg();

  let events = [];
  try {
    const raw = sh(`gog calendar events --client ${CLIENT} --account ${ACCOUNT} --today --max 50 --json`);
    const parsed = JSON.parse(raw);
    events = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.events) ? parsed.events : (Array.isArray(parsed.items) ? parsed.items : []));
  } catch {
    // ignore; we'll use overrides/fallback
  }

  let ev = pickEvent(events);

  // If calendar is empty or looks unreliable, use local shift override if present.
  if (!ev || eventLooksUnreliable(ev)) {
    const shift = cfg?.workShift;
    if (shift) {
      const now = new Date();
      const shiftEv = buildShiftEvent(now, shift);
      if (shiftEv) {
        if (!ev || shiftEv.inShift) ev = shiftEv;
        else {
          // Compare which is sooner as “next”
          const nextCandidate = shiftEv.kind === 'next' ? shiftEv : null;
          if (nextCandidate && ev.kind === 'next' && nextCandidate.start < ev.start) ev = nextCandidate;
        }
      }
    }
  }

  if (!ev) {
    console.log('Quick check-in: reply with last hour / next hour / blockers.');
    return;
  }

  const name = (ev.summary || '').replace(/\s+/g, ' ').trim();
  if (ev.kind === 'current') {
    console.log(`You’re in "${name}" until ${fmtTime(ev.endIso)} — reply with last hour / next hour / blockers.`);
  } else {
    console.log(`Next is "${name}" at ${fmtTime(ev.startIso)} — reply with last hour / next hour / blockers.`);
  }
}

main();
