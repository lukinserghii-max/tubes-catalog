import { readFile } from "node:fs/promises";
import { retrieveCatalogProducts } from "../src/lib/catalog-retrieval.ts";

const catalog = JSON.parse(await readFile(new URL("../src/data/catalog-content.json", import.meta.url), "utf8"));
const resistanceGuide = catalog.find((product) => product.page === 157);
if (!resistanceGuide?.catalogText.includes("Сірчана кислота 10 ÷ 75%") || !resistanceGuide.catalogText.includes("A - висока стійкість")) throw new Error("Не знайдено таблицю хімічної стійкості зі сторінки 157");
const cases = [
  ["Потрібен шланг для 30% розчину сірчаної кислоти, 40°C, 6 бар, діаметр 25 мм, нагнітання", /MP 20|VACUPRESS|PLUTONE|MANIFLON|TEFLEX/, /барабан|фітинг|з'єднан/i],
  ["Підбери шланг для насиченої пари 180°C, 10 бар, діаметр 25 мм", /PATOS|MANITOBA|STEAM STAR|VICTORIA|VAPOFER/, /барабан|фітинг|кінцевик/i],
  ["Нужен шланг для дизельного топлива, 60°C, 8 бар, диаметр 32 мм", /TRICOFUEL|TECHNOBEL|CODAN|NAFTREX|CARBUR|FUEL/, /барабан|фітинг|з'єднан/i],
  ["Потрібен харчовий шланг для питної води, 20°C, 5 бар, діаметр 19 мм", /AQUA|ACQUA|SCOTLAND|FOOD|DRINK|PANAMA|ACAPULCO/, /пістолет|барабан|з'єднан/i],
  ["Під'єднання пістолетів для води до шлангу", /Під'єднання пістолетів|пістолет/i, /барабан/i],
];

for (const [query, expected, forbidden] of cases) {
  const results = retrieveCatalogProducts(catalog, query).map((item) => item.product);
  const names = results.map((product) => product.name).join(" | ");
  if (!expected.test(names)) throw new Error(`Немає очікуваного кандидата для «${query}»: ${names}`);
  if (results.some((product) => forbidden.test(product.name))) throw new Error(`Зайвий тип продукції для «${query}»: ${names}`);
  if (!results.every((product) => product.page >= 2 && product.page <= 1737)) throw new Error(`Некоректне джерело для «${query}»`);
  console.log(`${query}\n  ${names}`);
}

console.log(`OK: ${catalog.length} сторінок каталогу доступні для пошуку; таблиця концентрацій зі стор. 157 перевірена; зовнішні джерела не використовуються.`);
