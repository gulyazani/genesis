import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-auth";
import { listAdminTopups } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  const topups = await listAdminTopups();
  return NextResponse.json({ topups });
}
