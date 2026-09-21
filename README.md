# sellshell

Nizam Özdemir’in kendi domain ve web sitelerini sattığı Telegram botu + Mini App.

Ödeme: **USDT TRC-20**, Nizam’ın cüzdanına. Incoming-tx watcher tutarı (ve varsa TX hash’i) eşleştirir → sipariş `paid` → bot alıcı + admin’e yazar. Merchant, IBAN, Stars, Telegram Payments yok.

Yüzey: Telegram Mini App. Dil: Türkçe. Host: kendi VPS (Docker + Caddy).

**Hedef domain:** [https://supershell.click](https://supershell.click) — Mini App ve webhook için. Webhook yolu: `https://supershell.click/api/telegram/webhook`. `setWebhook` henüz çağrılmadı: domain şu an DNS çözülmüyor; VPS + TLS hazır olunca çağır.

## Local

```bash
cp .env.example .env.local
# BOT_TOKEN ekle. Local için WATCHER_MOCK=1 ve DEV_BYPASS_TELEGRAM=1 kalsın.
npm install
npm run dev
```

Aç: [http://127.0.0.1:43127](http://127.0.0.1:43127)

Tarayıcıda **yerel demo** çalışır (Telegram `initData` yok). Prod benzeri kilit için `DEV_BYPASS_TELEGRAM=0` — o zaman banner: “bot üzerinden açın”.

### Demo yolları

| Yol | Ne |
| --- | --- |
| `/` | Katalog (domain + site + satıldı) |
| `/listings/anadoluyazilim-com` | Domain detay |
| `/listings/mutfakrehberi-com` | Site detay |
| `/listings/istanbulajans-net` | Satılmış ilan |
| `/checkout/anadoluyazilim-com` | Checkout (cüzdan, ağ, hash, pencere) |
| `/orders` | Siparişlerim |
| `/orders/<id>` | Pending / paid / underpaid / expired + local mock butonları |

Mock ödeme (anahtarsız): sipariş sayfasında **Eşleşen ödemeyi simüle et**, veya:

```bash
curl -s -X POST http://127.0.0.1:43127/api/orders \
  -H 'content-type: application/json' \
  -d '{"listingId":"anadoluyazilim-com"}'

curl -s -X POST http://127.0.0.1:43127/api/watcher/mock \
  -H 'content-type: application/json' \
  -d '{"amount":1850}'
```

## Env

`.env.example` kopyala. **Sırrı commit etme.**

| Değişken | Faz 1 |
| --- | --- |
| `BOT_TOKEN` | BotFather. Zorunlu (bot + `initData` HMAC) |
| `TELEGRAM_ADMIN_ID` | Nizam’ın Telegram `user.id`. Admin notify + `/paid` `/expire` |
| `MINI_APP_URL` | Mini App + menü. Hedef: `https://supershell.click` (trailing slash yok) |
| `CRYPTO_WALLET_ADDRESS` | TRC-20 USDT cüzdan. Yoksa checkout uyarır; mock yine çalışır |
| `CRYPTO_ASSET` / `CRYPTO_NETWORK` | Varsayılan `USDT` / `TRC-20` |
| `CRYPTO_WATCH_WINDOW_MIN` | Varsayılan `120` |
| `TRONGRID_API_KEY` | İsteğe. Yoksa public TronGrid (rate limit) |
| `WATCHER_MOCK` | Local `1`. VPS’te `0` |
| `DEV_BYPASS_TELEGRAM` | Local `1`. VPS’te `0` |

## Telegram

Hedef host: **supershell.click**.

1. BotFather’da bot + Menu Button / Web App URL = `https://supershell.click`
2. Mini App allowlist = `supershell.click`
3. Webhook yolu (yalnızca VPS’te public HTTPS olduktan sonra; token’ı loglama; şimdilik **çağırma**):

```bash
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://supershell.click/api/telegram/webhook"
```

Komutlar: `/start` — Domainler (Mini App), Siparişlerim, Destek.

Acil yedek (ana yol watcher): `/paid <sipariş-id>`, `/expire <sipariş-id>` — yalnızca `TELEGRAM_ADMIN_ID`.

## VPS (Docker + Caddy)

```bash
cp .env.example .env
# token, admin id, cüzdan, MINI_APP_URL=https://supershell.click
# WATCHER_MOCK=0  DEV_BYPASS_TELEGRAM=0
docker compose up -d --build
```

Caddy örneği: `Caddyfile.example`. App `43127` dinler. `data/listings.json` ve `data/orders.json` volume’da yazılır.

pm2 alternatifi: `npm run build && npm start` — aynı port, aynı env, Caddy `reverse_proxy 127.0.0.1:43127`.

## Veri

- `data/listings.json` — ilanlar (`available` / `reserved` / `sold`)
- `data/orders.json` — siparişler (disk, watcher yazar)

Admin CRUD UI ve SQL Faz 2. Registrar otomasyonu yok.
