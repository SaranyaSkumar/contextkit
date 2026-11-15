import { buildContext, type Evidence } from './context.js';
import { buildSemanticContext, type Embedder } from './semantic.js';

// Synthetic concept vectors; NOT real model embeddings or production evidence.
const concepts: string[][] = [
  ['aurora','database','sql','connection','pool','exhaustion','timeout','slow','query'],
  ['release','deployment','rollback','commit','build','pipeline','undo'],
  ['login','authentication','signin','credentials','token','access'],
  ['payment','invoice','billing','charge','receipt'],
  ['react','ui','button','layout','frontend','typography']
];
const embedder: Embedder = { async embed(texts) {
  return texts.map(t => {
    const words = new Set(t.toLowerCase().match(/[a-z]+/g) ?? []);
    return concepts.map(list => list.filter(w => words.has(w)).length);
  });
}};
const docs: Evidence[] = [
  ['db','Aurora database connection pool exhaustion'],
  ['deploy','Release rollback after failed build'],
  ['auth','Authentication token rejected during login'],
  ['bill','Invoice payment not reflected in receipt'],
  ['ui','React button layout and typography']
].map(([id,text]) => ({id: id!, text: text!, tenantId:'demo', source:'synthetic', authority:0.8, updatedAt:'2026-11-14'}));
const queries = [
  {task:'SQL connections exhausted', relevant:['db']},
  {task:'Undo deployment', relevant:['deploy']},
  {task:'Signin credentials issue', relevant:['auth']},
  {task:'Charge receipt missing', relevant:['bill']},
  {task:'Frontend layout problem', relevant:['ui']}
];
for (const algorithm of ['lexical','semantic'] as const) {
  let recall = 0, precision = 0;
  for (const {task,relevant} of queries) {
    const input = {task, documents:docs, tenantId:'demo', budgetTokens:12, now:new Date('2026-11-15T00:00:00Z')};
    const result = algorithm === 'lexical' ? buildContext({...input, minScore:0.25})
      : await buildSemanticContext({...input, embedder, semanticWeight:1, minScore:0.2});
    const predicted = result.selected.map(d => d.id);
    const hits = predicted.filter(id => relevant.includes(id)).length;
    recall += hits / relevant.length;
    precision += predicted.length ? hits / predicted.length : 0;
  }
  console.log(JSON.stringify({algorithm, fixture:'synthetic', queries:queries.length,
    meanRecall:+(recall/queries.length).toFixed(3), meanPrecision:+(precision/queries.length).toFixed(3)}));
}
