import { notifyAdmin, notifyDelivery, notifyPaid, notifyPurchase } from "@/lib/notify";
import { readCredentials } from "@/lib/store";
import { formatUsdt } from "@/lib/format";
import type { Listing, ListingDelivery, Order } from "@/lib/types";

export function formatDeliveryMessage(listing: Listing, creds: ListingDelivery) {
  if (creds.method === "link") {
    return [
      `Teslimat linki — ${listing.title}`,
      creds.url || listing.url || "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  const kind = creds.method === "cpanel" ? "cPanel girişi" : "WordPress girişi";
  return [
    `${kind} — ${listing.title}`,
    creds.url ? `Adres: ${creds.url}` : listing.url ? `Adres: ${listing.url}` : "",
    creds.username ? `Kullanıcı: ${creds.username}` : "",
    creds.password ? `Şifre: ${creds.password}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function deliverAfterPurchase(
  order: Order,
  listing: Listing,
  fallback: "purchase" | "paid" = "purchase",
) {
  const all = await readCredentials();
  const creds = all[listing.id];
  if (!creds) {
    if (fallback === "paid") await notifyPaid(order, listing);
    else await notifyPurchase(order, listing);
    return { auto: false };
  }
  const body = formatDeliveryMessage(listing, creds);
  await notifyDelivery(order, listing.title, body);
  await notifyAdmin(
    [
      `<b>Otomatik teslimat</b>`,
      `${listing.title} · ${formatUsdt(order.amount)}`,
      `Alıcı: <code>${order.telegramUserId}</code>`,
      `Sipariş: <code>${order.id}</code>`,
      creds.method === "link" ? "Yöntem: link" : `Yöntem: ${creds.method}`,
    ].join("\n"),
  );
  return { auto: true };
}
