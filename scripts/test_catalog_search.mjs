import { readFile } from "node:fs/promises";
import { matchesCatalogQuery } from "../src/lib/catalog-search.ts";

const products = JSON.parse(await readFile(new URL("../src/data/catalog-index.json", import.meta.url), "utf8")).products;
const queries = ["химия", "фитинг", "давление", "воздух", "топливо", "пищевой", "катушка", "оборудование", "хімія", "фітинг"];

for (const query of queries) {
  const count = products.filter((product) => matchesCatalogQuery(product, query)).length;
  if (!count) throw new Error(`Поиск не дал результатов: ${query}`);
  console.log(`${query}: ${count}`);
}

for (const product of products) {
  if (!matchesCatalogQuery(product, product.name)) throw new Error(`Не находится точное название: ${product.name}`);
}
console.log(`OK: проверены словари и ${products.length} точных названий`);
