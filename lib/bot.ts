import { Bot, Keyboard, webhookCallback } from "grammy";
import { getServerConfig, isAdmin } from "@/lib/config";
import {
  expireOverdueOrders,
  getOrder,
  isTopup,
  listOrdersForUser,
  markDelivered,
  markOrder,
} from "@/lib/orders";
import { notifyDelivery } from "@/lib/notify";
import { readListings } from "@/lib/store";
import { formatUsdt, orderStatusLabel } from "@/lib/format";

type GlobalBot = typeof globalThis & { __sellshellBot?: Bot | null };

function appPath(base: string, path: string) {
  const root = base.replace(/\/+$/, "");
  return path === "/" ? root : `${root}${path}`;
}

function welcomeText() {
  return [
    "<b>Hoş geldiniz.</b>",
    "",
    "Nizam'ın kendi domain ve web siteleri burada.",
    "Alttaki menüden devam edin.",
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
    await ctx.reply(welcomeText(), {
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
      await ctx.reply("Bu komut yalnızca yönetici.");
      return;
    }
    const orderId = String(ctx.match ?? "").trim();
    if (!orderId) {
      await ctx.reply("Kullanım: /paid ord_...");
      return;
    }
    const result = await markOrder(orderId, "paid", {
      note: "Nizam onayı",
    });
    if ("error" in result) {
      await ctx.reply(result.error);
      return;
    }
    await ctx.reply(
      isTopup(result.order)
        ? `Bakiye onaylandı: ${result.order.id} — tutar bakiyeye işlendi.`
        : `Onaylandı: ${result.order.id} → paid.`,
    );
  });

  bot.command("expire", async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("Bu komut yalnızca yönetici.");
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
    await ctx.reply(`İşaretlendi: ${result.order.id} → expired.`);
  });

  bot.command("help", async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("Domainler · Satışa hazır liste · Siparişlerim · Bakiye yükle");
      return;
    }
    await ctx.reply(
      [
        "Yönetici",
        "/paid ord_... — görülen transferi bakiyeye yaz",
        "/expire ord_... — yüklemeyi iptal et",
        "/teslim ord_... kullanıcı şifre panel — giriş bilgilerini alıcıya gönder",
        "Satır kırarak da yazabilirsin; ilk kelime sipariş id.",
      ].join("\n"),
    );
  });

  bot.command("teslim", async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("Teslimat yalnızca yönetici.");
      return;
    }
    const parsed = parseTeslimPayload(String(ctx.match ?? ""));
    const orderId = parsed.orderId;
    const body = parsed.body;
    if (!orderId || !body) {
      await ctx.reply(
        "Kullanım: /teslim ord_... kullanıcı / şifre / panel (alıcıya iletilir).",
      );
      return;
    }
    const order = await getOrder(orderId);
    if (!order) {
      await ctx.reply("Sipariş bulunamadı.");
      return;
    }
    if (isTopup(order)) {
      await ctx.reply("Bu bir bakiye yüklemesi — /paid ile onayla.");
      return;
    }
    if (order.status !== "paid") {
      await ctx.reply("Önce satışın tamamlanmış olması gerekir.");
      return;
    }
    const marked = await markDelivered(orderId);
    if ("error" in marked) {
      await ctx.reply(marked.error);
      return;
    }
    const listings = await readListings();
    const listing = listings.find((item) => item.id === order.listingId);
    await notifyDelivery(order, listing?.title, body);
    await ctx.reply(`Alıcıya iletildi: ${order.id}`);
  });

  g.__sellshellBot = bot;
  return bot;
}

function parseTeslimPayload(raw: string) {
  const text = raw.trim();
  const match = text.match(/^(\S+)\s+([\s\S]+)$/);
  if (!match) return { orderId: "", body: "" };
  return { orderId: match[1], body: match[2].trim() };
}

export function telegramWebhookHandler() {
  const bot = getBot();
  if (!bot) return null;
  return webhookCallback(bot, "std/http");
}
