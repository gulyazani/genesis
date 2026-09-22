import { CatalogPage } from "@/components/catalog-page";
import { loadCatalog } from "@/lib/catalog-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const listings = await loadCatalog();
  return (
    <CatalogPage listings={listings} variant="domains" title="DOMAINLER" />
  );
}
