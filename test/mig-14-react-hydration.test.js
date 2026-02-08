import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects React Hydration Mismatch', () => {
  const t1 = "There was a hydration mismatch on the client.";
  const actions1 = generateNextActions(t1);
  assert.ok(actions1.some(a => a.includes('Check SSR/Hydration logic')), 'Should detect hydration mismatch');

  const t2 = "React error #418: Minified React error #418";
  const actions2 = generateNextActions(t2);
  assert.ok(actions2.some(a => a.includes('Check SSR/Hydration logic')), 'Should detect React minified error');

  const t3 = "Text content did not match. Server: 'Hello' Client: 'Hi'";
  const actions3 = generateNextActions(t3);
  assert.ok(actions3.some(a => a.includes('Check SSR/Hydration logic')), 'Should detect text content mismatch');
});
