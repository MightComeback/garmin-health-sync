import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeFetchedContent } from '../src/extractor.js';

test('normalizeFetchedContent falls back to h1 when title/meta are missing', () => {
  const html = `
    <html>
      <head>
        <!-- No title, no og:title -->
      </head>
      <body>
        <h1 class="heading"> fallback-h1-title </h1>
        <p>Some content</p>
      </body>
    </html>
  `;
  const result = normalizeFetchedContent(html, 'http://example.com');
  assert.equal(result.suggestedTitle, 'fallback-h1-title');
});
