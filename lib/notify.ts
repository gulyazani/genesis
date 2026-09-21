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
    "Nizam teslimatı bu sohbetten yazacak.",
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
    "Teslimatı (auth-code / zip) alıcıya yaz.",
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
