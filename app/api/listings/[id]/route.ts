import { NextResponse } from "next/server";
import { getListing } from "@/lib/orders";
import { expireOverdueOrders } from "@/lib/orders";
import { toPublicListing } from "@/lib/public-listing";
import { ensureWatcher } from "@/lib/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  ensureWatcher();
  await expireOverdueOrders();
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) {
    return NextResponse.json({ error: "İlan bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ listing: toPublicListing(listing) });
}
