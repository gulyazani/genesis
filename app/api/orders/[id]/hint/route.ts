import { NextResponse } from "next/server";
import { setOrderHint } from "@/lib/orders";
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
  const { id } = await params;
  let body: { txHashHint?: string };
  try {
    body = (await req.json()) as { txHashHint?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const result = await setOrderHint(
    id,
    String(session.user.id),
    body.txHashHint ?? "",
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
