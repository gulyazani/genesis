import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminPasswordSet,
  makeAdminCookie,
  verifyAdminLogin,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!adminPasswordSet()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD .env içinde yok." },
      { status: 503 },
    );
  }
  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (!verifyAdminLogin(body.username ?? "", body.password ?? "")) {
    return NextResponse.json({ error: "Kullanıcı veya şifre yanlış." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeAdminCookie(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
