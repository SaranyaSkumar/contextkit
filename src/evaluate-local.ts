import { readFile, writeFile } from 'node:fs/promises';
import { evaluateDataset, type EvaluationDataset } from './evaluation.js';
import { ollamaEmbedder } from './ollama.js';

const data = JSON.parse(await readFile(new URL('../datasets/engineering.json', import.meta.url), 'utf8')) as EvaluationDataset;
const model = process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text';
const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const started = Date.now();
const rows = await evaluateDataset(data, { embedder: ollamaEmbedder({ model, baseUrl }) });
console.table(rows.map(r => ({
  method: r.method, recallAt3: r.recallAtK.toFixed(3),
  precisionAt3: r.precisionAtK.toFixed(3),
  mrrAt3: r.mrr.toFixed(3), meanLatencyMs: r.meanLatencyMs.toFixed(1)
})));
const report = {
  dataset: data.name,
  provenance: 'hand-authored engineering fixtures, not independently validated',
  provider: 'local-ollama', model,
  generatedAt: new Date().toISOString(),
  elapsedMs: Date.now() - started, rows
};
if (process.env.EVALUATION_OUTPUT) {
  await writeFile(process.env.EVALUATION_OUTPUT, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Report written to ${process.env.EVALUATION_OUTPUT}`);
}
