// Генерація ілюстрацій товарів через OpenAI Images API (gpt-image-1).
// Результат: public/ai-products/<slug>.webp + маніфест src/data/ai-images.json.
//
// Приклади:
//   npm run images:generate -- --dry-run              # показати, що буде згенеровано
//   npm run images:generate                           # товари без фото з PDF
//   npm run images:generate -- --slug cristallo-extra-p2 --force
//   npm run images:generate -- --edit --slug cristallo-extra-p2   # почистити наявне фото з PDF
//   npm run images:generate -- --limit 5 --quality high

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "src", "data", "catalog-content.json");
const manifestPath = path.join(root, "src", "data", "ai-images.json");
const outputDir = path.join(root, "public", "ai-products");
const API_URL = "https://api.openai.com/v1/images";
const QUALITIES = new Set(["low", "medium", "high"]);
const SIZES = new Set(["1024x1024", "1536x1024", "1024x1536"]);

/** @typedef {{ slug: string; name: string; page: number; categoryPath: string[]; excerpt: string; images?: string[]; image?: string }} Product */
/** @typedef {{ src: string; model: string; mode: "generate" | "edit"; prompt: string; page: number; createdAt: string }} ManifestEntry */

function loadEnv() {
  // Ключі беремо з .env.local / .env, у коді нічого не зберігаємо
  for (const file of [".env.local", ".env"]) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    try { process.loadEnvFile(full); } catch (error) { console.warn(`Не вдалося прочитати ${file}: ${error.message}`); }
  }
}

function parseArgs(argv) {
  const args = { slugs: /** @type {string[]} */ ([]), limit: Infinity, force: false, dryRun: false, edit: false, quality: "medium", size: "1024x1024", concurrency: 2 };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`Для ${flag} потрібне значення`);
      return value;
    };
    if (flag === "--slug") args.slugs.push(...next().split(",").map((s) => s.trim()).filter(Boolean));
    else if (flag === "--limit") args.limit = Number(next());
    else if (flag === "--quality") args.quality = next();
    else if (flag === "--size") args.size = next();
    else if (flag === "--concurrency") args.concurrency = Number(next());
    else if (flag === "--force") args.force = true;
    else if (flag === "--dry-run") args.dryRun = true;
    else if (flag === "--edit") args.edit = true;
    else throw new Error(`Невідомий параметр: ${flag}`);
  }
  if (!QUALITIES.has(args.quality)) throw new Error(`--quality: ${[...QUALITIES].join(" | ")}`);
  if (!SIZES.has(args.size)) throw new Error(`--size: ${[...SIZES].join(" | ")}`);
  if (!Number.isFinite(args.limit) && args.limit !== Infinity) throw new Error("--limit має бути числом");
  if (!(args.concurrency >= 1 && args.concurrency <= 5)) throw new Error("--concurrency: 1..5");
  return args;
}

/** @param {Product} product */
function buildPrompt(product, edit) {
  const category = product.categoryPath.slice(-3).join(" / ");
  const description = product.excerpt.replace(/\s+/g, " ").trim().slice(0, 600);
  const rules = [
    "Plain pure white background, soft even studio lighting, sharp focus, realistic materials.",
    "No text, no labels, no logos, no watermarks, no people, no hands.",
    "Show the product alone, centered, fully in frame, slight 3/4 angle.",
  ].join(" ");
  if (edit) {
    return `Clean up this industrial product photo for an e-commerce catalog. Keep the exact shape, colors, proportions and construction of the product unchanged — do not invent new parts. Remove any background, page artifacts, captions and borders. ${rules}`;
  }
  return [
    `Professional e-commerce studio photo of an industrial product from the TUBES International catalog: "${product.name}".`,
    `Category: ${category}.`,
    `Catalog description (Ukrainian): ${description}`,
    "Depict a generic, realistic example of this product type as described, without brand-specific details that are not in the description.",
    rules,
  ].join("\n");
}

async function callOpenAI(endpoint, init, attempt = 1) {
  const response = await fetch(`${API_URL}/${endpoint}`, init);
  if (response.ok) return /** @type {{ data: { b64_json: string }[] }} */ (await response.json());
  const body = await response.text();
  // 429/5xx — повторюємо з експоненційною паузою
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    const delay = 2000 * 2 ** (attempt - 1);
    console.warn(`  OpenAI ${response.status}, повтор через ${delay / 1000}с`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return callOpenAI(endpoint, init, attempt + 1);
  }
  throw new Error(`OpenAI ${response.status}: ${body.slice(0, 500)}`);
}

/** @param {Product} product */
async function generate(product, prompt, options, apiKey, model) {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const common = { model, prompt, size: options.size, quality: options.quality, n: 1 };
  if (options.edit) {
    const reference = product.images?.[0] || product.image;
    if (!reference) throw new Error("немає фото з PDF для режиму --edit");
    const form = new FormData();
    for (const [key, value] of Object.entries({ ...common, output_format: "webp", output_compression: "85" })) form.append(key, String(value));
    const bytes = fs.readFileSync(path.join(root, "public", reference.replace(/^\//, "")));
    form.append("image[]", new Blob([bytes], { type: "image/webp" }), path.basename(reference));
    return callOpenAI("edits", { method: "POST", headers, body: form });
  }
  return callOpenAI("generations", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ...common, output_format: "webp", output_compression: 85, background: "opaque" }),
  });
}

/** @returns {Record<string, ManifestEntry>} */
function readManifest() {
  if (!fs.existsSync(manifestPath)) return {};
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function writeManifest(manifest) {
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`);
}

async function main() {
  loadEnv();
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  if (!apiKey && !options.dryRun) throw new Error("OPENAI_API_KEY не задано (.env.local)");

  /** @type {Product[]} */
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const manifest = readManifest();
  const bySlug = new Map(catalog.map((product) => [product.slug, product]));
  for (const slug of options.slugs) if (!bySlug.has(slug)) throw new Error(`Товар не знайдено: ${slug}`);

  const hasPdfImage = (/** @type {Product} */ p) => Boolean(p.images?.length || p.image);
  let queue = options.slugs.length
    ? options.slugs.map((slug) => /** @type {Product} */ (bySlug.get(slug)))
    : catalog.filter((p) => (options.edit ? hasPdfImage(p) : !hasPdfImage(p)));
  if (options.edit) queue = queue.filter(hasPdfImage);
  if (!options.force) queue = queue.filter((p) => !manifest[p.slug] || !fs.existsSync(path.join(root, "public", manifest[p.slug].src)));
  queue = queue.slice(0, options.limit);

  console.log(`Модель: ${model}, режим: ${options.edit ? "edit" : "generate"}, якість: ${options.quality}, розмір: ${options.size}`);
  console.log(`До генерації: ${queue.length}`);
  if (options.dryRun) {
    for (const product of queue) console.log(`- ${product.slug} (стор. ${product.page}): ${product.name}`);
    if (queue[0]) console.log(`\nПриклад промпта:\n${buildPrompt(queue[0], options.edit)}`);
    return;
  }

  fs.mkdirSync(outputDir, { recursive: true });
  let done = 0;
  const failed = /** @type {string[]} */ ([]);
  const worker = async () => {
    while (queue.length) {
      const product = /** @type {Product} */ (queue.shift());
      const prompt = buildPrompt(product, options.edit);
      try {
        const result = await generate(product, prompt, options, apiKey, model);
        const b64 = result.data?.[0]?.b64_json;
        if (!b64) throw new Error("порожня відповідь API");
        const src = `/ai-products/${product.slug}.webp`;
        fs.writeFileSync(path.join(root, "public", src), Buffer.from(b64, "base64"));
        manifest[product.slug] = { src, model, mode: options.edit ? "edit" : "generate", prompt, page: product.page, createdAt: new Date().toISOString() };
        // Зберігаємо маніфест після кожного успіху, щоб не втратити прогрес при збої
        writeManifest(manifest);
        done += 1;
        console.log(`OK ${product.slug}`);
      } catch (error) {
        failed.push(product.slug);
        console.error(`FAIL ${product.slug}: ${error instanceof Error ? error.message : error}`);
      }
    }
  };
  await Promise.all(Array.from({ length: options.concurrency }, worker));
  console.log(`\nГотово: ${done}, помилок: ${failed.length}${failed.length ? ` (${failed.join(", ")})` : ""}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
