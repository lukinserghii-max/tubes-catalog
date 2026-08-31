"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { matchesCatalogQuery } from "@/lib/catalog-search";

type Product = { id: string; name: string; page: number; section: string; sectionUk?: string; excerpt: string; excerptUk?: string; categoryPath: string[]; image: string; variants: { index: string; label: string; available: boolean }[] };
type Catalog = { meta: { pages: number; products: number; categories: number; catalogYear: number }; sections: { name: string; slug: string; count: number }[]; products: Product[] };
type Answer = { text: string; products?: { id: string; name: string; page: number }[]; sources?: { title: string; url: string }[] };
const PAGE_SIZE = 18;

function Icon({ name }: { name: "search" | "arrow" | "spark" | "book" }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    spark: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function CatalogExplorer({ catalog }: { catalog: Catalog }) {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("all");
  const [category, setCategory] = useState("all");
  const [subcategory, setSubcategory] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const categories = useMemo(() => [...new Set(catalog.products.filter((product) => section !== "all" && product.section === section).map((product) => product.categoryPath[1]).filter(Boolean))].map((name) => ({ name, count: catalog.products.filter((product) => product.section === section && product.categoryPath[1] === name).length })), [catalog.products, section]);
  const subcategories = useMemo(() => [...new Set(catalog.products.filter((product) => section !== "all" && category !== "all" && product.section === section && product.categoryPath[1] === category).map((product) => product.categoryPath[2]).filter(Boolean))].map((name) => ({ name, count: catalog.products.filter((product) => product.section === section && product.categoryPath[1] === category && product.categoryPath[2] === name).length })), [catalog.products, section, category]);
  const filtered = useMemo(() => {
    return catalog.products.filter((product) => {
      if (section !== "all" && product.section !== section) return false;
      if (category !== "all" && product.categoryPath[1] !== category) return false;
      if (subcategory !== "all" && product.categoryPath[2] !== subcategory) return false;
      return matchesCatalogQuery(product, query);
    });
  }, [catalog.products, query, section, category, subcategory]);

  return <main>
    <header className="border-b-2 border-[var(--ink)] bg-[var(--panel)]">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-2.5 lg:px-10">
        <Link href="/" className="focus-ring flex items-center gap-2.5" aria-label="TUBES AI, главная"><span className="grid h-9 w-9 place-items-center bg-[var(--signal)] text-lg font-black text-white">T</span><span><b className="display block text-xl leading-none tracking-[.08em]">Tubes AI</b><small className="text-[9px] uppercase tracking-[.22em] text-[var(--muted)]">industrial intelligence</small></span></Link>
        <div className="hidden items-center gap-8 text-sm font-semibold lg:flex"><a className="focus-ring hover:text-[var(--signal)]" href="#catalog">Каталог</a><span className="text-[var(--muted)]">Джерело: TUBES International UA</span></div>
        <div className="flex items-center gap-2"><a href="/catalog.pdf" target="_blank" rel="noreferrer" className="focus-ring border-2 border-[var(--ink)] bg-[var(--panel)] px-3 py-2 text-sm font-bold hover:bg-[#e5e0d5]">PDF ↗</a><button onClick={() => setAssistantOpen(true)} className="focus-ring flex items-center gap-2 border-2 border-[var(--ink)] bg-[var(--ink)] px-4 py-2 font-bold text-white hover:bg-[var(--steel)]"><Icon name="spark"/><span className="hidden sm:inline">Запитати експерта</span><span className="sm:hidden">AI</span></button></div>
      </div>
    </header>

    <section className="relative overflow-hidden border-b-2 border-[var(--ink)] bg-[var(--steel)] text-white">
      <div className="absolute -right-24 -top-36 h-[420px] w-[420px] rounded-full border-[70px] border-white/10"/>
      <div className="mx-auto grid max-w-[1500px] gap-6 px-5 py-8 lg:grid-cols-[1.25fr_.75fr] lg:px-10 lg:py-10">
        <div className="rise relative z-10"><p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.24em] text-[#bfe8e8]"><span className="h-px w-10 bg-current"/>Каталог промислового обладнання</p><h1 className="display max-w-4xl text-4xl font-bold leading-[.9] tracking-[-.02em] sm:text-5xl lg:text-[64px]">Точний підбір починається з даних</h1><p className="mt-4 max-w-2xl text-base leading-relaxed text-white/80">Шланги, арматура, високий тиск і пневматика — структуру оригінального каталогу збережено. AI‑експерт допомагає знайти позицію та підготувати питання для інженера.</p></div>
        <div className="rise relative z-10 grid grid-cols-2 self-end border-2 border-white/50 bg-black/10 backdrop-blur-sm" style={{ animationDelay: "120ms" }}>{[["Позицій", catalog.meta.products], ["Розділів", catalog.meta.categories], ["Сторінок", catalog.meta.pages], ["Рік джерела", catalog.meta.catalogYear]].map(([label, value]) => <div key={label} className="border-b border-r border-white/25 p-4"><strong className="display block text-3xl text-[#ffb093]">{value}</strong><span className="text-[10px] uppercase tracking-[.16em] text-white/65">{label}</span></div>)}</div>
      </div>
    </section>

    <section id="catalog" className="mx-auto max-w-[1500px] px-5 py-10 lg:px-10 lg:py-16">
      <div className="mb-9 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--signal)]">Оригінальна ієрархія PDF</p><h2 className="display text-4xl font-bold sm:text-6xl">Знайти обладнання</h2></div><div className="relative w-full lg:w-[560px]"><label htmlFor="catalog-search" className="sr-only">Пошук за каталогом</label><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"><Icon name="search"/></span><input id="catalog-search" value={query} onChange={(event) => { setQuery(event.target.value); setVisible(PAGE_SIZE); }} placeholder="Назва, індекс, призначення…" className="focus-ring h-14 w-full border-2 border-[var(--ink)] bg-[var(--panel)] pl-12 pr-4 text-lg shadow-[5px_5px_0_var(--ink)] placeholder:text-[var(--muted)]"/></div></div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-3" aria-label="Розділи каталогу"><button onClick={() => { setSection("all"); setCategory("all"); setSubcategory("all"); setVisible(PAGE_SIZE); }} className={`focus-ring shrink-0 border-2 border-[var(--ink)] px-4 py-2 text-sm font-bold ${section === "all" ? "bg-[var(--ink)] text-white" : "bg-[var(--panel)]"}`}>Все · {catalog.meta.products}</button>{catalog.sections.map((item) => <button key={item.slug} onClick={() => { setSection(item.name); setCategory("all"); setSubcategory("all"); setVisible(PAGE_SIZE); }} className={`focus-ring shrink-0 border-2 border-[var(--ink)] px-4 py-2 text-sm font-bold ${section === item.name ? "bg-[var(--ink)] text-white" : "bg-[var(--panel)] hover:bg-[#e5e0d5]"}`}>{item.name} · {item.count}</button>)}</div>
      {section !== "all" && <div className="mb-7 border-2 border-[var(--ink)] bg-[var(--panel)] p-4 shadow-[4px_4px_0_rgba(20,34,38,.12)]"><div className="mb-2 flex items-center gap-3"><b className="display text-xl">Підрозділи</b><span className="text-xs text-[var(--muted)]">{section}</span></div><div className="flex gap-2 overflow-x-auto pb-2"><button onClick={() => { setCategory("all"); setSubcategory("all"); setVisible(PAGE_SIZE); }} className={`focus-ring shrink-0 border px-3 py-2 text-sm font-semibold ${category === "all" ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white hover:border-[var(--signal)]"}`}>Усі · {catalog.sections.find((item) => item.name === section)?.count || 0}</button>{categories.map((item) => <button key={item.name} onClick={() => { setCategory(item.name); setSubcategory("all"); setVisible(PAGE_SIZE); }} className={`focus-ring shrink-0 border px-3 py-2 text-sm font-semibold ${category === item.name ? "border-[var(--signal)] bg-[var(--signal)] text-white" : "border-[var(--line)] bg-white hover:border-[var(--signal)]"}`}>{item.name} · {item.count}</button>)}</div>{category !== "all" && subcategories.length > 0 && <><div className="mb-2 mt-3 border-t border-[var(--line)] pt-3 text-xs font-bold uppercase tracking-[.16em] text-[var(--muted)]">Категорії</div><div className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => { setSubcategory("all"); setVisible(PAGE_SIZE); }} className={`focus-ring shrink-0 border px-3 py-1.5 text-sm ${subcategory === "all" ? "border-[var(--ink)] bg-[#dbe7e5] font-bold" : "border-[var(--line)] bg-white"}`}>Усі</button>{subcategories.map((item) => <button key={item.name} onClick={() => { setSubcategory(item.name); setVisible(PAGE_SIZE); }} className={`focus-ring shrink-0 border px-3 py-1.5 text-sm ${subcategory === item.name ? "border-[var(--ink)] bg-[#dbe7e5] font-bold" : "border-[var(--line)] bg-white hover:border-[var(--signal)]"}`}>{item.name} · {item.count}</button>)}</div></>}</div>}
      <div className="mb-5 flex items-center justify-between border-b border-[var(--line)] pb-3 text-sm text-[var(--muted)]"><span>Знайдено: <b className="text-[var(--ink)]">{filtered.length}</b></span><span>Картки перекладено українською</span></div>
      {filtered.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.slice(0, visible).map((product, index) => <ProductCard key={product.id} product={product} index={index}/>)}</div> : <div className="border-2 border-dashed border-[var(--muted)] bg-[var(--panel)] p-12 text-center"><b className="display text-3xl">Нічого не знайдено</b><p className="mt-2 text-[var(--muted)]">Змініть запит або оберіть інший розділ.</p></div>}
      {visible < filtered.length && <button onClick={() => setVisible((value) => value + PAGE_SIZE)} className="focus-ring mx-auto mt-10 flex items-center gap-2 border-2 border-[var(--ink)] bg-[var(--panel)] px-7 py-3 font-bold shadow-[5px_5px_0_var(--ink)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none">Показати ще <Icon name="arrow"/></button>}
    </section>

    <section className="border-y-2 border-[var(--ink)] bg-[var(--signal)] text-white"><div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-5 py-9 lg:flex-row lg:items-center lg:justify-between lg:px-10"><div><h2 className="display text-4xl font-bold">Не знаєте, що обрати?</h2><p className="mt-1 max-w-2xl text-white/85">Вкажіть речовину, тиск, температуру та діаметр. Експерт знайде кандидатів і чесно позначить, чого бракує для перевірки.</p></div><button onClick={() => setAssistantOpen(true)} className="focus-ring flex shrink-0 items-center justify-center gap-2 border-2 border-white bg-white px-6 py-3 font-bold text-[var(--signal)] hover:bg-[var(--ink)] hover:text-white"><Icon name="spark"/>Відкрити AI‑експерта</button></div></section>
    <footer className="bg-[var(--ink)] text-white"><div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-5 py-8 text-sm text-white/65 sm:flex-row sm:items-center sm:justify-between lg:px-10"><span>Вітрина на основі українського каталогу TUBES International</span><span>Підбір потребує підтвердження інженером та актуальною документацією виробника.</span></div></footer>
    <Assistant open={assistantOpen} onClose={() => setAssistantOpen(false)}/>
  </main>;
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  return <Link href={`/product/${product.id}`} className="focus-ring group block h-full" aria-label={`${product.name} — відкрити характеристики`}><article className="rise paper-shadow flex h-full min-h-[390px] cursor-pointer flex-col border-2 border-[var(--ink)] bg-[var(--panel)] p-5 transition-transform duration-200 group-hover:-translate-y-1" style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}><div className="mb-4 flex items-start justify-between gap-4"><span className="border border-[var(--ink)] bg-[#dbe7e5] px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em]">{product.sectionUk || product.section}</span><span className="display text-sm text-[var(--muted)]">PDF / {product.page}</span></div><div className="mb-5 grid h-40 place-items-center overflow-hidden border border-[var(--line)] bg-white">{product.image ? <img src={product.image} alt={`Фото продукції: ${product.name}`} loading="lazy" className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-[1.03]"/> : <span className="text-sm text-[var(--muted)]">Фото у PDF відсутнє</span>}</div><h3 className="display text-3xl font-bold leading-none tracking-tight transition-colors group-hover:text-[var(--signal)]">{product.name}</h3><p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--muted)]">{product.excerptUk || product.excerpt || "Опис і параметри товару знаходяться на сторінці каталогу."}</p><div className="mt-auto flex items-center justify-between border-t border-[var(--line)] pt-4 font-bold"><span>Характеристики · {product.variants.length} інд.</span><span className="grid h-9 w-9 place-items-center border-2 border-[var(--ink)] bg-[var(--ink)] text-white transition-transform group-hover:translate-x-1"><Icon name="arrow"/></span></div></article></Link>;
}

function Assistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || loading) return;
    setLoading(true);
    try { const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) }); setAnswer(await response.json()); }
    catch { setAnswer({ text: "Не удалось связаться с экспертом. Попробуйте ещё раз." }); }
    finally { setLoading(false); }
  }
  if (!open) return null;
  return <div className="fixed inset-0 z-50 bg-black/55" role="dialog" aria-modal="true" aria-labelledby="assistant-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="ml-auto flex h-full w-full max-w-2xl flex-col bg-[var(--panel)] shadow-2xl"><div className="flex items-center justify-between border-b-2 border-[var(--ink)] bg-[var(--steel)] p-5 text-white"><div><p className="text-xs uppercase tracking-[.2em] text-white/70">TUBES AI</p><h2 id="assistant-title" className="display text-3xl font-bold">Експерт каталогу</h2></div><button onClick={onClose} className="focus-ring grid h-11 w-11 place-items-center border-2 border-white text-2xl" aria-label="Закрити">×</button></div><div className="flex-1 overflow-y-auto p-5 sm:p-7"><div className="border-l-4 border-[var(--signal)] bg-[#f1e7dc] p-4 text-sm leading-relaxed"><b>Єдине джерело знань — PDF-каталог TUBES International.</b> Для точного пошуку вкажіть речовину, концентрацію, температуру, тиск, внутрішній діаметр і режим роботи. Якщо каталог не містить відповіді, експерт не буде її вигадувати.</div>{answer ? <div className="mt-6 space-y-5"><div className="whitespace-pre-wrap leading-relaxed">{answer.text}</div>{answer.products?.length ? <div><b className="display text-xl">Знайдені позиції</b><div className="mt-2 grid gap-2">{answer.products.map((product) => <Link onClick={onClose} key={product.id} href={`/product/${product.id}`} className="focus-ring flex justify-between border border-[var(--line)] p-3 hover:border-[var(--signal)]"><span>{product.name}</span><span className="text-[var(--muted)]">стор. {product.page}</span></Link>)}</div></div> : null}{answer.sources?.length ? <div><b className="display text-xl">Джерела в каталозі</b><ul className="mt-2 list-disc space-y-1 pl-5">{answer.sources.map((source) => <li key={source.url}><a className="underline decoration-[var(--signal)] underline-offset-4" href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></div> : null}</div> : <div className="mt-10 text-center text-[var(--muted)]"><span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border-2 border-[var(--steel)] text-[var(--steel)]"><Icon name="book"/></span><p>Наприклад: «Потрібен шланг для 30% розчину сірчаної кислоти, 40°C, 6 бар»</p></div>}</div><form onSubmit={submit} className="border-t-2 border-[var(--ink)] p-4 sm:p-5"><label htmlFor="expert-question" className="sr-only">Питання експерту</label><textarea id="expert-question" value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="Опишіть середовище та умови роботи…" className="focus-ring w-full resize-none border-2 border-[var(--ink)] bg-white p-3"/><button disabled={loading || !message.trim()} className="focus-ring mt-3 flex w-full items-center justify-center gap-2 bg-[var(--signal)] px-5 py-3 font-bold text-white disabled:opacity-50">{loading ? "Перевіряю каталог…" : "Отримати відповідь"}<Icon name="arrow"/></button></form></aside></div>;
}
