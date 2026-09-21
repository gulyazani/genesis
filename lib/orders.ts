import { randomBytes } from "node:crypto";
import { getServerConfig } from "@/lib/config";
import { mutateStore, readListings, readOrders } from "@/lib/store";
import type { Listing, Order, OrderStatus } from "@/lib/types";
import {
  notifyExpired,
  notifyOrderCreated,
  notifyPaid,
} from "@/lib/notify";

export function newOrderId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `ord_${stamp}_${randomBytes(3).toString("hex")}`;
}

export async function getListing(id: string) {
  const listings = await readListings();
  return listings.find((item) => item.id === id) ?? null;
}

export async function getOrder(id: string) {
  const orders = await readOrders();
  return orders.find((item) => item.id === id) ?? null;
}

export async function listOrdersForUser(telegramUserId: string) {
  const orders = await readOrders();
  return orders
    .filter((item) => item.telegramUserId === telegramUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createOrder(input: {
  listingId: string;
  telegramUserId: string;
  telegramName?: string;
  txHashHint?: string;
}) {
  const cfg = getServerConfig();
  const created = await mutateStore<{ order: Order; listing: Listing } | { error: string }>(
    ({ listings, orders }) => {
      const listing = listings.find((item) => item.id === input.listingId);
      if (!listing) return { error: "İlan bulunamadı." };
      if (listing.status === "sold") {
        return { error: "Bu ilan satıldı." };
      }
      if (listing.status === "reserved") {
        return { error: "Bu ilan için ödeme bekleniyor." };
      }
      const now = new Date();
      const expires = new Date(
        now.getTime() + cfg.watchWindowMin * 60 * 1000,
      );
      const hint = input.txHashHint?.trim().toLowerCase();
      const order: Order = {
        id: newOrderId(),
        listingId: listing.id,
        telegramUserId: String(input.telegramUserId),
        telegramName: input.telegramName,
        amount: listing.price,
        asset: cfg.asset,
        network: cfg.network,
        walletAddress: cfg.wallet,
        txHashHint: hint || undefined,
        status: "pending",
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
      };
      listing.status = "reserved";
      orders.push(order);
      return { order, listing: { ...listing } };
    },
  );
  if ("error" in created) return created;
  void notifyOrderCreated(created.order, created.listing);
  return created;
}

export async function setOrderHint(orderId: string, telegramUserId: string, hint: string) {
  return mutateStore<{ order: Order } | { error: string }>(({ orders }) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return { error: "Sipariş bulunamadı." };
    if (order.telegramUserId !== telegramUserId) {
      return { error: "Bu sipariş sana ait değil." };
    }
    if (order.status !== "pending" && order.status !== "underpaid") {
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
  >(({ listings, orders }) => {
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
      if (listing) listing.status = "sold";
    } else {
      order.status = "expired";
      if (extra?.note) order.note = extra.note;
      if (listing && listing.status === "reserved") listing.status = "available";
    }
    return { order: { ...order }, listing: listing ? { ...listing } : null };
  });
  if ("error" in result) return result;
  if (result.listing && !result.unchanged) {
    if (status === "paid") void notifyPaid(result.order, result.listing);
    if (status === "expired") void notifyExpired(result.order, result.listing);
  }
  return result;
}

export async function expireOverdueOrders(now = Date.now()) {
  const expired: { order: Order; listing: Listing }[] = [];
  await mutateStore(({ listings, orders }) => {
    for (const order of orders) {
      if (order.status !== "pending" && order.status !== "underpaid") continue;
      if (new Date(order.expiresAt).getTime() > now) continue;
      order.status = "expired";
      const listing = listings.find((item) => item.id === order.listingId);
      if (listing && listing.status === "reserved") listing.status = "available";
      if (listing) expired.push({ order: { ...order }, listing: { ...listing } });
    }
  });
  for (const item of expired) {
    void notifyExpired(item.order, item.listing);
  }
  return expired;
}
