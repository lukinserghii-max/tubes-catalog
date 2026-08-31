export type CatalogProduct = {
  id: string;
  name: string;
  page: number;
  section: string;
  categoryPath: string[];
  excerpt: string;
  catalogText: string;
  tables?: string[][][];
  variants: { index: string; label: string; available: boolean }[];
};

const STOP = new Set([
  "для", "или", "при", "под", "через", "нужен", "нужна", "нужно", "какой", "какая", "можно", "подбери", "подобрать",
  "який", "яка", "потрібен", "потрібна", "потрібно", "підібрати", "підбери", "треба", "використати", "использовать",
  "робочий", "робоча", "рабочий", "рабочая", "внутрішній", "внутренний", "температура", "тиск", "давление", "діаметр", "диаметр",
  "бар", "bar", "мм", "mm", "градус", "градуси", "розчин", "розчину", "раствор", "раствора", "нагнітання", "всасывание", "подача",
]);

const ALIASES: Record<string, string[]> = {
  хим: ["хім", "хим", "chemical", "chemi"],
  кислот: ["кислот", "acid"],
  серн: ["сірчан", "сульфатн", "серн"],
  сірчан: ["сірчан", "сульфатн", "серн"],
  вода: ["вод", "aqua"],
  води: ["вод", "aqua"],
  пар: ["пар", "steam", "vapo"],
  воздух: ["повітр", "воздух", "air"],
  повітря: ["повітр", "воздух", "air"],
  дизель: ["дизел", "палив", "нафтопродукт", "fuel", "oil"],
  топлив: ["палив", "нафтопродукт", "fuel"],
  палив: ["палив", "нафтопродукт", "fuel"],
  масло: ["олив", "масл", "oil"],
  олива: ["олив", "масл", "oil"],
  пищ: ["харч", "food"],
  харч: ["харч", "food"],
  молок: ["молок", "milk"],
  газ: ["газ", "gas"],
  абразив: ["абразив", "abras"],
  шланг: ["шланг", "рукав", "hose"],
  рукав: ["шланг", "рукав", "hose"],
  фитинг: ["фітинг", "фитинг"],
  фітинг: ["фітинг", "фитинг"],
  соедин: ["з'єднан", "з’єднан", "з'єднувач", "з’єднувач", "соедин"],
  зєднан: ["з'єднан", "з’єднан", "з'єднувач", "з’єднувач", "соедин"],
  барабан: ["барабан", "котуш", "reel"],
  катуш: ["барабан", "котуш", "reel"],
  пистолет: ["пістолет", "пистолет", "gun"],
  пістолет: ["пістолет", "пистолет", "gun"],
};

function normalize(value: string) {
  return value.toLocaleLowerCase("uk").replace(/[’`]/g, "'").replace(/ё/g, "е");
}

function roots(message: string) {
  const words = normalize(message).match(/[\p{L}\p{N}-]+/gu) || [];
  const groups = words.filter((word) => word.length > 2 && !/^\d/.test(word) && !STOP.has(word)).map((word) => {
    const alias = Object.entries(ALIASES).find(([prefix]) => word.startsWith(prefix))?.[1];
    return alias || [word.length > 6 ? word.slice(0, -2) : word];
  });
  return groups.filter((group, index) => groups.findIndex((candidate) => candidate.join("\0") === group.join("\0")) === index);
}

function productKind(message: string) {
  const text = normalize(message);
  if (/шланг|рукав|hose/.test(text)) return "hose";
  if (/фитинг|фітинг|соедин|з'єднан|зєднан/.test(text)) return "fitting";
  if (/барабан|катуш|котуш|reel/.test(text)) return "reel";
  if (/пистолет|пістолет/.test(text)) return "gun";
  return "any";
}

function mediumKind(message: string) {
  const text = normalize(message);
  if (/пар|steam/.test(text)) return /пар|steam|vapo/;
  if (/кислот|хім|хим/.test(text)) return /хім|хим|chemical|chemi|кислот/;
  if (/дизел|палив|топлив|нафтопродукт/.test(text)) return /палив|нафтопродукт|fuel|oil/;
  if (/харч|пищ|молок/.test(text)) return /харч|пищ|food|milk|aqua|вод/;
  if (/вода|води|водн/.test(text)) return /вод|aqua/;
  if (/повітр|воздух/.test(text)) return /повітр|воздух|air/;
  return null;
}

function kindScore(kind: string, product: CatalogProduct) {
  const name = normalize(product.name);
  const category = normalize(product.categoryPath.join(" "));
  if (kind === "hose") {
    const isHose = /шланг|рукав|hose/.test(`${name} ${category}`);
    const accessory = /фітинг|з'єднан|з'єднувач|кінцевик|адаптор|обойм|хомут|фланц|аксесуар|барабан|котуш|пістолет|обпрес|обладнан|прес|reel/.test(name);
    return (isHose ? 30 : -60) + (accessory ? -55 : 0) + (product.variants.length ? 22 : -8);
  }
  if (kind === "fitting") return /фітинг|з'єднан|з'єднувач|кінцевик|адаптор|обойм|хомут/.test(`${name} ${category}`) ? 35 : -30;
  if (kind === "reel") return /барабан|котуш/.test(`${name} ${category}`) ? 35 : -30;
  if (kind === "gun") return /пістолет/.test(`${name} ${category}`) ? 35 : -30;
  return product.variants.length ? 8 : 0;
}

export function retrieveCatalogProducts(products: CatalogProduct[], message: string, limit = 6) {
  const queryGroups = roots(message);
  const kind = productKind(message);
  const medium = mediumKind(message);
  const selection = /підбер|підібр|потріб|нуж|подбер|выбр|обрати/.test(normalize(message));
  return products.map((product) => {
    const name = normalize(product.name);
    const category = normalize(product.categoryPath.join(" "));
    const text = normalize(product.catalogText);
    const variants = normalize(product.variants.map((variant) => variant.index).join(" "));
    const matchedGroups = queryGroups.map((group) => group.map((root) => ({ root, weight: (name.includes(root) ? 14 : 0) + (category.includes(root) ? 8 : 0) + (text.includes(root) ? 2 : 0) + (variants.includes(root) ? 18 : 0) })).map((match) => ({ ...match, weight: match.weight ? match.weight + 20 : 0 })).sort((a, b) => b.weight - a.weight)[0]).filter((match) => match?.weight);
    const matches = matchedGroups.map((match) => match.root);
    const lexical = matchedGroups.reduce((score, match) => score + match.weight, 0);
    const score = lexical + kindScore(kind, product) + (selection && product.variants.length ? 12 : 0);
    return { product, score, matches };
  }).filter((item) => item.matches.length && item.score > 0 && (!selection || item.product.variants.length > 0) && (kind !== "hose" || !medium || medium.test(normalize(`${item.product.name} ${item.product.categoryPath.join(" ")}`))))
    .sort((a, b) => b.score - a.score || b.product.variants.length - a.product.variants.length || a.product.page - b.product.page)
    .slice(0, limit);
}

export function missingSelectionData(message: string) {
  const text = normalize(message);
  const missing: string[] = [];
  if (!/(для|середовищ|речовин|вода|води|повітр|воздух|пар|газ|кислот|хім|хим|палив|топлив|олив|масл|молок|харч|пищ)/.test(text)) missing.push("речовина або робоче середовище");
  if (!/\d+(?:[.,]\d+)?\s*(?:°\s*)?c|температур/.test(text)) missing.push("робоча температура");
  if (!/\d+(?:[.,]\d+)?\s*(?:бар|bar|мпа|mpa)/.test(text)) missing.push("робочий тиск");
  if (!/(?:діаметр|диаметр|dn)\s*\d|\d+(?:[.,]\d+)?\s*мм/.test(text)) missing.push("внутрішній діаметр");
  if (/кислот|хім|хим|луг|розчин|раствор/.test(text) && !/\d+(?:[.,]\d+)?\s*%/.test(text)) missing.push("концентрація речовини");
  if (/шланг|рукав/.test(text) && !/всмок|нагніт|всасыв|напор|подач/.test(text)) missing.push("режим всмоктування або нагнітання");
  return missing;
}
