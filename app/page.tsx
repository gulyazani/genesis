import { CatalogPage } from "@/components/catalog-page";
import { loadCatalog } from "@/lib/catalog-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const listings = (await loadCatalog()).filter((item) => item.type === "domain");
  return (
    <CatalogPage listings={listings} variant="domains" title="DOMAINLER" />
  );
}
