export interface Embedder {
  /** Stable id, also used in the table name: embeddings_<id with _>. */
  id: string;
  dim: number;
  /** Returns one L2-normalized vector per input text. */
  embedTexts(texts: string[]): Promise<number[][]>;
  /** Returns one L2-normalized vector per image path. */
  embedImages(paths: string[]): Promise<number[][]>;
}
