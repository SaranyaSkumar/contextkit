# ContextKit

Lightweight, provider-independent TypeScript context engineering for AI agents.

> **v0.3 experimental:** not a complete authorization, prompt-injection prevention, or production vector-search system.

## Features

- Original lexical selector with trusted authority/freshness weighting
- Optional semantic or hybrid relevance via an injected `Embedder`
- Optional OpenAI-compatible embeddings HTTP adapter, without SDK dependency
- Tenant filtering **before** invoking an external embedding API
- Deterministic deduplication, token budgets, source provenance, and exclusion reasons
- Reproducible synthetic lexical-versus-semantic retrieval benchmark
- Tests and GitHub Actions CI

## Run

Requires Node.js 22+.

```bash
npm install
npm run check
npm run demo
npm run benchmark
```

The existing lexical `buildContext` requires **no API key**. The semantic selector takes any adapter implementing `embed(texts): Promise<number[][]>`.

## Semantic selection

```ts
import { buildSemanticContext, openAICompatibleEmbedder } from './src/index.js';

const embedder = openAICompatibleEmbedder({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small'
});
const result = await buildSemanticContext({
  task: 'Investigate SQL connection exhaustion',
  tenantId: 'engineering',
  budgetTokens: 1000,
  documents: [{
    id: 'log-1',
    source: 'cloudwatch',
    text: 'Aurora database connections exhausted',
    tenantId: 'engineering',
    updatedAt: '2026-11-14',
    authority: 0.9
  }],
  embedder
});
console.log(result.selected, result.excluded);
```

You can replace the adapter with a local embeddings provider, such as an Ollama-compatible endpoint, or a Qdrant/pgvector retrieval adapter in a future version. The default endpoint is OpenAI-compatible; pass `baseUrl` when using another compatible service.

## Benchmark

`npm run benchmark` compares the original lexical selector with semantic scoring using **five synthetic, synonym-based tasks**. The benchmark uses a **handcrafted concept-vector embedder**, not a real model. It validates metric and ranking plumbing but **cannot establish real-world embedding effectiveness**.

Metrics currently include mean evidence recall and precision. Future validation should include held-out human-labelled queries, meaningful Recall@K, downstream answer accuracy, end-to-end latency, model cost, and access-control violations. Compare both approaches at the same evidence token budget.

## Architecture

```text
Task + authorized candidate documents
               |
    Tenant/metadata filtering
               |
    Query and document embeddings
               |
    Cosine similarity + lexical overlap
               |
    Relevance threshold + deduplication
               |
    Evidence budget + exclusion reasons
               |
    Selected context with provenance
```

## Security and limitations

- **Tenant checking is illustrative, not sufficient authorization.** Enforce user- and document-level ACLs at the data source **before retrieval and external embeddings**.
- Document text must be treated as untrusted. Source delimiters are not prompt-injection protection.
- Authority and timestamps must originate in trusted ingestion systems.
- The prototype embeds all authorized candidate texts per request. Cache embeddings or use a vector index for scale.
- Cosine scores are not calibrated probabilities. Tune thresholds with labelled data.
- Approximate token counts only cover evidence, not instructions, message history or output.
- Avoid sending confidential evidence to external providers without organizational approval.
- Failures from the embedding provider are surfaced; production clients need retry, timeout and backoff policies.

## Roadmap

- [x] Optional semantic/hybrid retrieval
- [x] Deterministic retrieval benchmark fixture
- [ ] Real embedding evaluation dataset and automated regression thresholds
- [ ] Persistent vector index, caching and chunking
- [ ] Source-side document permissions and per-user ACL adapters
- [ ] Session compaction and persistent memory
- [ ] MCP integration and grounding evaluation

## License

MIT

## Free, fully local semantic evaluation (recommended)

**No paid API, API key or subscription required.** Install [Ollama](https://ollama.com/download) on your machine, then download a local open-weight embedding model (one-time download, around 274 MB):

```bash
ollama pull nomic-embed-text
# Keep Ollama running (use `ollama serve` if your installation does not start the service automatically)
npm install
npm run evaluate:local
```

The runner connects only to `http://127.0.0.1:11434/api/embed` by default. It compares lexical, semantic and hybrid methods on the existing labelled dataset. You can write a report with `EVALUATION_OUTPUT=local-results.json npm run evaluate:local`. If needed, specify `OLLAMA_EMBEDDING_MODEL` and `OLLAMA_BASE_URL`.

Ollama processes embeddings locally after the initial model download. No ongoing paid API use; resource costs are your computer's disk, CPU/RAM and electricity. The benchmark cannot run until Ollama and the model are installed locally. GitHub-hosted CI does **not** download the model, and therefore does not claim a local embedding benchmark result. The earlier `npm run evaluate:real` command remains an **optional** external-API integration, never required.

## Labelled retrieval evaluation (v0.3)

The `datasets/engineering.json` fixture includes **20 hand-authored, synthetic engineering documents and 20 labelled queries**. Topics include AWS, Lambda, SQS, GIS, RAG, security, agent memory and field reports. The labels are illustrative and have **not** been independently verified against real production documents.

First run the credential-free lexical baseline:

```bash
npm run evaluate:lexical
```

Then compare it with a **real embedding model** (API use may incur charges):

```bash
export EMBEDDING_API_KEY='YOUR_API_KEY'
export EMBEDDING_MODEL='text-embedding-3-small'
# Optional: EMBEDDING_BASE_URL for OpenAI-compatible services
EVALUATION_OUTPUT=results.json npm run evaluate:real
```

The runner compares lexical, semantic-only and hybrid ranking on the **same authorized corpus, queries and evidence budget** and reports Recall@3, Precision@3, MRR@3 and mean end-to-end per-query latency. It caches identical embeddings across cases and approaches in a single run; latency is therefore sensitive to warm-cache order. Results are not meaningful for provider comparison without repeating runs with controlled caching and network conditions.

There is deliberately **no API key in the repository or GitHub Actions**, and the real-model runner fails explicitly when credentials are missing. CI runs the lexical fixture and unit tests only, never silently claims a real-model evaluation.

Limitations: 20 authored queries are suitable for integration testing, not production statistical claims. Before making adoption decisions, collect permission-cleared real engineering queries, label relevant document versions with domain experts, include hard negative examples, compare multiple seeds or samples, and record recall, end-task correctness, p95 latency, token usage and actual API billing. Never commit API keys or confidential business documents.
