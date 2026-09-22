# sellshell

Nizam Özdemir’in kendi domain ve web sitelerini sattığı Telegram botu + Mini App.

Ödeme: **USDT TRC-20** Nizam’ın cüzdanına. Watcher TX’i görür; **bakiye ancak Nizam `/paid` deyince** artar. İlan **bakiyeden**. Satın alınca giriş bilgilerini Nizam bot’tan **`/teslim`** ile yollar. Merchant, IBAN, Stars, Telegram Payments yok.

Yüzey kilitli: **Domainler** · **Satışa hazır liste** · **Siparişlerim** · **Bakiye yükle**. Dil: Türkçe. Host: kendi VPS (Docker + Caddy). Giriş yok — `initData`.

**Hedef domain:** [https://supershell.click](https://supershell.click) — Mini App ve webhook için. Webhook yolu: `https://supershell.click/api/telegram/webhook`. Cloudflare DNS + HTTPS hazır; origin’de sertifika yok (CF Flexible). `setWebhook` yalnızca site sellshell döndürünce — şu an origin hâlâ varsayılan hosting sayfası.

## Akış

1. Alıcı **Bakiye yükle** — tutar + Nizam’ın cüzdanı. Order `kind=topup` `pending`.
2. Watcher eşleşince `awaiting_admin` — bakiye **yazılmaz**. Nizam’a `/paid ord_...` gider.
3. Nizam `/paid` → `paid` + `balanceUsdt` artar. Red: `/expire`.
4. Alıcı Domainler / Satışa hazır listeden **bakiyeden satın al** — listing `sold`, stoktan düşer, order hemen `paid`. Satışa hazır listede durmaz.
5. Nizam `/teslim ord_... kullanıcı şifre panel` — metin alıcıya iletilir, `deliveredAt` işaretlenir. Şifre diske yazılmaz.

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
| `/` | Domainler |
| `/stock` | Satışa hazır liste (`available`) |
| `/balance` | Bakiye yükle |
| `/orders` | Siparişlerim (alış + top-up) |
| `/listings/anadoluyazilim-com` | Domain detay |
| `/checkout/anadoluyazilim-com` | Bakiyeden satın al (yetersizse Bakiye yükle) |
| `/orders/<id>` | Durum + local mock / Nizam onayı / teslimat |

Mock bakiye (demo user, `DEV_BYPASS_TELEGRAM=1`):

```bash
curl -s -X POST http://127.0.0.1:43127/api/topups \
  -H 'content-type: application/json' \
  -d '{"amount":50}'

# dönen order.id sayfasında “Eşleşen ödemeyi simüle et” veya:
curl -s -X POST http://127.0.0.1:43127/api/watcher/mock \
  -H 'content-type: application/json' \
  -d '{"amount":50}'

curl -s http://127.0.0.1:43127/api/me   # hâlâ 0 — awaiting_admin

# local Nizam onayı (prod’da bot /paid):
curl -s -X POST http://127.0.0.1:43127/api/orders/<id>/confirm \
  -H 'content-type: application/json' \
  -d '{}'

curl -s http://127.0.0.1:43127/api/me   # balanceUsdt: 50

curl -s -X POST http://127.0.0.1:43127/api/orders \
  -H 'content-type: application/json' \
  -d '{"listingId":"kucukisletme-co"}'   # 420 USDT — yetersizse 402
```

Satın alma sonrası local teslimat (prod’da `/teslim`; bilgi kaydedilmez):

```bash
curl -s -X POST http://127.0.0.1:43127/api/orders/<id>/deliver \
  -H 'content-type: application/json' \
  -d '{"message":"kullanıcı: admin\\nşifre: ..."}'
```

## Env

`.env.example` kopyala. **Sırrı commit etme.**

| Değişken | Faz 1 |
| --- | --- |
| `BOT_TOKEN` | BotFather. Zorunlu (bot + `initData` HMAC) |
| `TELEGRAM_ADMIN_ID` | Nizam’ın Telegram `user.id`. `/paid` `/expire` `/teslim` |
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
3. Webhook (yalnızca `https://supershell.click/api/health` → `{"service":"sellshell"}` olduktan sonra; token’ı loglama; henüz **çağırma**):

```bash
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://supershell.click/api/telegram/webhook"
```

`/start` klavye: Domainler · Satışa hazır liste · Siparişlerim · Bakiye yükle.

Yönetici (yalnızca `TELEGRAM_ADMIN_ID`):

- `/paid <sipariş-id>` — görülen top-up’ı bakiyeye yaz
- `/expire <sipariş-id>` — yüklemeyi iptal
- `/teslim <sipariş-id> kullanıcı şifre panel` — giriş bilgilerini alıcıya ilet (diske yazılmaz)
- `/help` — kısa hatırlatma

## VPS + Cloudflare (origin SSL yok)

Ziyaretçi ve Telegram **HTTPS** görür; sertifikayı Cloudflare verir. VPS’te Let’s Encrypt / Caddy TLS **kurma**.

Cloudflare:

1. DNS `A` (veya `AAAA`) `supershell.click` → VPS IP, **Proxied** (turuncu bulut).
2. SSL/TLS → **Flexible**. Full / Full (strict) origin sertifikası ister; atladıysan 525/500 olur.
3. Always Use HTTPS: açık.
4. Bot Fight Mode kapalı (Telegram webhook POST’unu keser).
5. Origin :80’de **sellshell** olmalı. Şu an `defaultwebpage.cgi` (cPanel varsayılanı) duruyorsa Apache/httpd’yi durdur veya vhost’u kapat; 80 Caddy’nin.

```bash
# 80’i tutan eski panel
sudo systemctl stop apache2 httpd nginx 2>/dev/null || true

cp .env.example .env
# BOT_TOKEN TELEGRAM_ADMIN_ID CRYPTO_WALLET_ADDRESS
# MINI_APP_URL=https://supershell.click
# WATCHER_MOCK=0
# DEV_BYPASS_TELEGRAM=0
docker compose up -d --build
```

Kanıt (sellshell olmadan `setWebhook` yok):

```bash
curl -s http://127.0.0.1/api/health
# {"ok":true,"service":"sellshell",...}

curl -s https://supershell.click/api/health
```

Caddy `auto_https off`, yalnızca `:80` → `app:43127`. Host Caddy + pm2: `Caddyfile.example` (`127.0.0.1:43127`).

43127’yi internete açma; Cloudflare yalnızca 80’e gelsin.

## Veri

- `data/listings.json` — Nizam’ın ilanları (şifre / panel yok)
- `data/orders.json` — alış + top-up (`awaiting_admin`, `deliveredAt`)
- `data/users.json` — `telegramUserId` → `balanceUsdt`

Admin CRUD UI ve SQL Faz 2. Registrar otomasyonu yok.
