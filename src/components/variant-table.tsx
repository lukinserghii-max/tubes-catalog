"use client";

import { useState } from "react";

type Variant = { index: string; label: string; available: boolean };
type Product = { id: string; name: string; page: number; previewImage: string; variants: Variant[]; tables: string[][][] };

function IndexValue({ value, image, name }: { value: string; image: string; name: string }) {
  if (!image) return value;
  return <span tabIndex={0} className="group/index relative inline-flex cursor-zoom-in items-center gap-1 outline-none"><span className="underline decoration-dotted underline-offset-4">{value}</span><span aria-hidden="true" className="text-[10px]">◫</span><span className="pointer-events-none invisible absolute left-full top-1/2 z-50 ml-3 w-64 -translate-y-1/2 opacity-0 transition duration-150 group-hover/index:visible group-hover/index:opacity-100 group-focus/index:visible group-focus/index:opacity-100"><span className="block border-2 border-[var(--ink)] bg-white p-2 shadow-[7px_7px_0_rgba(20,34,38,.24)]"><img src={image} alt={`Фото ${name}, індекс ${value}`} className="h-40 w-full object-contain"/><b className="mt-2 block truncate bg-[var(--ink)] px-2 py-1.5 text-center text-[10px] text-white">{value}</b></span></span></span>;
}

export function VariantTable({ product }: { product: Product }) {
  const [added, setAdded] = useState<string | null>(null);

  function add(variant: Variant) {
    const key = "tubes-cart";
    const cart = JSON.parse(localStorage.getItem(key) || "[]") as { id: string; productId: string; productName: string; index: string; qty: number }[];
    const existing = cart.find((item) => item.productId === product.id && item.index === variant.index);
    if (existing) existing.qty += 1;
    else cart.push({ id: `${product.id}:${variant.index}`, productId: product.id, productName: product.name, index: variant.index, qty: 1 });
    localStorage.setItem(key, JSON.stringify(cart));
    setAdded(variant.index);
    window.setTimeout(() => setAdded(null), 1400);
  }

  function rowVariant(row: string[]) {
    const cells = row.map((cell) => cell.toUpperCase());
    return product.variants.find((variant) => cells.some((cell) => cell.includes(variant.index.toUpperCase())));
  }

  return <section className="mt-10 border-2 border-[var(--ink)] bg-[var(--panel)] shadow-[7px_7px_0_rgba(20,34,38,.13)]">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[var(--ink)] p-5 sm:p-7"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--signal)]">Оригінальні характеристики</p><h2 className="display text-3xl font-bold">Таблиці з каталогу</h2></div><div className="text-right text-sm"><a href={`/catalog.pdf#page=${product.page}`} target="_blank" rel="noreferrer" className="focus-ring font-bold text-[var(--signal)] underline underline-offset-4">Сторінка PDF: {product.page} ↗</a><p className="mt-1 text-[var(--muted)]">{product.variants.length} індексів · активні рядки додаються в кошик</p></div></div>
    {product.tables.length ? <div className="space-y-8 p-4 sm:p-6">{product.tables.map((table, tableIndex) => {
      const firstProductRow = table.findIndex((row) => rowVariant(row));
      const headerCount = firstProductRow > 0 ? firstProductRow : 1;
      return <div key={tableIndex} className="overflow-x-auto border border-[var(--line)]"><table className="w-full min-w-[720px] border-collapse text-left text-xs"><thead className="bg-[#e8e5dc]">{table.slice(0, headerCount).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <th key={cellIndex} className="border border-[var(--line)] px-3 py-2 font-semibold">{cell}</th>)}{rowIndex === 0 ? <th rowSpan={headerCount} className="border border-[var(--line)] px-3 py-2 text-right">Дія</th> : null}</tr>)}</thead><tbody>{table.slice(headerCount).map((row, rowIndex) => { const variant = rowVariant(row); return <tr key={rowIndex} className={variant ? "bg-white" : "bg-white/45"}>{row.map((cell, cellIndex) => { const isIndex = Boolean(variant && cell.toUpperCase().includes(variant.index.toUpperCase())); return <td key={cellIndex} className={`border border-[var(--line)] px-3 py-2 align-top ${isIndex ? "min-w-[170px] whitespace-nowrap font-mono font-bold text-[var(--signal)]" : ""}`}>{isIndex ? <IndexValue value={cell} image={product.previewImage} name={product.name}/> : cell}</td>; })}<td className="border border-[var(--line)] px-3 py-2 text-right">{variant ? <button onClick={() => add(variant)} className="focus-ring whitespace-nowrap border-2 border-[var(--ink)] bg-[var(--ink)] px-3 py-1.5 font-bold text-white hover:bg-[var(--signal)]">{added === variant.index ? "Додано ✓" : "У кошик"}</button> : null}</td></tr>; })}</tbody></table></div>;
    })}</div> : product.variants.length ? <div className="overflow-x-auto"><table className="w-full min-w-[540px] border-collapse text-left text-sm"><thead className="bg-[#e8e5dc]"><tr><th className="px-5 py-3">Індекс</th><th className="px-5 py-3 text-right">Дія</th></tr></thead><tbody>{product.variants.map((variant) => <tr key={variant.index} className="border-t border-[var(--line)]"><td className="min-w-[170px] whitespace-nowrap px-5 py-3 font-mono font-semibold"><IndexValue value={variant.label} image={product.previewImage} name={product.name}/></td><td className="px-5 py-3 text-right"><button onClick={() => add(variant)} className="focus-ring whitespace-nowrap border-2 border-[var(--ink)] bg-[var(--ink)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--signal)]">{added === variant.index ? "Додано ✓" : "У кошик"}</button></td></tr>)}</tbody></table></div> : <p className="p-7 text-[var(--muted)]">Для цієї позиції PDF не містить окремої таблиці або індексу.</p>}
  </section>;
}
