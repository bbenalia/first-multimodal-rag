import type { Embedder } from "./types.js";

// Models register here. M1: add clip-b32 once you've written it.
const factories: Record<string, () => Promise<Embedder>> = {};

export function listModels(): string[] {
  return Object.keys(factories);
}

export async function getEmbedder(id: string): Promise<Embedder> {
  const factory = factories[id];
  if (!factory) throw new Error(`Unknown model "${id}". Known: ${listModels().join(", ") || "(none)"}`);
  return factory();
}

export function tableFor(id: string): string {
  return `embeddings_${id.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
}
