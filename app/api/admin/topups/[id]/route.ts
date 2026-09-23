import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-auth";
import { getOrder, isTopup, markOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  const { id } = await params;
  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const order = await getOrder(id);
  if (!order || !isTopup(order)) {
    return NextResponse.json({ error: "Yükleme bulunamadı." }, { status: 404 });
  }
  if (body.action !== "paid" && body.action !== "expire") {
    return NextResponse.json({ error: "action: paid veya expire." }, { status: 400 });
  }
  const result = await markOrder(id, body.action === "paid" ? "paid" : "expired", {
    note: body.action === "paid" ? "panel onayı" : "panel red",
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
