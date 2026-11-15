import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedEmbedder, evaluateDataset, scoreRanking, validateDataset } from '../src/evaluation.js';
import type { EvaluationDataset } from '../src/evaluation.js';
const dataset: EvaluationDataset = {
  name:'unit', documents:[
    {id:'a',text:'database timeout',source:'fixture',tenantId:'t',updatedAt:'2026-11-14',authority:1},
    {id:'b',text:'react styles',source:'fixture',tenantId:'t',updatedAt:'2026-11-14',authority:1}
  ], cases:[{id:'q',query:'database timeout',relevantIds:['a'],tenantId:'t'}]
};
test('metrics calculate precision, recall, and reciprocal rank', () => {
  assert.deepEqual(scoreRanking(['b','a'],['a'],2),{recallAtK:1,precisionAtK:0.5,reciprocalRank:0.5});
});
test('invalid labels are rejected', () => {
  assert.throws(() => validateDataset({...dataset,cases:[{...dataset.cases[0]!, relevantIds:['missing']}]}),/Invalid relevance label/);
});
test('lexical evaluation returns metrics', async () => {
  const result = await evaluateDataset(dataset,{k:1});
  assert.equal(result[0]?.recallAtK,1);
  assert.equal(result[0]?.mrr,1);
});
test('embedding contract is evaluated using stub vectors', async () => {
  let calls=0;
  const embedder = cachedEmbedder({async embed(texts) { calls++; return texts.map(t => t.includes('database') ? [1,0]:[0,1]); }});
  const results = await evaluateDataset(dataset,{embedder,k:1});
  assert.deepEqual(results.map(r=>r.method), ['lexical','semantic','hybrid']);
  assert.equal(results[1]?.recallAtK,1);
  assert.equal(calls,1);
});
