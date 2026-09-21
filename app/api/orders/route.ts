import { NextResponse } from "next/server";
import { createOrder, listOrdersForUser } from "@/lib/orders";
import { requireBuyer } from "@/lib/telegram-auth";
import { ensureWatcher } from "@/lib/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  ensureWatcher();
  const { session, error } = requireBuyer(req);
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }
  const orders = await listOrdersForUser(String(session.user.id));
  return NextResponse.json({ orders, session });
}

export async function POST(req: Request) {
  ensureWatcher();
  const { session, error } = requireBuyer(req);
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }
  let body: { listingId?: string; txHashHint?: string };
  try {
    body = (await req.json()) as { listingId?: string; txHashHint?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (!body.listingId) {
    return NextResponse.json({ error: "listingId gerekli." }, { status: 400 });
  }
  const name = [session.user.first_name, session.user.last_name]
    .filter(Boolean)
    .join(" ");
  const result = await createOrder({
    listingId: body.listingId,
    telegramUserId: String(session.user.id),
    telegramName: name || session.user.username,
    txHashHint: body.txHashHint,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json(result, { status: 201 });
}
