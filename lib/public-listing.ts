import type { Listing } from "@/lib/types";

const PUBLIC_KEYS = [
  "id",
  "type",
  "title",
  "url",
  "price",
  "currency",
  "status",
  "tier",
  "summary",
  "description",
  "highlights",
  "registrar",
  "expiresAt",
  "registeredAt",
  "deliveryNote",
  "pageCount",
  "authorityScore",
] as const;

export function toPublicListing(listing: Listing): Listing {
  const out = {} as Listing;
  for (const key of PUBLIC_KEYS) {
    if (listing[key] !== undefined) {
      (out as Record<string, unknown>)[key] = listing[key];
    }
  }
  return out;
}
