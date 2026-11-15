import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContext, renderContext, type Evidence } from '../src/index.js';

const NOW = new Date('2026-11-15T00:00:00Z');
const doc = (id: string, text: string, overrides: Partial<Evidence> = {}): Evidence => ({
  id, text, source: 'fixture', tenantId: 'a', updatedAt: '2026-11-14', authority: 0.9, ...overrides
});
const select = (documents: Evidence[], budgetTokens = 100) => buildContext({
  task: 'Lambda database timeout', documents, tenantId: 'a', budgetTokens, now: NOW
});

test('rejects cross-tenant evidence regardless of relevance', () => {
  const result = select([doc('good', 'Lambda database timeout'), doc('secret', 'Lambda database timeout', { tenantId: 'b' })]);
  assert.deepEqual(result.selected.map(d => d.id), ['good']);
  assert.equal(result.excluded.secret, 'unauthorized_tenant');
});

test('selects relevant evidence and deprioritizes unrelated text', () => {
  const result = select([doc('match', 'Lambda database timeout issue'), doc('unrelated', 'React design typography')]);
  assert.equal(result.selected[0]?.id, 'match');
});

test('never exceeds a custom token budget', () => {
  const documents = [doc('one', 'Lambda database timeout'), doc('two', 'Database timeout Lambda functions in AWS')];
  const result = select(documents, 6);
  assert.ok(result.usedTokens <= 6);
  assert.ok(result.selected.length <= 1);
});

test('normalizes duplicates and makes deterministic choices', () => {
  const result = select([doc('b', 'Lambda database timeout'), doc('a', '  LAMBDA   DATABASE   TIMEOUT  ')]);
  assert.equal(result.selected.length, 1);
  assert.equal(result.selected[0]?.id, 'a');
});

test('rejects invalid budget, dates, authorities and counter values', () => {
  assert.throws(() => select([], -1), RangeError);
  const result = select([doc('bad-date', 'Lambda database timeout', { updatedAt: 'broken' }), doc('bad-authority', 'Lambda database timeout', { authority: 9 })]);
  assert.equal(result.selected.length, 0);
  assert.equal(result.excluded['bad-date'], 'invalid_date');
  assert.equal(result.excluded['bad-authority'], 'invalid_authority');
  assert.throws(() => buildContext({ task: 'test', documents: [doc('a', 'test')], tenantId: 'a', budgetTokens: 10, now: NOW, estimateTokens: () => -2 }), RangeError);
});

test('provides an auditable exclusion reason and context provenance', () => {
  const result = select([doc('one', 'Lambda database timeout', { source: 'logs' })]);
  assert.match(renderContext(result.selected), /Source: "logs"/);
  assert.match(renderContext(result.selected), /UNTRUSTED REFERENCE TEXT/);
});
