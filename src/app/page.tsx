import catalog from "@/data/catalog-index.json";
import { CatalogExplorer } from "@/components/catalog-explorer";
import { cardImage } from "@/lib/ai-images";

// Підставляємо AI-ілюстрації для товарів без фото з PDF
const catalogWithImages = { ...catalog, products: catalog.products.map((product) => ({ ...product, ...cardImage(product.slug, product.image) })) };

export default function Home() {
  return <CatalogExplorer catalog={catalogWithImages} />;
}
