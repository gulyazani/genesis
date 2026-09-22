import { Bot, Keyboard, webhookCallback } from "grammy";
import type { Context } from "grammy";
import { getServerConfig, isAdmin } from "@/lib/config";
import {
  createTopup,
  expireOverdueOrders,
  getOrder,
  isTopup,
  listOrdersForUser,
  markDelivered,
  markOrder,
  purchaseFromBalance,
} from "@/lib/orders";
import { notifyDelivery } from "@/lib/notify";
import { readListings } from "@/lib/store";
import { getUserBalance } from "@/lib/users";
import { formatUsdt, orderStatusLabel, statusLabel } from "@/lib/format";
import type { Listing } from "@/lib/types";

type GlobalBot = typeof globalThis & { __sellshellBot?: Bot | null };

function appPath(base: string, path: string) {
  const root = base.replace(/\/+$/, "");
  return path === "/" ? root : `${root}${path}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function welcomeText() {
  return [
    "<b>Hoş geldiniz.</b>",
    "",
    "Nizam'ın kendi domain ve web siteleri burada.",
    "Komutlar Mini App açmadan da çalışır.",
    "",
    "/domainler — domainler",
    "/liste — satışa hazır",
    "/siparisler — siparişlerim",
    "/bakiye — bakiye gör / yükle",
  ].join("\n");
}

function userHelpText() {
  return [
    "<b>Komutlar</b>",
    "/start — hoş geldiniz",
    "/domainler — açık domainler",
    "/liste — satışa hazır ilanlar",
    "/siparisler — siparişlerin",
    "/bakiye — bakiyen",
    "/yukle 50 — 50 USDT yükleme başlat",
    "/al ilan-id — bakiyeden satın al",
    "/yardim — bu liste",
  ].join("\n");
}

function buyerName(ctx: Context) {
  return (
    [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") ||
    ctx.from?.username ||
    ""
  );
}

function replyKeyboard() {
  return new Keyboard()
    .text("Domainler")
    .text("Satışa hazır liste")
    .row()
    .text("Siparişlerim")
    .text("Bakiye yükle")
    .resized()
    .persistent();
}

function formatListingLine(item: Listing) {
  const buy =
    item.status === "available" ? `\n  Satın al: /al ${item.id}` : "";
  return `• <b>${escapeHtml(item.title)}</b> — ${formatUsdt(item.price)}\n  ${statusLabel(item.status)}${buy}`;
}

async function replyDomainler(ctx: Context) {
  await expireOverdueOrders();
  const listings = await readListings();
  const items = listings.filter(
    (item) => item.type === "domain" && item.status !== "sold",
  );
  if (!items.length) {
    await ctx.reply("Şu an açık domain yok.");
    return;
  }
  await ctx.reply(
    ["<b>Domainler</b>", "", ...items.map(formatListingLine)].join("\n\n"),
    { parse_mode: "HTML" },
  );
}

async function replyListe(ctx: Context) {
  await expireOverdueOrders();
  const listings = await readListings();
  const items = listings.filter((item) => item.status === "available");
  if (!items.length) {
    await ctx.reply("Şu an satışa hazır ilan yok.");
    return;
  }
  await ctx.reply(
    ["<b>Satışa hazır liste</b>", "", ...items.map(formatListingLine)].join(
      "\n\n",
    ),
    { parse_mode: "HTML" },
  );
}

async function replySiparisler(ctx: Context) {
  if (!ctx.from) return;
  await expireOverdueOrders();
  const orders = await listOrdersForUser(String(ctx.from.id));
  const listings = await readListings();
  if (!orders.length) {
    await ctx.reply(
      "Henüz siparişin yok. /domainler veya /liste ile bak, /al ile satın al.",
    );
    return;
  }
  const lines = orders.slice(0, 8).map((order) => {
    const title = isTopup(order)
      ? "Bakiye yükleme"
      : (listings.find((item) => item.id === order.listingId)?.title ??
        order.listingId);
    return `• ${escapeHtml(title)} — ${orderStatusLabel(order.status)} · ${formatUsdt(order.amount)}\n<code>${order.id}</code>`;
  });
  await ctx.reply(["<b>Siparişlerim</b>", "", ...lines].join("\n\n"), {
    parse_mode: "HTML",
  });
}

async function replyBakiye(ctx: Context) {
  if (!ctx.from) return;
  const cfg = getServerConfig();
  const balance = await getUserBalance(String(ctx.from.id));
  await ctx.reply(
    [
      "<b>Bakiye</b>",
      formatUsdt(balance),
      "",
      cfg.wallet
        ? `Cüzdan (USDT TRC-20):\n<code>${cfg.wallet}</code>`
        : "Cüzdan henüz ayarlı değil.",
      `Pencere: ${cfg.watchWindowMin} dakika.`,
      "",
      "Yüklemek için: /yukle 50",
      "Nizam onaylayınca (/paid) bakiye işlenir.",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
}

async function replyYukle(ctx: Context) {
  if (!ctx.from) return;
  const raw = String(ctx.match ?? "").trim().replace(",", ".");
  const amount = Number(raw);
  if (!raw || !Number.isFinite(amount)) {
    await ctx.reply("Kullanım: /yukle 50\nSonra cüzdana USDT TRC-20 gönder.");
    return;
  }
  const result = await createTopup({
    amount,
    telegramUserId: String(ctx.from.id),
    telegramName: buyerName(ctx),
  });
  if ("error" in result) {
    await ctx.reply(result.error ?? "Yükleme açılamadı.");
    return;
  }
  const order = result.order;
  const cfg = getServerConfig();
  await ctx.reply(
    [
      "<b>Bakiye yükleme açıldı</b>",
      `${formatUsdt(order.amount)} · ${order.network} ${order.asset}`,
      cfg.wallet
        ? `Cüzdan: <code>${cfg.wallet}</code>`
        : "Cüzdan adresi henüz ayarlı değil.",
      `Sipariş: <code>${order.id}</code>`,
      `Pencere: ${cfg.watchWindowMin} dakika.`,
      "Gönderince Nizam /paid ile onaylar. Bakiye o zaman artar.",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
}

async function replyAl(ctx: Context) {
  if (!ctx.from) return;
  const listingId = String(ctx.match ?? "").trim();
  if (!listingId) {
    await ctx.reply(
      "Kullanım: /al anadoluyazilim-com\nİlan id /domainler veya /liste çıktısında.",
    );
    return;
  }
  const result = await purchaseFromBalance({
    listingId,
    telegramUserId: String(ctx.from.id),
    telegramName: buyerName(ctx),
  });
  if ("error" in result) {
    const extra =
      "shortfall" in result && result.shortfall
        ? `\nEksik: ${formatUsdt(result.shortfall)}. /yukle ${Math.ceil(result.shortfall)}`
        : "";
    await ctx.reply(`${result.error}${extra}`);
    return;
  }
  await ctx.reply(
    [
      `<b>Satın alındı</b> — ${escapeHtml(result.listing.title)}`,
      `${formatUsdt(result.order.amount)} bakiyeden düştü.`,
      `Kalan: ${formatUsdt(result.balanceUsdt)}`,
      `Sipariş: <code>${result.order.id}</code>`,
      "Giriş bilgilerini Nizam sohbetten yollar.",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
}

const PUBLIC_COMMANDS = [
  { command: "start", description: "Hoş geldiniz" },
  { command: "domainler", description: "Domain ilanları" },
  { command: "liste", description: "Satışa hazır liste" },
  { command: "siparisler", description: "Siparişlerim" },
  { command: "bakiye", description: "Bakiye gör / yükle" },
  { command: "yukle", description: "Bakiye yükle: /yukle 50" },
  { command: "al", description: "Satın al: /al ilan-id" },
  { command: "yardim", description: "Komut listesi" },
] as const;

const ADMIN_COMMANDS = [
  ...PUBLIC_COMMANDS,
  { command: "paid", description: "Top-up onayla: /paid ord_..." },
  { command: "expire", description: "Siparişi iptal: /expire ord_..." },
  { command: "teslim", description: "Giriş bilgisi gönder" },
  { command: "help", description: "Yönetici komutları" },
] as const;

export function getBot() {
  const g = globalThis as GlobalBot;
  const token = getServerConfig().botToken;
  if (!token) {
    g.__sellshellBot = null;
    return null;
  }
  if (g.__sellshellBot) return g.__sellshellBot;

  const bot = new Bot(token);
  const { miniAppUrl, adminId } = getServerConfig();

  void bot.api.setMyCommands([...PUBLIC_COMMANDS]).catch(() => {
    console.info("setMyCommands skipped");
  });
  if (adminId) {
    void bot.api
      .setMyCommands([...ADMIN_COMMANDS], {
        scope: { type: "chat", chat_id: Number(adminId) },
      })
      .catch(() => {
        console.info("admin setMyCommands skipped");
      });
  }

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
      reply_markup: replyKeyboard(),
    });
  });

  bot.command(["domainler", "domain", "domailer"], replyDomainler);
  bot.command(["liste", "stok"], replyListe);
  bot.command(["siparisler", "siparis"], replySiparisler);
  bot.command(["bakiye", "balance"], replyBakiye);
  bot.command(["yukle", "topup"], replyYukle);
  bot.command(["al", "buy"], replyAl);
  bot.command("yardim", async (ctx) => {
    await ctx.reply(userHelpText(), { parse_mode: "HTML" });
  });

  bot.hears("Domainler", replyDomainler);
  bot.hears("Satışa hazır liste", replyListe);
  bot.hears("Siparişlerim", replySiparisler);
  bot.hears("Bakiye yükle", replyBakiye);

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
      await ctx.reply(userHelpText(), { parse_mode: "HTML" });
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
