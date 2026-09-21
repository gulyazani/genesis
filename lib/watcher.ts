import { getServerConfig, USDT_TRC20_CONTRACT } from "@/lib/config";
import { expireOverdueOrders } from "@/lib/orders";
import {
  lateTxAdminText,
  notifyAdmin,
  notifyPaid,
  notifyTopupPaid,
  notifyUnderpaid,
  sendTelegramMessage,
  wrongAssetText,
} from "@/lib/notify";
import { isTopup } from "@/lib/orders";
import { mutateStore } from "@/lib/store";
import { creditUser } from "@/lib/users";
import type { IncomingTx, Listing, Order } from "@/lib/types";

const mockPool: IncomingTx[] = [];
const seenTx = new Set<string>();
let started = false;
let lastErrorAt = 0;

export function injectMockTx(partial: {
  amount: number;
  txHash?: string;
  to?: string;
  asset?: string;
  network?: string;
  timestamp?: number;
}) {
  const cfg = getServerConfig();
  const tx: IncomingTx = {
    id: (partial.txHash || `mock_${Date.now()}_${Math.random().toString(16).slice(2)}`)
      .toLowerCase(),
    to: partial.to || cfg.wallet || "TNOTCONFIGURED",
    amount: partial.amount,
    asset: (partial.asset || cfg.asset).toUpperCase(),
    network: partial.network || cfg.network,
    timestamp: partial.timestamp ?? Date.now(),
  };
  mockPool.push(tx);
  return tx;
}

export function startWatcher() {
  if (started) return;
  started = true;
  const interval = getServerConfig().watcherIntervalMs;
  void tickWatcher();
  setInterval(() => {
    void tickWatcher();
  }, interval);
  console.info("sellshell watcher started", {
    mock: getServerConfig().watcherMock,
    intervalMs: interval,
  });
}

export function ensureWatcher() {
  startWatcher();
}

export async function tickWatcher() {
  ensureWatcher();
  await expireOverdueOrders();
  const cfg = getServerConfig();
  try {
    const txs = cfg.watcherMock ? [...mockPool] : await fetchTrongridIncoming();
    for (const tx of txs) {
      await applyIncomingTx(tx);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("watcher tick failed", message);
    const now = Date.now();
    if (now - lastErrorAt > 10 * 60 * 1000) {
      lastErrorAt = now;
      void notifyAdmin(
        "<b>İzleme düştü</b>\nWatcher bir tur hata aldı. Siparişler pending kaldı. Local'de WATCHER_MOCK=1 ile devam edebilirsin.",
      );
    }
  }
}

async function fetchTrongridIncoming(): Promise<IncomingTx[]> {
  const cfg = getServerConfig();
  if (!cfg.wallet) return [];
  const url = new URL(
    `https://api.trongrid.io/v1/accounts/${cfg.wallet}/transactions/trc20`,
  );
  url.searchParams.set("only_to", "true");
  url.searchParams.set("limit", "50");
  url.searchParams.set("contract_address", USDT_TRC20_CONTRACT);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cfg.trongridKey) headers["TRON-PRO-API-KEY"] = cfg.trongridKey;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`trongrid ${res.status}`);
  }
  const body = (await res.json()) as {
    data?: Array<{
      transaction_id: string;
      value: string;
      to: string;
      block_timestamp: number;
      token_info?: { symbol?: string; decimals?: number; address?: string };
    }>;
  };
  return (body.data ?? []).map((row) => {
    const decimals = row.token_info?.decimals ?? 6;
    const raw = Number(row.value);
    return {
      id: row.transaction_id.toLowerCase(),
      to: row.to,
      amount: raw / 10 ** decimals,
      asset: (row.token_info?.symbol ?? "USDT").toUpperCase(),
      network: "TRC-20",
      timestamp: row.block_timestamp,
    } satisfies IncomingTx;
  });
}

export async function applyIncomingTx(tx: IncomingTx) {
  if (seenTx.has(tx.id)) return { outcome: "seen" as const };
  const cfg = getServerConfig();
  if (tx.network && tx.network !== cfg.network) {
    return { outcome: "skip_network" as const };
  }
  if (cfg.wallet && tx.to && tx.to !== cfg.wallet && tx.to !== "TNOTCONFIGURED") {
    return { outcome: "skip_to" as const };
  }

  if (tx.asset !== cfg.asset) {
    seenTx.add(tx.id);
    const hintMatch = await findHintOrder(tx.id);
    void notifyAdmin(wrongAssetText(tx.asset, tx.id));
    if (hintMatch) {
      void sendTelegramMessage(hintMatch.telegramUserId, wrongAssetText(tx.asset, tx.id));
    }
    return { outcome: "wrong_asset" as const };
  }

  const result = await mutateStore<{
    outcome: "paid" | "underpaid" | "late" | "unmatched" | "seen";
    order?: Order;
    listing?: Listing;
    collision?: boolean;
  }>(({ listings, orders, users }) => {
    if (orders.some((item) => item.matchedTxId === tx.id)) {
      seenTx.add(tx.id);
      return { outcome: "seen" };
    }

    const pending = orders.filter(
      (item) => item.status === "pending" || item.status === "underpaid",
    );
    const hinted = pending.filter((item) => item.txHashHint && item.txHashHint === tx.id);
    const pool = hinted.length ? hinted : pending.filter((item) => !item.txHashHint);
    const inWindow = pool.filter((item) => {
      const created = new Date(item.createdAt).getTime();
      const expires = new Date(item.expiresAt).getTime();
      return tx.timestamp >= created && tx.timestamp <= expires;
    });
    const late = pool.filter((item) => tx.timestamp > new Date(item.expiresAt).getTime());

    const exact = inWindow
      .filter((item) => almostEqual(item.amount, tx.amount))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    if (exact.length > 0) {
      const order = exact[0];
      const collision = exact.length > 1;
      order.status = "paid";
      order.matchedTxId = tx.id;
      order.receivedAmount = tx.amount;
      if (collision) {
        order.note = "Aynı tutarda birden fazla bekleyen vardı; en eskiye bağlandı.";
      }
      if (isTopup(order)) {
        creditUser(users, order.telegramUserId, order.amount);
      } else {
        const listing = listings.find((item) => item.id === order.listingId);
        if (listing) listing.status = "sold";
      }
      const listing = listings.find((item) => item.id === order.listingId);
      seenTx.add(tx.id);
      return {
        outcome: "paid",
        order: { ...order },
        listing: listing ? { ...listing } : undefined,
        collision,
      };
    }

    const short = inWindow
      .filter((item) => tx.amount < item.amount)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (short.length === 1 || hinted.length === 1) {
      const order = short[0] ?? hinted[0];
      if (order) {
        order.status = "underpaid";
        order.matchedTxId = tx.id;
        order.receivedAmount = tx.amount;
        const listing = listings.find((item) => item.id === order.listingId);
        seenTx.add(tx.id);
        return {
          outcome: "underpaid",
          order: { ...order },
          listing: listing ? { ...listing } : undefined,
        };
      }
    }

    if (late.length && !inWindow.length) {
      seenTx.add(tx.id);
      return { outcome: "late" };
    }

    return { outcome: "unmatched" };
  });

  if (result.outcome === "paid" && result.order) {
    if (isTopup(result.order)) void notifyTopupPaid(result.order);
    else if (result.listing) void notifyPaid(result.order, result.listing);
    if (result.collision) {
      void notifyAdmin(
        `<b>Aynı tutarda birden fazla bekleyen</b>\n${tx.amount} USDT TX <code>${tx.id}</code> en eski siparişe bağlandı: <code>${result.order.id}</code>`,
      );
    }
  }
  if (result.outcome === "underpaid" && result.order) {
    if (result.listing) void notifyUnderpaid(result.order, result.listing);
    else {
      void sendTelegramMessage(
        result.order.telegramUserId,
        [
          `<b>Eksik tutar</b> — bakiye yükleme`,
          `Gelen: ${result.order.receivedAmount ?? 0} / beklenen ${result.order.amount} USDT.`,
          "Otomatik yükleme yok. Kalanı gönder veya yeni yükleme aç.",
        ].join("\n"),
      );
      void notifyAdmin(
        `<b>Eksik bakiye yükleme</b>\nbeklenen ${result.order.amount}, gelen ${result.order.receivedAmount ?? 0}\nAlıcı: <code>${result.order.telegramUserId}</code>`,
      );
    }
  }
  if (result.outcome === "late") {
    void notifyAdmin(lateTxAdminText(tx.id, tx.amount));
  }
  return result;
}

async function findHintOrder(txId: string) {
  const { readOrders } = await import("@/lib/store");
  const orders = await readOrders();
  return (
    orders.find(
      (item) =>
        item.txHashHint === txId &&
        (item.status === "pending" || item.status === "underpaid"),
    ) ?? null
  );
}

function almostEqual(a: number, b: number) {
  return Math.round(a * 1e6) === Math.round(b * 1e6);
}
