import { ListingDetail } from "@/components/listing-detail";
import { loadListing } from "@/lib/catalog-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await loadListing(id);
  return (
    <ListingDetail
      listing={listing}
      error={listing ? null : "İlan bulunamadı."}
    />
  );
}
