import { Bot, Keyboard, webhookCallback } from "grammy";
import { getServerConfig, isAdmin } from "@/lib/config";
import { expireOverdueOrders, getOrder, isTopup, listOrdersForUser, markOrder } from "@/lib/orders";
import { readListings } from "@/lib/store";
import { formatUsdt, orderStatusLabel } from "@/lib/format";

type GlobalBot = typeof globalThis & { __sellshellBot?: Bot | null };

function appPath(base: string, path: string) {
  const root = base.replace(/\/+$/, "");
  return path === "/" ? root : `${root}${path}`;
}

function welcomeText(name: string, userId: number) {
  return [
    `Hoş geldin, ${name}.`,
    "",
    "sellshell — Nizam'ın kendi domain ve siteleri. Giriş yok; Mini App Telegram kimliğin.",
    `ID: <code>${userId}</code>`,
    "",
    "Domainler · Satışa hazır liste · Siparişlerim · Bakiye yükle",
  ].join("\n");
}

function replyKeyboard(miniAppUrl: string) {
  const keyboard = new Keyboard();
  if (miniAppUrl.startsWith("https://")) {
    keyboard
      .webApp("Domainler", appPath(miniAppUrl, "/"))
      .webApp("Satışa hazır liste", appPath(miniAppUrl, "/stock"))
      .row()
      .webApp("Siparişlerim", appPath(miniAppUrl, "/orders"))
      .webApp("Bakiye yükle", appPath(miniAppUrl, "/balance"));
  } else {
    keyboard
      .text("Domainler")
      .text("Satışa hazır liste")
      .row()
      .text("Siparişlerim")
      .text("Bakiye yükle");
  }
  return keyboard.resized().persistent();
}

function openHint(miniAppUrl: string, path: string, label: string) {
  if (miniAppUrl.startsWith("https://")) {
    return `${label} Mini App butonundan açılır.`;
  }
  return `${label}: ${appPath(miniAppUrl, path)} (local demo — HTTPS Mini App sonra)`;
}

export function getBot() {
  const g = globalThis as GlobalBot;
  const token = getServerConfig().botToken;
  if (!token) {
    g.__sellshellBot = null;
    return null;
  }
  if (g.__sellshellBot) return g.__sellshellBot;

  const bot = new Bot(token);
  const { miniAppUrl } = getServerConfig();

  if (miniAppUrl.startsWith("https://")) {
    void bot.api
      .setChatMenuButton({
        menu_button: {
          type: "web_app",
          text: "Domainler",
          web_app: { url: appPath(miniAppUrl, "/") },
        },
      })
      .catch(() => {
        console.info("menu button skipped");
      });
  }

  bot.command("start", async (ctx) => {
    const name = ctx.from?.first_name ?? "oradaki";
    const id = ctx.from?.id ?? 0;
    await ctx.reply(welcomeText(name, id), {
      parse_mode: "HTML",
      reply_markup: replyKeyboard(miniAppUrl),
    });
  });

  bot.hears("Domainler", async (ctx) => {
    await ctx.reply(openHint(miniAppUrl, "/", "Domainler"));
  });

  bot.hears("Satışa hazır liste", async (ctx) => {
    await ctx.reply(openHint(miniAppUrl, "/stock", "Satışa hazır liste"));
  });

  bot.hears("Bakiye yükle", async (ctx) => {
    await ctx.reply(openHint(miniAppUrl, "/balance", "Bakiye yükle"));
  });

  bot.hears("Siparişlerim", async (ctx) => {
    if (!ctx.from) return;
    await expireOverdueOrders();
    const orders = await listOrdersForUser(String(ctx.from.id));
    const listings = await readListings();
    if (!orders.length) {
      await ctx.reply("Henüz siparişin yok. Domainler veya Satışa hazır listeden bak.");
      return;
    }
    const lines = orders.slice(0, 8).map((order) => {
      const title = isTopup(order)
        ? "Bakiye yükleme"
        : (listings.find((item) => item.id === order.listingId)?.title ?? order.listingId);
      return `• ${title} — ${orderStatusLabel(order.status)} · ${formatUsdt(order.amount)}\n<code>${order.id}</code>`;
    });
    await ctx.reply(lines.join("\n\n"), { parse_mode: "HTML" });
  });

  bot.command("paid", async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("Bu komut yalnızca yönetici yedeği.");
      return;
    }
    const orderId = String(ctx.match ?? "").trim();
    if (!orderId) {
      await ctx.reply("Kullanım: /paid ord_...");
      return;
    }
    const result = await markOrder(orderId, "paid", {
      note: "admin /paid yedek",
    });
    if ("error" in result) {
      await ctx.reply(result.error);
      return;
    }
    await ctx.reply(`İşaretlendi: ${result.order.id} → paid (yedek).`);
  });

  bot.command("expire", async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("Bu komut yalnızca yönetici yedeği.");
      return;
    }
    const orderId = String(ctx.match ?? "").trim();
    if (!orderId) {
      await ctx.reply("Kullanım: /expire ord_...");
      return;
    }
    const existing = await getOrder(orderId);
    if (!existing) {
      await ctx.reply("Sipariş bulunamadı.");
      return;
    }
    const result = await markOrder(orderId, "expired", {
      note: "admin /expire yedek",
    });
    if ("error" in result) {
      await ctx.reply(result.error);
      return;
    }
    await ctx.reply(`İşaretlendi: ${result.order.id} → expired (yedek).`);
  });

  g.__sellshellBot = bot;
  return bot;
}

export function telegramWebhookHandler() {
  const bot = getBot();
  if (!bot) return null;
  return webhookCallback(bot, "std/http");
}
