import cors from "cors";
import express from "express";
import { fileURLToPath } from "node:url";
import { listModels } from "@rag/core";

const app = express();
app.use(cors());

const imagesDir = fileURLToPath(new URL("../../../data/flickr30k/images", import.meta.url));
app.use("/images", express.static(imagesDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true, models: listModels() });
});

// M4 (you): GET /search?q=&model=&index=&k=

const port = Number(process.env.API_PORT ?? 3001);
app.listen(port, () => console.log(`api on http://localhost:${port}`));
