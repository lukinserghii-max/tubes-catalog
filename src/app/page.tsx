import catalog from "@/data/catalog-index.json";
import { CatalogExplorer } from "@/components/catalog-explorer";

export default function Home() {
  return <CatalogExplorer catalog={catalog} />;
}
