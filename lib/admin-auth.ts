import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getServerConfig } from "@/lib/config";

export const ADMIN_COOKIE = "ss_admin";
const DAY = 60 * 60 * 24;

function secret() {
  const { adminPassword, botToken } = getServerConfig();
  return `${adminPassword}|${botToken || "dev"}`;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function adminPasswordSet() {
  return Boolean(getServerConfig().adminPassword);
}

export function verifyAdminLogin(username: string, password: string) {
  const { adminUser, adminPassword } = getServerConfig();
  if (!adminPassword) return false;
  return safeEqual(username.trim(), adminUser) && safeEqual(password, adminPassword);
}

export function makeAdminCookie() {
  const exp = Date.now() + 7 * DAY * 1000;
  const payload = `ok.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function cookieIsValid(raw: string | undefined) {
  if (!raw || !adminPasswordSet()) return false;
  const cut = raw.lastIndexOf(".");
  if (cut < 0) return false;
  const payload = raw.slice(0, cut);
  const mac = raw.slice(cut + 1);
  if (!safeEqual(sign(payload), mac)) return false;
  const exp = Number(payload.split(".")[1]);
  return Number.isFinite(exp) && exp > Date.now();
}

export async function isAdminSession() {
  const jar = await cookies();
  return cookieIsValid(jar.get(ADMIN_COOKIE)?.value);
}
