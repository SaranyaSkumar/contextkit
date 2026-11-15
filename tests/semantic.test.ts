import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSemanticContext, cosineSimilarity, type Embedder } from '../src/index.js';
import type { Evidence } from '../src/context.js';

const documents: Evidence[] = [
  { id:'safe', text:'Database connections exhausted', source:'log', tenantId:'one', updatedAt:'2026-11-14', authority:0.8 },
  { id:'secret', text:'Database connections exhausted', source:'private', tenantId:'two', updatedAt:'2026-11-14', authority:1 }
];
test('filters unauthorized evidence before embedding', async () => {
  let count = 0;
  const embedder: Embedder = { async embed(texts) { count = texts.length; return texts.map(() => [1,0]); } };
  const result = await buildSemanticContext({task:'SQL connection failure',documents,tenantId:'one',budgetTokens:100,embedder});
  assert.deepEqual(result.selected.map(d => d.id), ['safe']);
  assert.equal(result.excluded.secret,'unauthorized_tenant');
  assert.equal(count,2);
});
test('selects the closest vector within a budget', async () => {
  const embedder: Embedder = { async embed() { return [[1,0],[0,1],[0.99,0.01]]; } };
  const result = await buildSemanticContext({task:'SQL failure',
    documents:[documents[0]!,{...documents[0]!,id:'best',text:'pool is full'}],
    tenantId:'one',budgetTokens:4,embedder,semanticWeight:1});
  assert.deepEqual(result.selected.map(d => d.id), ['best']);
  assert.ok(result.usedTokens <= 4);
});
test('rejects invalid vectors and embedder results', async () => {
  assert.throws(() => cosineSimilarity([1],[1,2]),RangeError);
  assert.throws(() => cosineSimilarity([Number.NaN],[1]),RangeError);
  const embedder: Embedder = { async embed() { return [[1]]; } };
  await assert.rejects(buildSemanticContext({task:'test',documents,tenantId:'one',budgetTokens:100,embedder}),/wrong number/);
  await assert.rejects(buildSemanticContext({task:'test',documents,tenantId:'one',budgetTokens:100,embedder,semanticWeight:2}),RangeError);
});
