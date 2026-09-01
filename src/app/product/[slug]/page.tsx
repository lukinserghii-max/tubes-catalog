import Link from "next/link";
import { notFound } from "next/navigation";
import products from "@/data/catalog-content.json";
import { QuoteButton } from "@/components/quote-button";
import { VariantTable } from "@/components/variant-table";

type Product = (typeof products)[number] & { sectionUk?: string; categoryPathUk?: string[]; excerptUk?: string; catalogTextUk?: string; image: string; images?: string[]; tables?: string[][][]; variants: { index: string; label: string; available: boolean }[] };

function findProduct(slug: string) {
  try { slug = decodeURIComponent(slug); } catch { /* Keep the original value for malformed URLs. */ }
  return (products as Product[]).find((item) => item.slug === slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = findProduct(slug);
  return { title: product ? `${product.name} — TUBES AI` : "Товар не найден" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = findProduct(slug);
  if (!product) notFound();
  const previewImage = product.image || (products as Product[]).filter((item) => item.image && item.categoryPath.join("\0") === product.categoryPath.join("\0")).sort((a, b) => Math.abs(a.page - product.page) - Math.abs(b.page - product.page))[0]?.image || "";
  return <main data-product-id={product.id} className="min-h-screen">
    <header className="border-t-4 border-[var(--signal)] bg-white shadow-[0_1px_0_rgba(19,23,24,.18)]"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3"><Link href="/" className="focus-ring flex items-center"><img src="https://www.tubes-international.com/wp-content/uploads/2024/02/logo-tubes-international.svg" alt="TUBES International" className="h-12 w-auto" /></Link><div className="flex items-center gap-3"><a href={`/catalog.pdf#page=${product.page}`} target="_blank" rel="noreferrer" className="focus-ring border-2 border-[var(--ink)] px-3 py-2 text-sm font-bold hover:border-[var(--signal)] hover:text-[var(--signal)]">PDF · стор. {product.page} ↗</a><Link href="/#catalog" className="focus-ring border-b-2 border-[var(--signal)] font-bold">← Каталог</Link></div></div></header>
    <div className="mx-auto max-w-6xl px-5 py-10 lg:py-16">
      <nav className="mb-8 flex flex-wrap gap-2 text-sm text-[var(--muted)]" aria-label="Навігаційний шлях">{(product.categoryPathUk || product.categoryPath).map((item, index) => <span key={`${item}-${index}`} className="after:ml-2 after:content-['/'] last:after:content-none">{item}</span>)}</nav>
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center gap-3"><span className="border border-[var(--ink)] bg-[#dbe7e5] px-3 py-1 text-xs font-bold uppercase tracking-[.12em]">{product.sectionUk || product.section}</span><span className="display text-[var(--muted)]">Джерело: PDF, стор. {product.page}</span></div>
          <h1 className="display text-5xl font-bold leading-[.92] sm:text-7xl">{product.name}</h1>
          {(product.images?.length || product.image) ? <div className="mt-7 grid gap-4 border-2 border-[var(--ink)] bg-white p-4 sm:grid-cols-2">{(product.images?.length ? product.images : [product.image]).map((image, index) => <img key={image} src={image} alt={`Фото продукції ${product.name}${index ? `, ${index + 1}` : ""}`} className="max-h-[360px] w-full object-contain"/>)}</div> : <div className="mt-7 grid h-48 place-items-center border-2 border-dashed border-[var(--muted)] bg-white text-[var(--muted)]">Фото продукції у PDF відсутнє</div>}
          <p className="mt-6 border-l-4 border-[var(--signal)] pl-5 text-lg leading-relaxed text-[var(--muted)]">{product.excerptUk || product.excerpt}</p>
          <VariantTable product={{ id: product.id, name: product.name, page: product.page, previewImage: product.section.toLocaleUpperCase("uk").includes("ШЛАНГ") ? "" : previewImage, variants: product.variants, tables: product.tables || [] }} />
          <section className="mt-10 border-2 border-[var(--ink)] bg-[var(--panel)] p-5 shadow-[7px_7px_0_rgba(20,34,38,.13)] sm:p-8"><div className="mb-5 flex items-center justify-between border-b border-[var(--line)] pb-4"><h2 className="display text-3xl font-bold">Дані каталогу</h2><span className="text-sm text-[var(--muted)]">Оригінал українською</span></div><p className="whitespace-pre-wrap leading-7">{product.catalogTextUk || product.catalogText}</p></section>
        </article>
        <aside className="lg:sticky lg:top-6 lg:self-start"><div className="border-2 border-[var(--ink)] bg-[var(--ink)] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#ffb093]">Запит пропозиції</p><h2 className="display mt-2 text-4xl font-bold">Ціна за запитом</h2><p className="mt-4 text-sm leading-relaxed text-white/70">Каталог не містить актуальних цін і залишків. Додайте позицію до запиту — менеджер уточнить виконання та доступність.</p><QuoteButton product={{ id: product.id, name: product.name, page: product.page }}/></div><div className="mt-5 border-2 border-[var(--ink)] bg-[#f1e7dc] p-5"><b className="display text-xl">Важливо для підбору</b><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]"><li>речовина та концентрація;</li><li>температура і тиск;</li><li>внутрішній діаметр;</li><li>всмоктування або нагнітання;</li><li>сертифікати та галузеві норми.</li></ul></div></aside>
      </div>
    </div>
  </main>;
}
