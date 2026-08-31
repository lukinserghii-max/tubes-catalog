import { readFile } from "node:fs/promises";

const baseUrl = process.env.CATALOG_URL || "http://localhost:3210";
const content = JSON.parse(await readFile(new URL("../src/data/catalog-content.json", import.meta.url), "utf8"));
const index = JSON.parse(await readFile(new URL("../src/data/catalog-index.json", import.meta.url), "utf8"));
const failures = [];

if (new Set(content.map((product) => product.id)).size !== content.length) failures.push("Обнаружены повторяющиеся ID товаров");
if (index.sections.reduce((sum, section) => sum + section.count, 0) !== content.length) failures.push("Сумма товаров по разделам не совпадает с каталогом");

const catalogResponse = await fetch(baseUrl);
const catalogHtml = await catalogResponse.text();
if (!catalogResponse.ok) failures.push(`Главная страница: HTTP ${catalogResponse.status}`);
for (const section of index.sections) {
  if (!catalogHtml.includes(section.name)) failures.push(`Раздел не отображается: ${section.name}`);
}

let cursor = 0;
let checked = 0;
const workers = Array.from({ length: 24 }, async () => {
  while (cursor < content.length) {
    const product = content[cursor++];
    const response = await fetch(`${baseUrl}/product/${encodeURIComponent(product.id)}`);
    const html = await response.text();
    if (!response.ok || !html.includes(`data-product-id="${product.id}"`)) {
      failures.push(`${product.page}: ${product.name} — HTTP ${response.status}`);
    }
    checked += 1;
    if (checked % 200 === 0) process.stdout.write(`Проверено ${checked}/${content.length}\n`);
  }
});

await Promise.all(workers);
if (failures.length) {
  console.error(`Ошибок: ${failures.length}`);
  console.error(failures.slice(0, 30).join("\n"));
  process.exit(1);
}
console.log(`OK: ${index.sections.length} разделов, ${checked} товаров, все URL открываются`);
