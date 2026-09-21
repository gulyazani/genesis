import { NextResponse } from "next/server";
import { readListings } from "@/lib/store";
import { expireOverdueOrders } from "@/lib/orders";
import { ensureWatcher } from "@/lib/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  ensureWatcher();
  await expireOverdueOrders();
  const listings = await readListings();
  return NextResponse.json({ listings });
}
