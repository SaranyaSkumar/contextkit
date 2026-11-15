/** Context selection functions. No LLM or provider dependency. */
export interface Evidence {
  id: string;
  text: string;
  source: string;
  tenantId: string;
  updatedAt: string;
  authority: number; // 0..1, supplied by trusted ingestion code
}

export interface SelectedEvidence extends Evidence {
  score: number;
  estimatedTokens: number;
}

export interface SelectionResult {
  selected: SelectedEvidence[];
  usedTokens: number;
  excluded: Record<string, string>;
}

export interface ContextRequest {
  task: string;
  documents: readonly Evidence[];
  tenantId: string;
  budgetTokens: number;
  now?: Date;
  minScore?: number;
  estimateTokens?: (input: string) => number;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'in', 'of', 'to', 'for', 'is',
  'was', 'did', 'why', 'what', 'with', 'on', 'my', 'our', 'this', 'that'
]);

export function terms(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter(word => word.length > 2 && !STOP_WORDS.has(word)));
}

/** Approximate only; use the target model tokenizer in production. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function scoreDocument(taskTerms: Set<string>, evidence: Evidence, now: Date): number {
  const documentTerms = terms(evidence.text);
  const matches = [...taskTerms].filter(word => documentTerms.has(word)).length;
  const lexical = taskTerms.size ? matches / taskTerms.size : 0;
  const ageDays = Math.max(0, (now.getTime() - Date.parse(evidence.updatedAt)) / 86_400_000);
  const freshness = Math.exp(-ageDays / 90);
  return lexical * 0.75 + evidence.authority * 0.15 + freshness * 0.10;
}

function fingerprint(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Selects a deterministic, budget-constrained subset of authorized evidence. */
export function buildContext(request: ContextRequest): SelectionResult {
  const { task, documents, tenantId, budgetTokens } = request;
  const now = request.now ?? new Date();
  const tokenCounter = request.estimateTokens ?? estimateTokens;
  const minScore = request.minScore ?? 0.25;
  if (!Number.isSafeInteger(budgetTokens) || budgetTokens < 0) throw new RangeError('budgetTokens must be a nonnegative integer');
  if (!Number.isFinite(now.getTime())) throw new RangeError('now must be a valid date');
  if (!Number.isFinite(minScore) || minScore < 0 || minScore > 1) throw new RangeError('minScore must be in [0,1]');
  if (!tenantId.trim()) throw new Error('tenantId is required');
  const taskTerms = terms(task);
  const excluded: Record<string, string> = {};
  const candidates: SelectedEvidence[] = [];
  for (const document of documents) {
    if (document.tenantId !== tenantId) { excluded[document.id] = 'unauthorized_tenant'; continue; }
    if (!Number.isFinite(Date.parse(document.updatedAt))) { excluded[document.id] = 'invalid_date'; continue; }
    if (!Number.isFinite(document.authority) || document.authority < 0 || document.authority > 1) {
      excluded[document.id] = 'invalid_authority'; continue;
    }
    const score = scoreDocument(taskTerms, document, now);
    if (score < minScore) { excluded[document.id] = 'low_relevance'; continue; }
    const estimatedTokens = tokenCounter(document.text);
    if (!Number.isSafeInteger(estimatedTokens) || estimatedTokens < 0) throw new RangeError('token counter returned an invalid value');
    candidates.push({ ...document, score, estimatedTokens });
  }
  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const selected: SelectedEvidence[] = [];
  const seen = new Set<string>();
  let usedTokens = 0;
  for (const document of candidates) {
    const key = fingerprint(document.text);
    if (seen.has(key)) { excluded[document.id] = 'duplicate'; continue; }
    if (usedTokens + document.estimatedTokens > budgetTokens) {
      excluded[document.id] = 'over_budget'; continue;
    }
    seen.add(key);
    selected.push(document);
    usedTokens += document.estimatedTokens;
  }
  return { selected, usedTokens, excluded };
}

/** Data formatting only. Never treat retrieved evidence as instructions. */
export function renderContext(selected: readonly SelectedEvidence[]): string {
  return selected.map(({ id, source, updatedAt, text }) => [
    `--- EVIDENCE ${JSON.stringify(id)} ---`,
    `Source: ${JSON.stringify(source)}`,
    `Updated: ${JSON.stringify(updatedAt)}`,
    'BEGIN UNTRUSTED REFERENCE TEXT',
    text,
    'END UNTRUSTED REFERENCE TEXT'
  ].join('\n')).join('\n\n');
}
