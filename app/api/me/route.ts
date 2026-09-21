import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/telegram-auth";
import { getOrCreateUser } from "@/lib/users";
import { ensureWatcher } from "@/lib/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  ensureWatcher();
  const session = resolveSession(req);
  const user = await getOrCreateUser(String(session.user.id));
  return NextResponse.json({ ...session, balanceUsdt: user.balanceUsdt });
}
