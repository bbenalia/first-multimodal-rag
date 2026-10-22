# Plan: First multimodal RAG — text→image retrieval (learning project)

## Context
The user wants to learn how to build RAG systems by building their first multimodal one: type a text query and get the relevant images back. **Learning is the main goal**, so the design makes the internals visible (hand-written search and metrics, raw SQL, measured tradeoffs). Phase 1 is **retrieval only**. Generation (a vision LLM answering over the retrieved images) comes later, so retrieval is built as a standalone module that generation can call.

Working mode (Q12 = b): **Claude sets up the scaffolding** (monorepo, Docker, configs, UI shell, download script). **The user writes the core RAG pieces**, marked ✍️ below, and Claude guides and reviews. Each ✍️ task comes with a stub, failing tests and a short explainer.

## Decisions (settled in grilling)
| Topic | Decision |
|---|---|
| Scope | Retrieval only now; full RAG later |
| Data | Flickr30k test split (1k images × 5 captions) |
| Language | TypeScript everywhere, Node + Express |
| Repo | pnpm monorepo: `apps/api`, `apps/web` (Vue + Vite), `packages/core`, `docker-compose.yml` |
| Vector DB | pgvector in Docker (`pgvector/pgvector:pg17`), raw SQL via `pg` + `pgvector` npm |
| Embeddings | CLIP ViT-B/32 (`Xenova/clip-vit-base-patch32`) via `@huggingface/transformers`, behind a swappable `Embedder` interface |
| Multi-model storage | One table per model (`embeddings_<model>`), created from a model registry |
| Images | On disk in `data/flickr30k/`, served statically by Express; Postgres stores metadata, captions, vectors |
| Search | Exact (brute force) first → then HNSW and IVFFlat, measured against exact |
| Evals | Caption→image Recall@1/5/10 + MRR **and** a ~30-query hand-labeled golden set (Precision@K, nDCG) |
| Labeling | "Label mode" in the Vue app; candidates **pooled across all indexed models** to avoid bias toward one model |
| UI | Query box, image grid, score per image, model dropdown, exact/HNSW/IVFFlat toggle + latency, captions under images |
| Eval reporting | CLI that saves a JSON result per run, plus an "Evals" page in Vue comparing runs (model × index) |
| Framework step | LangChain.js (`PGVectorStore` + a custom CLIP `Embeddings` wrapper), after scratch version + evals work |
| Stretch | Hybrid search: Postgres full-text over captions + vector search, fused with RRF |

## Repo layout
```
docker-compose.yml          # pgvector/pgvector:pg17, port 5432, volume
pnpm-workspace.yaml
data/                       # gitignored: images, captions, golden set, eval runs
packages/core/src/
  embedders/  types.ts (Embedder interface), clip-b32.ts, registry.ts
  db/         client.ts, schema.ts (per-model table + index DDL)
  ingest/     download-flickr30k.ts, ingest.ts
  search/     vector.ts (exact | hnsw | ivfflat), hybrid.ts (stretch)
  eval/       metrics.ts, run-eval.ts, golden.ts
  math/       cosine.ts  (in-memory baseline)
apps/api/src/  server.ts — routes: GET /search, GET /images/*, golden-set CRUD, GET /evals
apps/web/src/  SearchView.vue, LabelView.vue, EvalsView.vue
```

## Milestones
**M0 — Scaffolding (Claude)**
pnpm workspace, TS configs, vitest, docker-compose with pgvector, `CREATE EXTENSION vector`, Express + Vue skeletons, `pnpm download` script that fetches the Flickr30k test split (Karpathy split: 1k images + 5 captions each) into `data/`.

**M1 — Embeddings, no DB**
- Claude: `Embedder` interface `{ id, dim, embedTexts(string[]), embedImages(paths[]) }`, plus the registry.
- ✍️ User: implement `clip-b32.ts` with transformers.js (`CLIPTextModelWithProjection` / `CLIPVisionModelWithProjection`), and L2-normalize the vectors.
- ✍️ User: `cosine.ts` + brute-force top-K in memory. First "search" happens in a script, before any DB exists.

**M2 — pgvector + ingestion**
- ✍️ User: `schema.ts` (tables `images`, `captions`, `embeddings_clip_b32 (image_id, embedding vector(512))`), `ingest.ts` (batched, idempotent, `pnpm ingest --model clip-b32`).
- ✍️ User: exact search SQL using `<=>` (cosine distance). Compare the results to the M1 in-memory search; they should be identical.

**M3 — Evals v1**
- ✍️ User: `metrics.ts` (recallAtK, mrr, precisionAtK, ndcgAtK) with unit tests on tiny hand-made examples.
- ✍️ User: `run-eval.ts`: 5k caption queries → Recall@1/5/10, MRR → prints a table and writes `data/eval-runs/<timestamp>.json`.
- Sanity check: CLIP B/32 zero-shot text→image on the Flickr30k 1k test split is published at roughly R@1 ≈ 59, R@5 ≈ 83, R@10 ≈ 90. Numbers far off mean a bug (e.g. vectors not normalized, preprocessing wrong).

**M4 — Search UI + API**
- Claude: Express `/search?q=&model=&index=&k=`, static images; Vue SearchView with all the Q17 features (scores, model dropdown, index toggle, latency, captions).
- ✍️ User: the API handler that calls core search and times the query.

**M5 — Golden set + label mode**
- Claude: LabelView shell. A query returns the top-50 candidates pooled across all indexed models (deduplicated and shuffled so rank doesn't bias you); click to mark relevant; saves to `data/golden.json`.
- ✍️ User: label ~30 queries; extend run-eval to report Precision@10 + nDCG@10 on the golden set.

**M6 — ANN indexes (HNSW, IVFFlat)**
- ✍️ User: index DDL (`USING hnsw (embedding vector_cosine_ops)`, `USING ivfflat … WITH (lists = N)`), query-time knobs (`SET hnsw.ef_search`, `SET ivfflat.probes`).
- Eval: recall vs. exact search and p50/p95 latency for each setting. Expect small speed gains at 1k images; the recall loss and the knobs are the lesson.

**M7 — Evals page**
- Claude: EvalsView reads all JSON runs → model × index × metrics table.

**M8 — Second model (proves swappability)**
- ✍️ User: add one more embedder (e.g. SigLIP base, or an API model like Voyage multimodal-3 / Cohere Embed v4) → new table via registry → ingest → eval → compare on the Evals page. Re-label pooled candidates for the golden set.

**M9 — LangChain.js comparison**
- ✍️ User: wrap the CLIP embedder in LangChain's `Embeddings` interface, use `PGVectorStore` for ingestion + search in a separate package/script, run the same eval, compare the numbers, the code size and what the framework hides (table layout, distance metric, batching).

**M10 — Stretch: Hybrid search + RRF**
- ✍️ User: `tsvector` column + GIN index on captions, keyword search with `ts_rank`, then fuse with vector results: `score = Σ 1/(60 + rank)`.
- **Eval rule:** evaluate hybrid search on the golden set only, *or* exclude each query's own caption from the keyword index. Otherwise caption queries match themselves and the metrics come out inflated.

**Later — Phase 2 (generation):** retrieve the top-K images → send them with the question to a vision LLM → an answer that cites the images.

## Verification
- `docker compose up -d` → `psql` shows the `vector` extension.
- `pnpm download && pnpm ingest --model clip-b32` → 1,000 rows in `embeddings_clip_b32`.
- `pnpm test` → metric unit tests pass.
- `pnpm eval --model clip-b32 --index exact` → R@1/5/10 near the published numbers.
- `pnpm eval --index hnsw` / `ivfflat` → recall ≤ exact; the run JSON is written.
- `pnpm dev` → open the Vue app, search "a dog running on the beach", see the images, switch model/index, see the latency change; label a query; see runs on the Evals page.
