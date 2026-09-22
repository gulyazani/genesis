import { randomBytes } from "node:crypto";
import { bustCatalogCaches } from "@/lib/catalog-cache";
import { getServerConfig } from "@/lib/config";
import { gteUsdt, subUsdt } from "@/lib/money";
import { mutateStore, readListings, readOrders } from "@/lib/store";
import { creditUser, ensureUserRecord } from "@/lib/users";
import type { Listing, Order, OrderStatus } from "@/lib/types";
import { deliverAfterPurchase } from "@/lib/delivery";
import {
  notifyExpired,
  notifyTopupCreated,
  notifyTopupExpired,
  notifyTopupPaid,
} from "@/lib/notify";

export function newOrderId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `ord_${stamp}_${randomBytes(3).toString("hex")}`;
}

export function isTopup(order: Order) {
  return order.kind === "topup";
}

export async function getListing(id: string) {
  const listings = await readListings();
  return listings.find((item) => item.id === id) ?? null;
}

function withLiveWallet(order: Order): Order {
  return { ...order, walletAddress: getServerConfig().wallet, kind: order.kind ?? "listing" };
}

export async function getOrder(id: string) {
  const orders = await readOrders();
  const order = orders.find((item) => item.id === id);
  return order ? withLiveWallet(order) : null;
}

export async function listOrdersForUser(telegramUserId: string) {
  const orders = await readOrders();
  return orders
    .filter((item) => item.telegramUserId === telegramUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(withLiveWallet);
}

export async function purchaseFromBalance(input: {
  listingId: string;
  telegramUserId: string;
  telegramName?: string;
}) {
  const cfg = getServerConfig();
  const created = await mutateStore<
    | { order: Order; listing: Listing; balanceUsdt: number }
    | { error: string; needTopup?: boolean; shortfall?: number; balanceUsdt?: number }
  >(({ listings, orders, users }) => {
    const listing = listings.find((item) => item.id === input.listingId);
    if (!listing) return { error: "İlan bulunamadı." };
    if (listing.status === "sold") return { error: "Bu ilan satıldı." };
    if (listing.status === "reserved") {
      return { error: "Bu ilan için ödeme bekleniyor." };
    }
    const user = ensureUserRecord(users, input.telegramUserId);
    if (!gteUsdt(user.balanceUsdt, listing.price)) {
      return {
        error: "Yetersiz bakiye. Önce Bakiye Yükle.",
        needTopup: true,
        shortfall: subUsdt(listing.price, user.balanceUsdt),
        balanceUsdt: user.balanceUsdt,
      };
    }
    user.balanceUsdt = subUsdt(user.balanceUsdt, listing.price);
    user.updatedAt = new Date().toISOString();
    const now = new Date();
    const order: Order = {
      id: newOrderId(),
      kind: "listing",
      listingId: listing.id,
      telegramUserId: String(input.telegramUserId),
      telegramName: input.telegramName,
      amount: listing.price,
      asset: cfg.asset,
      network: cfg.network,
      walletAddress: "",
      status: "paid",
      note: "bakiyeden",
      receivedAmount: listing.price,
      createdAt: now.toISOString(),
      expiresAt: now.toISOString(),
    };
    listing.status = "sold";
    orders.push(order);
    return { order, listing: { ...listing }, balanceUsdt: user.balanceUsdt };
  });
  if ("error" in created) return created;
  bustCatalogCaches(created.listing.id);
  void deliverAfterPurchase(created.order, created.listing).then((result) => {
    if (result.auto) return markDelivered(created.order.id);
  });
  return created;
}

export async function createTopup(input: {
  amount: number;
  telegramUserId: string;
  telegramName?: string;
  txHashHint?: string;
}) {
  const cfg = getServerConfig();
  if (!Number.isFinite(input.amount) || input.amount < 1) {
    return { error: "En az 1 USDT yükle." };
  }
  if (input.amount > 50_000) {
    return { error: "Tek seferde en fazla 50.000 USDT." };
  }
  const created = await mutateStore<{ order: Order } | { error: string }>(
    ({ orders }) => {
      const now = new Date();
      const expires = new Date(now.getTime() + cfg.watchWindowMin * 60 * 1000);
      const hint = input.txHashHint?.trim().toLowerCase();
      const order: Order = {
        id: newOrderId(),
        kind: "topup",
        listingId: "",
        telegramUserId: String(input.telegramUserId),
        telegramName: input.telegramName,
        amount: input.amount,
        asset: cfg.asset,
        network: cfg.network,
        walletAddress: "",
        txHashHint: hint || undefined,
        status: "pending",
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
      };
      orders.push(order);
      return { order };
    },
  );
  if ("error" in created) return created;
  const order = withLiveWallet(created.order);
  void notifyTopupCreated(order);
  return { order };
}

export async function setOrderHint(orderId: string, telegramUserId: string, hint: string) {
  return mutateStore<{ order: Order } | { error: string }>(({ orders }) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return { error: "Sipariş bulunamadı." };
    if (order.telegramUserId !== telegramUserId) {
      return { error: "Bu sipariş sana ait değil." };
    }
    if (
      order.status !== "pending" &&
      order.status !== "underpaid" &&
      order.status !== "awaiting_admin"
    ) {
      return { error: "Bu siparişe TX hash eklenemez." };
    }
    order.txHashHint = hint.trim().toLowerCase() || undefined;
    return { order: { ...order } };
  });
}

export async function markOrder(
  orderId: string,
  status: Extract<OrderStatus, "paid" | "expired">,
  extra?: { matchedTxId?: string; note?: string },
) {
  const result = await mutateStore<
    { order: Order; listing: Listing | null; unchanged?: boolean } | { error: string }
  >(({ listings, orders, users }) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return { error: "Sipariş bulunamadı." };
    if (order.status === status) {
      return {
        order: { ...order },
        listing: listings.find((l) => l.id === order.listingId) ?? null,
        unchanged: true,
      };
    }
    const listing = listings.find((item) => item.id === order.listingId) ?? null;
    if (status === "paid") {
      if (extra?.matchedTxId) {
        const used = orders.some(
          (item) => item.matchedTxId === extra.matchedTxId && item.id !== order.id,
        );
        if (used) return { error: "Bu TX başka siparişe bağlı." };
        order.matchedTxId = extra.matchedTxId;
      }
      order.status = "paid";
      order.receivedAmount = order.amount;
      if (extra?.note) order.note = extra.note;
      if (isTopup(order)) {
        creditUser(users, order.telegramUserId, order.amount);
        if (!order.note) order.note = "bakiye onayı";
      } else if (listing && listing.status !== "sold") {
        listing.status = "sold";
      }
    } else {
      order.status = "expired";
      if (extra?.note) order.note = extra.note;
      if (listing && listing.status === "reserved") listing.status = "available";
    }
    return { order: { ...order }, listing: listing ? { ...listing } : null };
  });
  if ("error" in result) return result;
  if (!result.unchanged) {
    if (status === "paid" && result.listing) {
      bustCatalogCaches(result.listing.id);
    }
    if (status === "paid") {
      if (isTopup(result.order)) void notifyTopupPaid(result.order);
      else if (result.listing) {
        void deliverAfterPurchase(result.order, result.listing, "paid").then(
          (item) => {
            if (item.auto) return markDelivered(result.order.id);
          },
        );
      }
    }
    if (status === "expired") {
      if (isTopup(result.order)) void notifyTopupExpired(result.order);
      else if (result.listing) void notifyExpired(result.order, result.listing);
    }
  }
  return result;
}

export async function expireOverdueOrders(now = Date.now()) {
  const expired: { order: Order; listing: Listing | null }[] = [];
  await mutateStore(({ listings, orders }) => {
    for (const order of orders) {
      if (order.status !== "pending" && order.status !== "underpaid") continue;
      if (new Date(order.expiresAt).getTime() > now) continue;
      order.status = "expired";
      const listing = listings.find((item) => item.id === order.listingId) ?? null;
      if (listing && listing.status === "reserved") listing.status = "available";
      expired.push({
        order: { ...order },
        listing: listing ? { ...listing } : null,
      });
    }
  });
  for (const item of expired) {
    if (isTopup(item.order)) void notifyTopupExpired(item.order);
    else if (item.listing) void notifyExpired(item.order, item.listing);
  }
  return expired;
}

export async function markDelivered(orderId: string) {
  return mutateStore<{ order: Order } | { error: string }>(({ orders }) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return { error: "Sipariş bulunamadı." };
    if (order.kind === "topup") {
      return { error: "Bakiye yüklemesine teslimat yazılmaz." };
    }
    if (order.status !== "paid") {
      return { error: "Önce satışın paid olması gerekir." };
    }
    order.deliveredAt = new Date().toISOString();
    return { order: { ...order } };
  });
}
