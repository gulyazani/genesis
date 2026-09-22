import { NextResponse } from "next/server";
import { getServerConfig, isAdmin } from "@/lib/config";
import { notifyDelivery } from "@/lib/notify";
import { getListing, getOrder, markDelivered } from "@/lib/orders";
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
    return NextResponse.json({ error: "Teslimatı yalnızca yönetici yazar." }, { status: 403 });
  }
  const { id } = await params;
  let payload: { message?: string };
  try {
    payload = (await req.json()) as { message?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const message = payload.message?.trim() ?? "";
  if (!message) {
    return NextResponse.json({ error: "Giriş bilgisi boş olamaz." }, { status: 400 });
  }
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }
  const marked = await markDelivered(id);
  if ("error" in marked) {
    return NextResponse.json({ error: marked.error }, { status: 400 });
  }
  const listing = order.listingId ? await getListing(order.listingId) : null;
  await notifyDelivery(marked.order, listing?.title, message);
  return NextResponse.json({ order: marked.order });
}
