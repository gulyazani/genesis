import { NextResponse } from "next/server";
import { getServerConfig } from "@/lib/config";
import { applyIncomingTx, injectMockTx } from "@/lib/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!getServerConfig().watcherMock) {
    return NextResponse.json(
      { error: "Mock kapalı. WATCHER_MOCK=1 gerekli." },
      { status: 403 },
    );
  }
  let body: {
    amount?: number;
    txHash?: string;
    to?: string;
    asset?: string;
    network?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (typeof body.amount !== "number" || Number.isNaN(body.amount)) {
    return NextResponse.json({ error: "amount (USDT) gerekli." }, { status: 400 });
  }
  const tx = injectMockTx({
    amount: body.amount,
    txHash: body.txHash,
    to: body.to,
    asset: body.asset,
    network: body.network,
  });
  const result = await applyIncomingTx(tx);
  return NextResponse.json({ tx, result });
}
