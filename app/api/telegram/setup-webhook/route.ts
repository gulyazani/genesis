import { NextResponse } from "next/server";
import { getServerConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function tokenLooksValid(token: string) {
  return token.length >= 20 && token.includes(":");
}

async function setupWebhook() {
  const { botToken, webhookUrl } = getServerConfig();
  if (!tokenLooksValid(botToken)) {
    return NextResponse.json(
      {
        ok: false,
        desc: "BOT_TOKEN .env icinde yok, kisa veya ':' eksik. nano .env ile duzelt.",
      },
      { status: 500 },
    );
  }

  const body = new URLSearchParams({ url: webhookUrl });
  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    body,
  });
  const data = (await res.json()) as {
    ok?: boolean;
    description?: string;
    result?: unknown;
  };

  return NextResponse.json(
    {
      ok: Boolean(data.ok),
      desc: data.description ?? data.result ?? "",
      url: webhookUrl,
    },
    { status: data.ok ? 200 : 400 },
  );
}

export async function GET() {
  return setupWebhook();
}

export async function POST() {
  return setupWebhook();
}
