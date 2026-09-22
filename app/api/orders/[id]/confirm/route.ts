import { NextResponse } from "next/server";
import { getServerConfig, isAdmin } from "@/lib/config";
import { markOrder } from "@/lib/orders";
import { requireBuyer } from "@/lib/telegram-auth";
import { ensureWatcher } from "@/lib/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  ensureWatcher();
  const { session, error } = requireBuyer(req);
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }
  const cfg = getServerConfig();
  const allowed =
    isAdmin(session.user.id) || (cfg.devBypass && cfg.watcherMock);
  if (!allowed) {
    return NextResponse.json({ error: "Yalnızca yönetici onaylar." }, { status: 403 });
  }
  const { id } = await params;
  const result = await markOrder(id, "paid", { note: "yönetici onayı" });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
