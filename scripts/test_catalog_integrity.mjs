import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import catalog from "../src/data/catalog-content.json" with { type: "json" };
import index from "../src/data/catalog-index.json" with { type: "json" };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const ids = new Set();
const slugs = new Set();
const pages = new Set();
let imageCount = 0;
let tableCount = 0;
let variantCount = 0;

for (const product of catalog) {
  check(product.id && !ids.has(product.id), `Повторний/порожній id: ${product.id}`);
  check(product.slug && !slugs.has(product.slug), `Повторний/порожній slug: ${product.slug}`);
  check(Number.isInteger(product.page) && product.page >= 2 && product.page <= index.meta.pages, `Хибна сторінка: ${product.id}`);
  check(product.source?.page === product.page, `Не збігається source.page: ${product.id}`);
  check(product.name?.trim(), `Порожня назва: ${product.id}`);
  check(product.section === product.categoryPath?.[0], `Порушена ієрархія: ${product.id}`);
  check(product.catalogText?.trim(), `Порожній текст каталогу: ${product.id}`);
  ids.add(product.id); slugs.add(product.slug); pages.add(product.page);

  const productVariants = new Set();
  for (const variant of product.variants || []) {
    check(variant.index?.trim(), `Порожній індекс: ${product.id}`);
    check(!productVariants.has(variant.index), `Повторний індекс ${variant.index}: ${product.id}`);
    productVariants.add(variant.index);
    variantCount += 1;
  }
  for (const table of product.tables || []) {
    check(Array.isArray(table) && table.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string")), `Пошкоджена таблиця: ${product.id}`);
    tableCount += 1;
  }
  for (const image of product.images || []) {
    check(/^\/catalog-products\/[^/]+\.webp$/.test(image), `Некоректний шлях зображення: ${image}`);
    const diskPath = path.join(root, "public", image.slice(1));
    check(fs.existsSync(diskPath) && fs.statSync(diskPath).size > 0, `Відсутнє зображення: ${image}`);
    imageCount += 1;
  }
  for (const crop of product.imageCrops || []) {
    const [x1, y1, x2, y2] = crop.bbox || [];
    check([x1, y1, x2, y2].every(Number.isFinite) && x2 > x1 && y2 > y1, `Некоректне обрізання: ${product.id}`);
  }
}

check(catalog.length === index.meta.products, `Кількість продуктів: ${catalog.length} != ${index.meta.products}`);
check(index.products.length === catalog.length, `Індекс містить ${index.products.length}, каталог ${catalog.length}`);
check(fs.existsSync(path.join(root, "public", "catalog.pdf")), "Відсутній public/catalog.pdf");
for (let page = 2; page <= index.meta.pages; page += 1) check(pages.has(page), `Немає товарної сторінки PDF ${page}`);
for (const section of index.sections) check(catalog.filter((product) => product.section === section.name).length === section.count, `Невірний лічильник розділу: ${section.name}`);
for (const item of index.products) check(ids.has(item.id), `Індекс посилається на відсутній товар: ${item.id}`);

if (failures.length) {
  console.error(failures.slice(0, 50).join("\n"));
  console.error(`ПОМИЛОК: ${failures.length}`);
  process.exit(1);
}
console.log(`OK: ${catalog.length} товарів, ${pages.size} сторінок, ${imageCount} фото, ${tableCount} таблиць, ${variantCount} індексів; PDF та ієрархія цілісні`);
