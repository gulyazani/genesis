import { getServerConfig } from "@/lib/config";
import { DEMO_USER } from "@/lib/telegram-auth";
import type { Listing, Order } from "@/lib/types";
import { formatUsdt } from "@/lib/format";

function skipNotify(telegramUserId: string) {
  return String(telegramUserId) === String(DEMO_USER.id);
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
) {
  if (!chatId || skipNotify(String(chatId))) return;
  const { getBot } = await import("@/lib/bot");
  const bot = getBot();
  if (!bot) return;
  try {
    await bot.api.sendMessage(chatId, text, { parse_mode: "HTML" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("telegram notify failed", { chatId: String(chatId), message });
  }
}

export async function notifyAdmin(text: string) {
  const adminId = getServerConfig().adminId;
  if (!adminId) return;
  await sendTelegramMessage(adminId, text);
}

export function pendingBuyerText(order: Order, listing: Listing) {
  const cfg = getServerConfig();
  return [
    `<b>Sipariş alındı</b> — ${listing.title}`,
    `${formatUsdt(order.amount)} · ${order.network} ${order.asset}`,
    cfg.wallet
      ? `Cüzdan: <code>${cfg.wallet}</code>`
      : "Cüzdan adresi henüz ayarlı değil.",
    `Pencere: ${cfg.watchWindowMin} dakika. Yanlış ağ veya token otomatik eşleşmez.`,
    `Sipariş: <code>${order.id}</code>`,
  ].join("\n");
}

export function pendingAdminText(order: Order, listing: Listing) {
  return [
    `<b>Bekleyen sipariş</b>`,
    `${listing.title} · ${formatUsdt(order.amount)}`,
    `Alıcı: <code>${order.telegramUserId}</code> ${order.telegramName ?? ""}`,
    `Sipariş: <code>${order.id}</code>`,
    `Pencere bitiş: ${order.expiresAt}`,
  ].join("\n");
}

export function paidBuyerText(order: Order, listing: Listing) {
  return [
    `<b>Ödeme görüldü</b> — ${listing.title}`,
    `${formatUsdt(order.amount)} ${order.asset} alındı.`,
    order.matchedTxId ? `TX: <code>${order.matchedTxId}</code>` : "",
    "Nizam giriş bilgilerini bu sohbetten /teslim ile yollayacak.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function paidAdminText(order: Order, listing: Listing) {
  return [
    `<b>Ödeme eşleşti</b>`,
    `${listing.title} · ${formatUsdt(order.amount)}`,
    `Alıcı: <code>${order.telegramUserId}</code>`,
    order.matchedTxId ? `TX: <code>${order.matchedTxId}</code>` : "",
    `Giriş bilgisi için: /teslim ${order.id} kullanıcı şifre...`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function expiredBuyerText(order: Order, listing: Listing) {
  return [
    `<b>Süre doldu</b> — ${listing.title}`,
    "İzleme penceresi kapandı. İlan yeniden satılık. Geç TX otomatik eşleşmez; Nizam'a yaz.",
    `Sipariş: <code>${order.id}</code>`,
  ].join("\n");
}

export function expiredAdminText(order: Order, listing: Listing) {
  return [
    `<b>Sipariş süresi doldu</b>`,
    `${listing.title} · ${formatUsdt(order.amount)}`,
    `Alıcı: <code>${order.telegramUserId}</code>`,
    `Sipariş: <code>${order.id}</code>`,
    "İlan tekrar available. Geç TX için acil yedek: /paid",
  ].join("\n");
}

export function underpaidBuyerText(order: Order, listing: Listing) {
  const remaining = Math.max(0, order.amount - (order.receivedAmount ?? 0));
  return [
    `<b>Eksik tutar</b> — ${listing.title}`,
    `Gelen: ${formatUsdt(order.receivedAmount ?? 0)} / beklenen ${formatUsdt(order.amount)}.`,
    `Kalan: ${formatUsdt(remaining)}. Otomatik onay yok.`,
    `Sipariş: <code>${order.id}</code>`,
  ].join("\n");
}

export function underpaidAdminText(order: Order, listing: Listing) {
  return [
    `<b>Eksik ödeme</b>`,
    `${listing.title} · beklenen ${formatUsdt(order.amount)}, gelen ${formatUsdt(order.receivedAmount ?? 0)}`,
    `Alıcı: <code>${order.telegramUserId}</code>`,
    order.matchedTxId ? `TX: <code>${order.matchedTxId}</code>` : "",
    "paid olmadı. Elle /paid yalnızca acil yedek.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function wrongAssetText(asset: string, txId: string) {
  return [
    `<b>Yanlış token / ağ</b>`,
    `Gelen: ${asset}. Beklenen: USDT TRC-20.`,
    txId ? `TX: <code>${txId}</code>` : "",
    "Sipariş paid olmadı. Alıcı doğru token ile tekrar göndermeli.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function lateTxAdminText(txId: string, amount: number) {
  return [
    `<b>Geç TX</b> — pencere dışında geldi, otomatik eşleşme yok.`,
    `${formatUsdt(amount)} · TX: <code>${txId}</code>`,
    "Acil yedek: /paid &lt;sipariş-id&gt;",
  ].join("\n");
}

export async function notifyOrderCreated(order: Order, listing: Listing) {
  await sendTelegramMessage(order.telegramUserId, pendingBuyerText(order, listing));
  await notifyAdmin(pendingAdminText(order, listing));
}

export async function notifyPaid(order: Order, listing: Listing) {
  await sendTelegramMessage(order.telegramUserId, paidBuyerText(order, listing));
  await notifyAdmin(paidAdminText(order, listing));
}

export async function notifyExpired(order: Order, listing: Listing) {
  await sendTelegramMessage(order.telegramUserId, expiredBuyerText(order, listing));
  await notifyAdmin(expiredAdminText(order, listing));
}

export async function notifyUnderpaid(order: Order, listing: Listing) {
  await sendTelegramMessage(
    order.telegramUserId,
    underpaidBuyerText(order, listing),
  );
  await notifyAdmin(underpaidAdminText(order, listing));
}

export async function notifyPurchase(order: Order, listing: Listing) {
  await sendTelegramMessage(
    order.telegramUserId,
    [
      `<b>Satın alındı</b> — ${listing.title}`,
      `${formatUsdt(order.amount)} bakiyeden düşüldü.`,
      "İlan stoktan düştü — Satışa hazır listede durmaz.",
      "Nizam site / domain giriş bilgilerini bu sohbetten iletecek.",
    ].join("\n"),
  );
  await notifyAdmin(
    [
      `<b>Bakiyeden satış</b>`,
      `${listing.title} · ${formatUsdt(order.amount)}`,
      `Alıcı: <code>${order.telegramUserId}</code>`,
      `Sipariş: <code>${order.id}</code>`,
      "İlan stoktan düştü (sold).",
      `Giriş bilgisi için: /teslim ${order.id} kullanıcı şifre...`,
    ].join("\n"),
  );
}

export async function notifyTopupCreated(order: Order) {
  const cfg = getServerConfig();
  await sendTelegramMessage(
    order.telegramUserId,
    [
      `<b>Bakiye yükleme</b>`,
      `${formatUsdt(order.amount)} · ${order.network} ${order.asset}`,
      cfg.wallet ? `Cüzdan: <code>${cfg.wallet}</code>` : "Cüzdan henüz ayarlı değil.",
      `Pencere: ${cfg.watchWindowMin} dk. TX görünce Nizam bakiyeyi onaylar.`,
      `Sipariş: <code>${order.id}</code>`,
    ].join("\n"),
  );
  await notifyAdmin(
    [
      `<b>Bekleyen bakiye yükleme</b>`,
      `${formatUsdt(order.amount)}`,
      `Alıcı: <code>${order.telegramUserId}</code> ${order.telegramName ?? ""}`,
      `Sipariş: <code>${order.id}</code>`,
    ].join("\n"),
  );
}

export async function notifyTopupAwaitingAdmin(order: Order) {
  await sendTelegramMessage(
    order.telegramUserId,
    [
      `<b>Transfer görüldü</b>`,
      `${formatUsdt(order.amount)} — Nizam onaylayınca bakiyen işlenir.`,
      `Sipariş: <code>${order.id}</code>`,
    ].join("\n"),
  );
  await notifyAdmin(
    [
      `<b>Bakiye onayı</b>`,
      `${formatUsdt(order.amount)} TX görüldü. Bakiye henüz yazılmadı.`,
      `Alıcı: <code>${order.telegramUserId}</code>`,
      order.matchedTxId ? `TX: <code>${order.matchedTxId}</code>` : "",
      `Onayla: /paid ${order.id}`,
      `Reddet: /expire ${order.id}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export async function notifyTopupPaid(order: Order) {
  await sendTelegramMessage(
    order.telegramUserId,
    [
      `<b>Bakiye yüklendi</b>`,
      `${formatUsdt(order.amount)} hesabına işlendi. Katalogdan satın alabilirsin.`,
      order.matchedTxId ? `TX: <code>${order.matchedTxId}</code>` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  await notifyAdmin(
    [
      `<b>Bakiye yüklendi</b>`,
      `${formatUsdt(order.amount)}`,
      `Alıcı: <code>${order.telegramUserId}</code>`,
      order.matchedTxId ? `TX: <code>${order.matchedTxId}</code>` : "",
      `Sipariş: <code>${order.id}</code>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export async function notifyDelivery(
  order: Order,
  listingTitle: string | undefined,
  body: string,
) {
  const safe = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  await sendTelegramMessage(
    order.telegramUserId,
    [
      `<b>Teslimat — giriş bilgileri</b>`,
      listingTitle ? listingTitle : "",
      `Sipariş: <code>${order.id}</code>`,
      "",
      `<pre>${safe}</pre>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export async function notifyTopupExpired(order: Order) {
  await sendTelegramMessage(
    order.telegramUserId,
    [
      `<b>Yükleme süresi doldu</b>`,
      `${formatUsdt(order.amount)} eşleşmedi. Yeni Bakiye Yükle açabilirsin.`,
      `Sipariş: <code>${order.id}</code>`,
    ].join("\n"),
  );
  await notifyAdmin(
    [
      `<b>Bakiye yükleme süresi doldu</b>`,
      `${formatUsdt(order.amount)} · alıcı <code>${order.telegramUserId}</code>`,
      `Sipariş: <code>${order.id}</code>`,
    ].join("\n"),
  );
}
