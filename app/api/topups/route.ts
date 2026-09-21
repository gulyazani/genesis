import { NextResponse } from "next/server";
import { createTopup } from "@/lib/orders";
import { requireBuyer } from "@/lib/telegram-auth";
import { ensureWatcher } from "@/lib/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  ensureWatcher();
  const { session, error } = requireBuyer(req);
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }
  let body: { amount?: number; txHashHint?: string };
  try {
    body = (await req.json()) as { amount?: number; txHashHint?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const name = [session.user.first_name, session.user.last_name]
    .filter(Boolean)
    .join(" ");
  const result = await createTopup({
    amount: Number(body.amount),
    telegramUserId: String(session.user.id),
    telegramName: name || session.user.username,
    txHashHint: body.txHashHint,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
