import { bustCatalogCaches } from "@/lib/catalog-cache";
import { mutateCatalog, readCredentials, readListings } from "@/lib/store";
import type {
  AdminListingRow,
  DeliveryMethod,
  Listing,
  ListingDelivery,
  ListingType,
} from "@/lib/types";

export function slugifyTitle(title: string) {
  const cleaned = title
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || `ilan-${Date.now()}`;
}

export async function listAdminListings(): Promise<AdminListingRow[]> {
  const [listings, credentials] = await Promise.all([
    readListings(),
    readCredentials(),
  ]);
  return listings.map((item) => {
    const creds = credentials[item.id];
    return {
      ...item,
      delivery: creds
        ? {
            method: creds.method,
            username: creds.username,
            url: creds.url,
            hasPassword: Boolean(creds.password),
          }
        : null,
    };
  });
}

function methodLabel(method: DeliveryMethod) {
  if (method === "cpanel") return "cPanel teslim";
  if (method === "wordpress") return "WordPress teslim";
  return "Link teslim";
}

export async function createAdminListing(input: {
  title: string;
  url?: string;
  price: number;
  type: ListingType;
  summary?: string;
  method: DeliveryMethod;
  username?: string;
  password?: string;
  loginUrl?: string;
}) {
  const title = input.title.trim();
  if (!title) return { error: "Domain / site adı yaz." };
  if (!Number.isFinite(input.price) || input.price < 1) {
    return { error: "Fiyat en az 1 USDT olsun." };
  }
  if (input.method === "link") {
    const link = (input.loginUrl || input.url || "").trim();
    if (!link) return { error: "Link yönteminde tek link zorunlu." };
  } else if (!input.username?.trim() || !input.password?.trim()) {
    return { error: "Kullanıcı ve şifre zorunlu." };
  }

  const id = slugifyTitle(title);
  const now = new Date().toISOString().slice(0, 10);
  const created = await mutateCatalog<
    { listing: Listing } | { error: string }
  >(({ listings, credentials }) => {
    if (listings.some((item) => item.id === id || item.title === title)) {
      return { error: "Bu ilan zaten var." };
    }
    const listing: Listing = {
      id,
      type: input.type,
      title,
      url: (input.url || input.loginUrl || "").trim() || undefined,
      price: input.price,
      currency: "USD",
      status: "available",
      tier: input.price >= 2000 ? "ust" : input.price >= 800 ? "orta" : "eko",
      summary: (input.summary || title).trim(),
      description: `${title} — supershell ilanı. Satın alınca giriş bilgisi Telegram'dan otomatik gider.`,
      highlights: [methodLabel(input.method), "Otomatik teslimat"],
      registeredAt: now,
      deliveryNote: "Ödeme sonrası bilgiler Telegram'dan otomatik iletilir.",
    };
    const delivery: ListingDelivery = {
      listingId: id,
      method: input.method,
      username: input.username?.trim() || undefined,
      password: input.password?.trim() || undefined,
      url: (input.loginUrl || input.url || "").trim() || undefined,
    };
    listings.push(listing);
    credentials[id] = delivery;
    return { listing };
  });
  if ("error" in created) return created;
  bustCatalogCaches(created.listing.id);
  return created;
}

export async function deleteAdminListing(id: string) {
  const result = await mutateCatalog<
    { ok: true } | { error: string }
  >(({ listings, credentials }) => {
    const index = listings.findIndex((item) => item.id === id);
    if (index < 0) return { error: "İlan bulunamadı." };
    listings.splice(index, 1);
    delete credentials[id];
    return { ok: true as const };
  });
  if ("error" in result) return result;
  bustCatalogCaches(id);
  return result;
}
