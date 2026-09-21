import { CheckoutPage } from "@/components/checkout-page";

export default async function CheckoutRoute({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  return <CheckoutPage listingId={listingId} />;
}
