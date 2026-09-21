import { NextResponse } from "next/server";
import { telegramWebhookHandler } from "@/lib/bot";
import { ensureWatcher } from "@/lib/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  ensureWatcher();
  const handler = telegramWebhookHandler();
  if (!handler) {
    return NextResponse.json(
      { error: "BOT_TOKEN ayarlı değil." },
      { status: 503 },
    );
  }
  try {
    return await handler(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "webhook error";
    console.error("telegram webhook failed", message);
    return NextResponse.json({ error: "webhook failed" }, { status: 500 });
  }
}
