import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-auth";
import { deleteAdminListing } from "@/lib/listings-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  const { id } = await params;
  const result = await deleteAdminListing(id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
