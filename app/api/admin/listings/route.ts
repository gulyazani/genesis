import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-auth";
import { createAdminListing, listAdminListings } from "@/lib/listings-admin";
import type { DeliveryMethod, ListingType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  const listings = await listAdminListings();
  return NextResponse.json({ listings });
}

export async function POST(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  let body: {
    title?: string;
    url?: string;
    price?: number;
    type?: ListingType;
    summary?: string;
    method?: DeliveryMethod;
    username?: string;
    password?: string;
    loginUrl?: string;
    authorityScore?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const method = body.method;
  if (method !== "cpanel" && method !== "wordpress" && method !== "link") {
    return NextResponse.json({ error: "Teslim yöntemi seç: cpanel, wordpress veya link." }, { status: 400 });
  }
  const result = await createAdminListing({
    title: body.title ?? "",
    url: body.url,
    price: Number(body.price),
    type: body.type === "website" ? "website" : "domain",
    summary: body.summary,
    method,
    username: body.username,
    password: body.password,
    loginUrl: body.loginUrl,
    authorityScore: Number(body.authorityScore),
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
