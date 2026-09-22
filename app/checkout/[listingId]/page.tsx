import { CheckoutPage } from "@/components/checkout-page";
import { loadListing } from "@/lib/catalog-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CheckoutRoute({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const listing = await loadListing(listingId);
  return <CheckoutPage listing={listing} />;
}
