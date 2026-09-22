import type { Listing, ListingStatus, OrderStatus } from "@/lib/types";

export function formatUsdt(amount: number) {
  return `${new Intl.NumberFormat("tr-TR").format(amount)} USDT`;
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function yearsSince(iso?: string) {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, ms / (365.25 * 24 * 60 * 60 * 1000));
}

export function listingMetric(listing: Listing) {
  if (listing.type === "website") {
    const pages = listing.pageCount ?? 0;
    return {
      label: "SAYFA",
      value: pages,
      fill: Math.min(100, (pages / 40) * 100),
    };
  }
  const years = Math.round(yearsSince(listing.registeredAt) * 10) / 10;
  return {
    label: "KAYIT YAŞI",
    value: years < 1 ? Math.round(years * 12) / 10 : Math.round(years),
    fill: Math.min(100, (years / 12) * 100),
  };
}

export function statusLabel(status: ListingStatus) {
  if (status === "available") return "Satılık";
  if (status === "reserved") return "Ödeme bekleniyor";
  return "Satıldı";
}

export function orderStatusLabel(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "Ödeme bekleniyor";
    case "awaiting_admin":
      return "Onay bekleniyor";
    case "paid":
      return "Ödendi";
    case "underpaid":
      return "Eksik tutar";
    case "expired":
      return "Süre doldu";
    case "rejected":
      return "Reddedildi";
  }
}

export function displayUrl(listing: Listing) {
  if (listing.url) return listing.url.replace(/^https?:\/\//, "");
  return listing.title;
}

export function typeLabel(type: Listing["type"]) {
  return type === "domain" ? "DOMAIN" : "SİTE";
}
