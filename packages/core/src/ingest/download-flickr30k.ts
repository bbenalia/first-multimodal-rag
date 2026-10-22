import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parse } from "csv-parse/sync";

// Flickr30k Karpathy 1k test split: 1000 images x 5 captions.
const BASE = "https://huggingface.co/datasets/nlphuji/flickr_1k_test_image_text_retrieval/resolve/main";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../data/flickr30k");

export interface CaptionRecord {
  filename: string;
  captions: string[];
}

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`GET ${url} -> ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
}

async function main() {
  const captionsPath = join(ROOT, "captions.json");
  if (existsSync(captionsPath)) {
    console.log("Already downloaded:", ROOT);
    return;
  }
  await mkdir(ROOT, { recursive: true });

  const zipPath = join(ROOT, "images.zip");
  console.log("Downloading images (~140MB)...");
  await download(`${BASE}/images_flickr_1k_test.zip`, zipPath);
  // -j: flatten any folders inside the zip, so images land in images/
  execFileSync("unzip", ["-q", "-j", "-o", zipPath, "-d", join(ROOT, "images")]);
  await rm(zipPath);

  console.log("Downloading captions...");
  const csvPath = join(ROOT, "test_1k_flickr.csv");
  await download(`${BASE}/test_1k_flickr.csv`, csvPath);
  const rows = parse(await readFile(csvPath, "utf8"), { columns: true }) as { filename: string; raw: string }[];
  const records: CaptionRecord[] = rows.map((r) => ({ filename: r.filename, captions: JSON.parse(r.raw) }));
  await writeFile(captionsPath, JSON.stringify(records, null, 2));
  await rm(csvPath);

  console.log(`Done: ${records.length} images in ${ROOT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
