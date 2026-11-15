import type { Embedder } from './semantic.js';

/** Local Ollama embeddings. Uses no paid API, SDK, or external embedding service. */
export function ollamaEmbedder(options: {
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
} = {}): Embedder {
  const model = options.model ?? 'nomic-embed-text';
  const baseUrl = (options.baseUrl ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? 120_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('timeoutMs must be positive');
  return {
    async embed(texts: readonly string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: [...texts], truncate: false }),
          signal: AbortSignal.timeout(timeoutMs)
        });
      } catch (cause) {
        throw new Error('Cannot reach local Ollama. Install Ollama, run "ollama pull ' + model + '", then start the Ollama service.', { cause });
      }
      if (!response.ok) throw new Error(`Local Ollama embedding request failed (HTTP ${response.status}). Ensure model "${model}" is downloaded.`);
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object' || !('embeddings' in payload) || !Array.isArray(payload.embeddings)) {
        throw new Error('Invalid local Ollama embedding response');
      }
      const vectors = payload.embeddings;
      if (vectors.length !== texts.length || !vectors.every(v => Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'number' && Number.isFinite(x)))) {
        throw new Error('Ollama returned invalid vectors or an unexpected vector count');
      }
      return vectors as number[][];
    }
  };
}
