import { readFile } from 'node:fs/promises';
import { evaluateDataset, type EvaluationDataset } from './evaluation.js';
const dataset = JSON.parse(await readFile(new URL('../datasets/engineering.json', import.meta.url), 'utf8')) as EvaluationDataset;
console.table(await evaluateDataset(dataset));
