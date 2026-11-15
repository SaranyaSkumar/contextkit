import { readFile, writeFile } from 'node:fs/promises';
import { evaluateDataset, type EvaluationDataset } from './evaluation.js';
import { openAICompatibleEmbedder } from './embeddings.js';
const dataset = JSON.parse(await readFile(new URL('../datasets/engineering.json', import.meta.url), 'utf8')) as EvaluationDataset;
const model = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
const apiKey = process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY;
const baseUrl = process.env.EMBEDDING_BASE_URL;
if (!apiKey) {
  console.error('Real-model evaluation requires EMBEDDING_API_KEY or OPENAI_API_KEY. No model results were generated.');
  process.exitCode = 2;
} else {
  const rows = await evaluateDataset(dataset, { embedder: openAICompatibleEmbedder({ apiKey, model, baseUrl }) });
  console.table(rows.map(r => ({ method:r.method, recallAt3:r.recallAtK.toFixed(3), precisionAt3:r.precisionAtK.toFixed(3), mrrAt3:r.mrr.toFixed(3), meanLatencyMs:r.meanLatencyMs.toFixed(1) })));
  const report = { dataset: dataset.name, provenance:'hand-authored engineering fixtures; not independently verified', model, date: new Date().toISOString(), rows };
  if (process.env.EVALUATION_OUTPUT) await writeFile(process.env.EVALUATION_OUTPUT, JSON.stringify(report,null,2)+'\n', 'utf8');
}
