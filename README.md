# ContextKit

A lightweight, provider-independent TypeScript proof of concept for context engineering in AI agents. Select task-relevant evidence within a token budget while keeping source provenance and recording exclusions.

> **Status:** v0.1 experimental. This is not a complete authorization, prompt-injection prevention or production retrieval system.

## Features

- Deterministic relevance scoring: lexical overlap, trusted authority and freshness
- Explicit tenant filtering before ranking
- Configurable evidence token budget and tokenizer hook
- Normalized text deduplication
- Evidence provenance and exclusion reasons
- No API key, database or LLM dependency
- Automated tests and GitHub Actions CI

## Quick start

Requires Node.js 22+.

```bash
npm install
npm run check
npm run demo
```

## Example

```ts
import { buildContext, renderContext } from './src/index.js';
const result = buildContext({
  task: 'Investigate Lambda database timeout',
  tenantId: 'engineering',
  budgetTokens: 200,
  documents: [{
    id: 'log-1',
    source: 'cloudwatch',
    tenantId: 'engineering',
    updatedAt: '2026-11-14',
    authority: 0.9,
    text: 'Lambda encountered an Aurora database timeout'
  }]
});
console.log(renderContext(result.selected));
```

## How it works

1. Reject unauthorized tenants and malformed metadata.
2. Compute lexical relevance, document authority and freshness.
3. Sort deterministically by score and ID.
4. Remove duplicate text and select whole documents within the budget.
5. Return selected evidence, estimated token cost, and exclusion reasons.

## Constraints and safety

- **Not a security boundary:** tenant filtering demonstrates one check, but production systems MUST enforce user/document ACLs at the source and on retrieval.
- **Untrusted content:** rendered evidence is data, never instructions. Delimiters do not mitigate prompt injection on their own.
- **Approximate tokens:** 4 characters per token is only a heuristic. Pass a model-specific `estimateTokens` function and reserve tokens for system prompts, conversation, tool schemas and output.
- **Metadata integrity:** `authority`, source identity and timestamps must come from trusted ingestion systems.
- **Relevance limitations:** keyword overlap misses synonyms. Ranking is not calibrated, and freshness can favor irrelevant new documents. The selector also works on whole documents only.
- **No persistence:** the initial release does not implement embeddings, memory, compaction, or integrations.

## Evaluation plan

Create 20-30 labeled tasks with known relevant evidence. Compare: all authorized documents, keyword top-K, and ContextKit. Record evidence Recall@K, precision, downstream grounded-answer correctness, prompt tokens, latency and security-policy violations. A smaller prompt is only an improvement if task quality is maintained or improved.

## Roadmap

- [ ] Chunk-level selection and semantic retrieval adapters
- [ ] Model-specific token counting and total prompt budgeting
- [ ] Reranking with citations
- [ ] Session compaction and persistent memory adapters
- [ ] MCP adapters and per-user/document access control
- [ ] Benchmark dataset and CI evaluation gates

## License

MIT
