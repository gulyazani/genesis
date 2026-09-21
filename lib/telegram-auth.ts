import { createHmac, timingSafeEqual } from "node:crypto";
import { getPublicConfig, getServerConfig } from "@/lib/config";
import type { Session, SessionMode, TelegramUser } from "@/lib/types";

export const DEMO_USER: TelegramUser = {
  id: 100000001,
  first_name: "Demo",
  username: "sellshell_demo",
};

export function verifyInitData(
  initData: string,
  botToken: string,
): TelegramUser | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");
  try {
    if (
      computed.length !== hash.length ||
      !timingSafeEqual(Buffer.from(computed), Buffer.from(hash))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  const authDate = Number(params.get("auth_date") ?? 0);
  if (authDate && Date.now() / 1000 - authDate > 86_400) {
    return null;
  }
  const rawUser = params.get("user");
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser) as TelegramUser;
  } catch {
    return null;
  }
}

export function readInitData(req: Request) {
  const header = req.headers.get("x-telegram-init-data") ?? "";
  if (header) return header;
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("tma ")) return auth.slice(4);
  return "";
}

export function resolveSession(req: Request): Session {
  const cfg = getServerConfig();
  const initData = readInitData(req);
  if (initData && cfg.botToken) {
    const user = verifyInitData(initData, cfg.botToken);
    if (user) {
      return { user, mode: "telegram", config: getPublicConfig() };
    }
  }
  if (cfg.devBypass) {
    return { user: DEMO_USER, mode: "demo", config: getPublicConfig() };
  }
  return { user: DEMO_USER, mode: "blocked", config: getPublicConfig() };
}

export function requireBuyer(req: Request) {
  const session = resolveSession(req);
  if (session.mode === "blocked") {
    return {
      session,
      error: "Bu uygulamayı Telegram bot üzerinden açın.",
    } as const;
  }
  return { session, error: null } as const;
}

export function sessionModeLabel(mode: SessionMode) {
  if (mode === "telegram") return "telegram";
  if (mode === "demo") return "demo";
  return "blocked";
}
