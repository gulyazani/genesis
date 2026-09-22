import { CatalogPage } from "@/components/catalog-page";
import { loadCatalog } from "@/lib/catalog-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StockPage() {
  const listings = await loadCatalog();
  return (
    <CatalogPage listings={listings} variant="ready" title="SATIŞA HAZIR" />
  );
}
