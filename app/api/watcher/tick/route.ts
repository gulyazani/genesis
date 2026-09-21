import { NextResponse } from "next/server";
import { tickWatcher } from "@/lib/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  await tickWatcher();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  await tickWatcher();
  return NextResponse.json({ ok: true });
}
