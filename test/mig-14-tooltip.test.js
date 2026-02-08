import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects tooltip/hover issues', () => {
  const t1 = "The tooltip is missing when I hover over the icon.";
  const actions1 = generateNextActions(t1);
  assert.ok(actions1.some(a => a.includes('Check hover state / tooltip')), 'Should suggest checking tooltips for t1');

  const t2 = "Nothing happens on mouseover.";
  const actions2 = generateNextActions(t2);
  assert.ok(actions2.some(a => a.includes('Check hover state / tooltip')), 'Should suggest checking tooltips for t2');
});
