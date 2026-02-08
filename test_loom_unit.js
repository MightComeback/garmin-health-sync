import { isLoomUrl, extractLoomId, fetchLoomSession } from './src/loom.js';
import assert from 'node:assert';

console.log('Testing src/loom.js...');

// Test isLoomUrl
assert.ok(isLoomUrl('https://www.loom.com/share/123'), 'share link');
assert.ok(isLoomUrl('https://www.loom.com/v/123'), 'v link');
assert.strictEqual(isLoomUrl('https://google.com'), false);

// Test extractLoomId
assert.strictEqual(extractLoomId('https://www.loom.com/share/abc'), 'abc');

// Test fetchLoomSession (mock or existence)
assert.strictEqual(typeof fetchLoomSession, 'function');

console.log('PASS');
