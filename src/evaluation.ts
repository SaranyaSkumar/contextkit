import { performance } from 'node:perf_hooks';
import { buildContext, type Evidence } from './context.js';
import { buildSemanticContext, type Embedder } from './semantic.js';

export type EvaluationCase = { id: string; query: string; relevantIds: string[]; tenantId: string };
export type EvaluationDataset = { name: string; documents: Evidence[]; cases: EvaluationCase[] };
export type EvaluationRow = { method: string; recallAtK: number; precisionAtK: number; mrr: number; meanLatencyMs: number; queries: number; k: number };

export function validateDataset(data: EvaluationDataset): void {
  if (!data.cases.length || !data.documents.length) throw new Error('Dataset must contain documents and queries');
  const ids = new Set<string>();
  for (const d of data.documents) {
    if (ids.has(d.id)) throw new Error(`Duplicate document id: ${d.id}`);
    ids.add(d.id);
  }
  for (const c of data.cases) {
    if (!c.relevantIds.length) throw new Error(`Query ${c.id} has no relevance labels`);
    for (const id of c.relevantIds) {
      const doc = data.documents.find(d => d.id === id);
      if (!doc || doc.tenantId !== c.tenantId) throw new Error(`Invalid relevance label ${id} in ${c.id}`);
    }
  }
}
export function scoreRanking(rankedIds: string[], relevantIds: string[], k: number) {
  if (!Number.isSafeInteger(k) || k < 1) throw new RangeError('k must be positive');
  const selected = rankedIds.slice(0, k), relevant = new Set(relevantIds);
  const hits = selected.filter(id => relevant.has(id)).length;
  const firstHit = selected.findIndex(id => relevant.has(id));
  return { recallAtK: hits / relevant.size, precisionAtK: hits / k, reciprocalRank: firstHit === -1 ? 0 : 1 / (firstHit + 1) };
}
export function cachedEmbedder(embedder: Embedder): Embedder {
  const cache = new Map<string, number[]>();
  return { async embed(texts) {
    const unseen = [...new Set(texts)].filter(t => !cache.has(t));
    if (unseen.length) {
      const vectors = await embedder.embed(unseen);
      if (vectors.length !== unseen.length) throw new Error('Embedding count mismatch');
      unseen.forEach((t, i) => cache.set(t, vectors[i]!));
    }
    return texts.map(t => cache.get(t)!);
  }};
}
export async function evaluateDataset(data: EvaluationDataset, options: {
  embedder?: Embedder; k?: number; budgetTokens?: number; now?: Date;
} = {}): Promise<EvaluationRow[]> {
  validateDataset(data);
  const k = options.k ?? 3, budgetTokens = options.budgetTokens ?? 10000;
  const now = options.now ?? new Date('2026-11-15T00:00:00Z');
  const methods = options.embedder ? ['lexical', 'semantic', 'hybrid'] as const : ['lexical'] as const;
  const cached = options.embedder && cachedEmbedder(options.embedder);
  const results: EvaluationRow[] = [];
  for (const method of methods) {
    let recall = 0, precision = 0, mrr = 0, elapsed = 0;
    for (const c of data.cases) {
      const input = { task: c.query, documents: data.documents, tenantId: c.tenantId, budgetTokens, now, minScore: 0 };
      const start = performance.now();
      const selected = method === 'lexical' ? buildContext(input).selected :
        (await buildSemanticContext({ ...input, embedder: cached!, semanticWeight: method === 'semantic' ? 1 : 0.85 })).selected;
      elapsed += performance.now() - start;
      const score = scoreRanking(selected.map(d => d.id), c.relevantIds, k);
      recall += score.recallAtK;
      precision += score.precisionAtK;
      mrr += score.reciprocalRank;
    }
    const n = data.cases.length;
    results.push({ method, recallAtK: recall/n, precisionAtK: precision/n,
      mrr: mrr/n, meanLatencyMs: elapsed/n, queries:n, k });
  }
  return results;
}
