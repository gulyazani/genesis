import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/telegram-auth";
import { ensureWatcher } from "@/lib/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  ensureWatcher();
  const session = resolveSession(req);
  return NextResponse.json(session);
}
