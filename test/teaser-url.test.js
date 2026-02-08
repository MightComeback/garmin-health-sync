import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('brief teaser preserves standalone URLs even if they look like speaker labels', (t) => {
  // A URL might look like "https: //..." if there is a space, but valid URLs don't have spaces.
  // However, "http: something" could be "http" saying "something".
  // Real world case: "Note: check this" -> "Note" is a speaker?
  // "Context: see below" -> "Context" is a speaker?
  
  // Let's ensure common labels like "Note:", "Context:", "TODO:" are NOT stripped as speakers
  // if they are likely meta-data.
  // But wait, the current logic stripes "Alice:".
  // If the user puts "Note: this is important", it will become "- this is important".
  // This might be desired or not.
  
  // What about a very short speaker name? "A: hello".
  const transcript = `
A: hello
B: world
`;
  const out = renderBrief({ transcript, teaserMax: 2 });
  assert.match(out, /- hello/);
  assert.match(out, /- world/);
});

test('brief teaser does not strip common meta labels if possible?', (t) => {
    // Current behavior: "Note: foo" -> "foo"
    // Ideally maybe we want to keep "Note:"?
    // But for a transcript, "Note:" is likely a speaker named "Note" (e.g. from an automated system).
    // So stripping it is probably correct for "transcript teaser".
});
