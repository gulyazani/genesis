import { Bot, Keyboard, webhookCallback } from "grammy";
import { getServerConfig, isAdmin } from "@/lib/config";
import { expireOverdueOrders, getOrder, listOrdersForUser, markOrder } from "@/lib/orders";
import { readListings } from "@/lib/store";
import { formatUsdt, orderStatusLabel } from "@/lib/format";

type GlobalBot = typeof globalThis & { __sellshellBot?: Bot | null };

function welcomeText(name: string, userId: number) {
  return [
    `Hoş geldin, ${name}.`,
    "",
    "sellshell — Nizam'ın kendi domain ve siteleri. Ödeme USDT TRC-20, kendi cüzdana.",
    `ID: <code>${userId}</code>`,
    "",
    "Katalogu Mini App'ten aç. Siparişlerin ve destek aşağıda.",
  ].join("\n");
}

function replyKeyboard(miniAppUrl: string) {
  const keyboard = new Keyboard();
  if (miniAppUrl.startsWith("https://")) {
    keyboard.webApp("Domainler", miniAppUrl).text("Siparişlerim").row().text("Destek");
  } else {
    keyboard.text("Domainler").text("Siparişlerim").row().text("Destek");
  }
  return keyboard.resized().persistent();
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
          text: "Katalog",
          web_app: { url: miniAppUrl },
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
    if (miniAppUrl.startsWith("https://")) {
      await ctx.reply("Katalog Mini App butonundan açılır.");
      return;
    }
    await ctx.reply(
      `Mini App henüz HTTPS değil — Telegram WebApp butonu için kendi domain gerekir. Local demo: ${miniAppUrl}`,
    );
  });

  bot.hears("Siparişlerim", async (ctx) => {
    if (!ctx.from) return;
    await expireOverdueOrders();
    const orders = await listOrdersForUser(String(ctx.from.id));
    const listings = await readListings();
    if (!orders.length) {
      await ctx.reply("Henüz siparişin yok. Domainler'den katalogu aç.");
      return;
    }
    const lines = orders.slice(0, 8).map((order) => {
      const listing = listings.find((item) => item.id === order.listingId);
      return `• ${listing?.title ?? order.listingId} — ${orderStatusLabel(order.status)} · ${formatUsdt(order.amount)}\n<code>${order.id}</code>`;
    });
    await ctx.reply(lines.join("\n\n"), { parse_mode: "HTML" });
  });

  bot.hears("Destek", async (ctx) => {
    await ctx.reply(
      "Teslimat, geç TX veya yanlış ağ için buradan yaz. sellshell Nizam'ın kendi stoğu — pazaryeri veya satıcı başvurusu yok.",
    );
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
