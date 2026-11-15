import type { Embedder } from './semantic.js';

/** Optional OpenAI-compatible embeddings adapter. No SDK dependency. */
export function openAICompatibleEmbedder(options: {
  apiKey: string; model: string; baseUrl?: string;
}): Embedder {
  if (!options.apiKey) throw new Error('apiKey is required');
  const baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
  return { async embed(texts) {
    if (!texts.length) return [];
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: options.model, input: texts })
    });
    if (!response.ok) throw new Error(`Embedding request failed: HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) throw new Error('Invalid embedding response');
    const data = payload.data as Array<{ index: number; embedding: number[] }>;
    if (data.length !== texts.length || data.some(d => !Number.isInteger(d.index) || !Array.isArray(d.embedding))) throw new Error('Invalid embedding count or shape');
    const sorted = [...data].sort((a,b) => a.index-b.index);
    if (sorted.some((d,i) => d.index !== i)) throw new Error('Invalid embedding indexes');
    return sorted.map(d => d.embedding);
  }};
}
