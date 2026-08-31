export type SearchableProduct = {
  name: string;
  section: string;
  sectionUk?: string;
  categoryPath: string[];
  excerpt: string;
  excerptUk?: string;
  variants: { index: string }[];
};

const ALIASES: [string[], string[]][] = [
  [["хим", "хім"], ["хим", "хім"]],
  [["соедин", "з'єд", "з’єд"], ["соедин", "з'єд", "з’єд"]],
  [["фитинг", "фітинг"], ["фитинг", "фітинг"]],
  [["давлен", "тиск"], ["давлен", "тиск"]],
  [["воздух", "повітр"], ["воздух", "повітр"]],
  [["топлив", "палив"], ["топлив", "палив"]],
  [["масл", "олив"], ["масл", "олив"]],
  [["пищ", "харч"], ["пищ", "харч"]],
  [["катуш", "котуш"], ["катуш", "котуш"]],
  [["измер", "вимір"], ["измер", "вимір"]],
  [["очист", "чищ"], ["очист", "чищ"]],
  [["смаз", "змащ"], ["смаз", "змащ"]],
  [["оборуд", "облад"], ["оборуд", "облад"]],
  [["инструм", "інструм"], ["инструм", "інструм"]],
];

const normalize = (value: string) => value.toLocaleLowerCase("uk").replaceAll("ё", "е");

export function matchesCatalogQuery(product: SearchableProduct, query: string) {
  const text = normalize(`${product.name} ${product.section} ${product.sectionUk || ""} ${product.categoryPath.join(" ")} ${product.excerpt} ${product.excerptUk || ""} ${product.variants.map((variant) => variant.index).join(" ")}`);
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return terms.every((term) => {
    const aliases = ALIASES.find(([prefixes]) => prefixes.some((prefix) => term.startsWith(prefix)))?.[1] || [term];
    return aliases.some((alias) => text.includes(alias));
  });
}
