# sellshell

Nizam Özdemir’in kendi domain ve web sitelerini sattığı Telegram botu + Mini App.

Ödeme: **USDT TRC-20** Nizam’ın cüzdanına. Watcher TX’i görür; **bakiye ancak Nizam `/paid` deyince** artar. İlan **bakiyeden**. Satın alınca giriş bilgilerini Nizam bot’tan **`/teslim`** ile yollar. Merchant, IBAN, Stars, Telegram Payments yok.

Yüzey kilitli: **Domainler** · **Satışa hazır liste** · **Siparişlerim** · **Bakiye yükle**. Dil: Türkçe. Host: kendi VPS (Docker + Caddy). Giriş yok — `initData`.

**Hedef domain:** [https://supershell.click](https://supershell.click) — Mini App ve webhook için. Webhook yolu: `https://supershell.click/api/telegram/webhook`. `setWebhook` henüz çağrılmadı: domain şu an DNS çözülmüyor; VPS + TLS hazır olunca çağır.

## Akış

1. Alıcı **Bakiye yükle** — tutar + Nizam’ın cüzdanı. Order `kind=topup` `pending`.
2. Watcher eşleşince `awaiting_admin` — bakiye **yazılmaz**. Nizam’a `/paid ord_...` gider.
3. Nizam `/paid` → `paid` + `balanceUsdt` artar. Red: `/expire`.
4. Alıcı Domainler / Satışa hazır listeden **bakiyeden satın al** — listing `sold`, order hemen `paid`.
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
3. Webhook yolu (yalnızca VPS’te public HTTPS olduktan sonra; token’ı loglama; şimdilik **çağırma**):

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

## VPS (Docker + Caddy)

```bash
cp .env.example .env
# token, admin id, cüzdan, MINI_APP_URL=https://supershell.click
# WATCHER_MOCK=0  DEV_BYPASS_TELEGRAM=0
docker compose up -d --build
```

Caddy örneği: `Caddyfile.example`. App `43127` dinler. `data/listings.json`, `data/orders.json`, `data/users.json` volume’da yazılır.

pm2 alternatifi: `npm run build && npm start` — aynı port, aynı env, Caddy `reverse_proxy 127.0.0.1:43127`.

## Veri

- `data/listings.json` — Nizam’ın ilanları (şifre / panel yok)
- `data/orders.json` — alış + top-up (`awaiting_admin`, `deliveredAt`)
- `data/users.json` — `telegramUserId` → `balanceUsdt`

Admin CRUD UI ve SQL Faz 2. Registrar otomasyonu yok.
