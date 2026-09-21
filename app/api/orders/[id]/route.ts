import { NextResponse } from "next/server";
import { getListing, getOrder } from "@/lib/orders";
import { requireBuyer } from "@/lib/telegram-auth";
import { ensureWatcher } from "@/lib/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  ensureWatcher();
  const { session, error } = requireBuyer(req);
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }
  if (order.telegramUserId !== String(session.user.id) && session.mode !== "demo") {
    return NextResponse.json({ error: "Bu sipariş sana ait değil." }, { status: 403 });
  }
  const listing = await getListing(order.listingId);
  return NextResponse.json({ order, listing, session });
}
