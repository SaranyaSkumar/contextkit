import test from 'node:test';
import assert from 'node:assert/strict';
import { ollamaEmbedder } from '../src/ollama.js';

test('empty batches do not send HTTP requests', async () => {
  const result = await ollamaEmbedder().embed([]);
  assert.deepEqual(result, []);
});

test('rejects invalid timeout configuration', () => {
  assert.throws(() => ollamaEmbedder({ timeoutMs: 0 }), RangeError);
});
