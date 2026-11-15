import { estimateTokens, terms, type Evidence, type SelectionResult, type SelectedEvidence } from './context.js';

export interface Embedder { embed(texts: readonly string[]): Promise<number[][]> }
export interface SemanticRequest {
  task: string; documents: readonly Evidence[]; tenantId: string;
  budgetTokens: number; embedder: Embedder; now?: Date;
  semanticWeight?: number; minScore?: number;
  estimateTokens?: (text: string) => number;
}
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (!a.length || a.length !== b.length) throw new RangeError('embedding dimensions must match and be nonempty');
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!, y = b[i]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('embeddings must be finite');
    dot += x*y; aa += x*x; bb += y*y;
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
export async function buildSemanticContext(request: SemanticRequest): Promise<SelectionResult> {
  const { task, tenantId, documents, budgetTokens, embedder } = request;
  const now = request.now ?? new Date();
  const weight = request.semanticWeight ?? 0.85, minScore = request.minScore ?? 0.2;
  const counter = request.estimateTokens ?? estimateTokens;
  if (!tenantId.trim()) throw new Error('tenantId is required');
  if (!Number.isSafeInteger(budgetTokens) || budgetTokens < 0) throw new RangeError('invalid token budget');
  if (!Number.isFinite(now.getTime())) throw new RangeError('invalid date');
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new RangeError('semanticWeight must be in [0,1]');
  if (!Number.isFinite(minScore) || minScore < 0 || minScore > 1) throw new RangeError('minScore must be in [0,1]');
  const excluded: Record<string,string> = {}, authorized: Evidence[] = [];
  for (const doc of documents) {
    if (doc.tenantId !== tenantId) { excluded[doc.id] = 'unauthorized_tenant'; continue; }
    if (!Number.isFinite(Date.parse(doc.updatedAt))) { excluded[doc.id] = 'invalid_date'; continue; }
    if (!Number.isFinite(doc.authority) || doc.authority < 0 || doc.authority > 1) { excluded[doc.id] = 'invalid_authority'; continue; }
    authorized.push(doc);
  }
  if (!authorized.length) return { selected: [], usedTokens: 0, excluded };
  const vectors = await embedder.embed([task, ...authorized.map(d => d.text)]);
  if (vectors.length !== authorized.length + 1) throw new Error('embedder returned wrong number of vectors');
  const taskVector = vectors[0]!, queryTerms = terms(task);
  const ranked = authorized.map((doc, i) => {
    const words = terms(doc.text);
    const lexical = queryTerms.size ? [...queryTerms].filter(w => words.has(w)).length / queryTerms.size : 0;
    const semantic = Math.max(0, cosineSimilarity(taskVector, vectors[i+1]!));
    const estimatedTokens = counter(doc.text);
    if (!Number.isSafeInteger(estimatedTokens) || estimatedTokens < 0) throw new RangeError('invalid tokenizer result');
    return { ...doc, score: weight * semantic + (1-weight)*lexical, estimatedTokens };
  }).sort((a,b) => b.score-a.score || a.id.localeCompare(b.id));
  const selected: SelectedEvidence[] = [];
  const seen = new Set<string>();
  let usedTokens = 0;
  for (const item of ranked) {
    if (item.score < minScore) { excluded[item.id] = 'low_relevance'; continue; }
    const fp = item.text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(fp)) { excluded[item.id] = 'duplicate'; continue; }
    if (usedTokens + item.estimatedTokens > budgetTokens) { excluded[item.id] = 'over_budget'; continue; }
    selected.push(item); seen.add(fp); usedTokens += item.estimatedTokens;
  }
  return { selected, usedTokens, excluded };
}
