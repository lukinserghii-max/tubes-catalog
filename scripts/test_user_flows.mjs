import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import catalog from "../src/data/catalog-index.json" with { type: "json" };

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = process.env.CATALOG_URL || "http://localhost:3210";
const edge = process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
fs.mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: edge });
const context = await browser.newContext({ locale: "uk-UA", viewport: { width: 1440, height: 768 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
page.on("requestfailed", (request) => {
  const reason = request.failure()?.errorText || "";
  if (reason === "net::ERR_ABORTED" && request.url().includes("_rsc=")) return;
  errors.push(`requestfailed: ${request.url()} ${reason}`);
});

const ensure = (condition, message) => { if (!condition) throw new Error(message); };
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Знайти обладнання" }).waitFor();
  ensure((await page.locator("body").innerText()).includes("1736"), "На головній не показано 1736 позицій");
  const searchBox = await page.locator("#catalog-search").boundingBox();
  ensure(searchBox && searchBox.y + searchBox.height <= 768, "Пошук каталогу не видно на першому екрані 1440×768");
  await page.screenshot({ path: path.join(artifacts, "first-screen.png") });

  await page.locator("#catalog-search").fill("химия");
  await page.getByText("Знайдено:").waitFor();
  ensure(await page.locator('a[href^="/product/"]').count() > 0, "Пошук «химия» не показав картки");
  const firstHref = await page.locator('a[href^="/product/"]').first().getAttribute("href");
  await page.locator('a[href^="/product/"]').first().click();
  await page.waitForURL((url) => url.pathname === firstHref);
  await page.getByRole("heading", { level: 1 }).waitFor();

  await page.goto(`${base}/#catalog`, { waitUntil: "networkidle" });
  const drums = catalog.sections.find((item) => item.name.startsWith("БАРАБАНИ"));
  ensure(drums, "У даних немає розділу барабанів");
  await page.getByRole("button", { name: `${drums.name} · ${drums.count}`, exact: true }).click();
  await page.getByText("Підрозділи", { exact: true }).waitFor();
  const drumProduct = catalog.products.find((product) => product.section === drums.name && product.categoryPath[1]);
  ensure(drumProduct, "Розділ барабанів не містить підрозділів");
  const categoryCount = catalog.products.filter((product) => product.section === drums.name && product.categoryPath[1] === drumProduct.categoryPath[1]).length;
  await page.getByRole("button", { name: `${drumProduct.categoryPath[1]} · ${categoryCount}`, exact: true }).click();
  ensure(await page.locator('a[href^="/product/"]').count() > 0, "Підрозділ барабанів порожній після фільтрації");
  const sidebar = page.locator("#catalog aside");
  await page.evaluate(() => window.scrollTo(0, 1100));
  await page.waitForTimeout(250);
  const stickyBox = await sidebar.boundingBox();
  ensure(stickyBox && stickyBox.y >= 0 && stickyBox.y <= 24, `Бічне меню не зафіксоване при прокрутці: y=${stickyBox?.y}`);

  await page.goto(`${base}/product/cristallo-extra-p2`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "CRISTALLO EXTRA", level: 1 }).waitFor();
  await page.getByRole("button", { name: "У кошик" }).first().click();
  await page.getByRole("button", { name: "Додано ✓" }).waitFor();
  await page.getByRole("link", { name: /Сторінка PDF: 2/ }).waitFor();

  await page.goto(`${base}/product/${encodeURIComponent("під-єднання-пістолетів-для-води-до-шлангу-подавання-p1484")}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Під'єднання пістолетів для води до шлангу подавання", level: 1 }).waitFor();
  ensure(await page.locator("img").count() > 0, "Сторінка 1484 не має фото");
  await page.getByText(/Сторінка PDF: 1484/).waitFor();

  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Запитати експерта" }).click();
  await page.locator("#expert-question").fill("Потрібен шланг для 30% розчину сірчаної кислоти, 40°C, 6 бар, діаметр 25 мм");
  await page.getByRole("button", { name: /Отримати відповідь/ }).click();
  await page.getByText("Джерела в каталозі", { exact: true }).waitFor({ timeout: 30_000 });
  const assistantText = await page.getByRole("dialog").innerText();
  ensure(!/wikipedia/i.test(assistantText), "AI-відповідь посилається на Wikipedia");
  ensure(/стор\. 157|сторінка 157/i.test(assistantText), "Для кислоти не додано таблицю стійкості зі сторінки 157");
  ensure(/ORLANDO®? EPR/i.test(assistantText), "Прямий приклад каталогу не рекомендує ORLANDO EPR");
  ensure(assistantText.includes("IV-ORLANDO-025"), "Відповідь не містить індекс для діаметра 25 мм");
  ensure(/AI-аналіз каталогу|Локальний пошук без AI-моделі/i.test(assistantText), "Не показано режим роботи помічника");
  await page.getByRole("button", { name: "Закрити" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: "networkidle" });
  ensure(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), "Головна має горизонтальний вихід за межі mobile viewport");
  await page.goto(`${base}/product/cristallo-extra-p2`, { waitUntil: "networkidle" });
  const productOverflow = await page.evaluate(() => ({
    fits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
    width: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("body *")].filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 2).slice(0, 8).map((element) => ({ tag: element.tagName, className: element.className, right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) })),
  }));
  ensure(productOverflow.fits, `Картка товару має горизонтальний вихід ${productOverflow.width}px: ${JSON.stringify(productOverflow.offenders)}`);

  await page.setViewportSize({ width: 1440, height: 768 });
  await page.goto(`${base}/#catalog`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(artifacts, "full-site-test.png"), fullPage: true });
  ensure(errors.length === 0, `Помилки браузера:\n${errors.join("\n")}`);
  console.log(`OK: пошук, перехід карткою, барабани/підрозділ, таблиця/кошик, стор. 1484, AI/стор. 157, mobile; скриншот ${path.join(artifacts, "full-site-test.png")}`);
} finally {
  await browser.close();
}
