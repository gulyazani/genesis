import path from "node:path";
import type { PublicConfig } from "@/lib/types";

export const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

function normalizeMiniAppUrl(raw: string) {
  return raw.trim().replace(/\/+$/, "");
}

export function getServerConfig() {
  const miniAppUrl = normalizeMiniAppUrl(
    process.env.MINI_APP_URL ?? "http://127.0.0.1:43127",
  );
  return {
    botToken: process.env.BOT_TOKEN ?? "",
    adminId: process.env.TELEGRAM_ADMIN_ID ?? "",
    miniAppUrl,
    webhookUrl: `${miniAppUrl}/api/telegram/webhook`,
    wallet: (process.env.CRYPTO_WALLET_ADDRESS ?? "").trim(),
    asset: process.env.CRYPTO_ASSET ?? "USDT",
    network: process.env.CRYPTO_NETWORK ?? "TRC-20",
    watchWindowMin: Number(process.env.CRYPTO_WATCH_WINDOW_MIN ?? 120),
    trongridKey: process.env.TRONGRID_API_KEY ?? "",
    watcherMock: process.env.WATCHER_MOCK !== "0",
    watcherIntervalMs: Number(process.env.WATCHER_INTERVAL_MS ?? 20_000),
    devBypass: process.env.DEV_BYPASS_TELEGRAM !== "0",
    dataDir: process.env.DATA_DIR || path.join(process.cwd(), "data"),
  };
}

export function getPublicConfig(): PublicConfig {
  const s = getServerConfig();
  return {
    wallet: s.wallet,
    walletConfigured: Boolean(s.wallet),
    asset: s.asset,
    network: s.network,
    watchWindowMin: s.watchWindowMin,
    watcherMock: s.watcherMock,
    devBypass: s.devBypass,
  };
}

export function isAdmin(telegramUserId: string | number) {
  const admin = getServerConfig().adminId;
  if (!admin) return false;
  return String(telegramUserId) === String(admin);
}
