// Minimal Trello helper (opt-in).
// Requires env vars:
//   TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID
// Enabled only when HAKKY_TRELLO=1

async function trelloRequest(path, params) {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) throw new Error('Missing TRELLO_KEY/TRELLO_TOKEN');

  const url = new URL(`https://api.trello.com/1${path}`);
  url.searchParams.set('key', key);
  url.searchParams.set('token', token);
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Trello ${res.status}: ${text}`);
  }
  return res.json();
}

async function maybeCreateRunCard(run) {
  if (process.env.HAKKY_TRELLO !== '1') return null;
  const idList = process.env.TRELLO_LIST_ID;
  if (!idList) throw new Error('Missing TRELLO_LIST_ID');

  const name = `Hakky run ${run.id}: ${run.summary || ''}`.slice(0, 160);
  const desc = [
    `Run: ${run.id}`,
    `Started: ${run.startedAt}`,
    `Ended: ${run.endedAt || ''}`,
    '',
    'Tasks:',
    ...run.tasks.map(t => `- ${t.name}: ${t.status}${typeof t.exitCode === 'number' ? ` (exit ${t.exitCode})` : ''}`),
  ].join('\n');

  return trelloRequest('/cards', { idList, name, desc });
}

module.exports = { maybeCreateRunCard };
