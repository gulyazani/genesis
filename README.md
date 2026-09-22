# supershell

supershell — domain ve web sitesi satışı. Telegram botu + Mini App.

Ödeme: **USDT TRC-20** firma cüzdanına. Watcher TX’i görür; **bakiye ancak yönetici `/paid` deyince** artar. İlan **bakiyeden**. Satın alınca giriş bilgilerini yönetici bot’tan **`/teslim`** ile yollar. Merchant, IBAN, Stars, Telegram Payments yok.

Yüzey kilitli: **Domainler** · **Satışa hazır liste** · **Siparişlerim** · **Bakiye yükle**. Dil: Türkçe. Host: kendi VPS (Docker + Caddy). Giriş yok — `initData`.

**Hedef domain:** [https://supershell.click](https://supershell.click) — Mini App ve webhook için. Webhook yolu: `https://supershell.click/api/telegram/webhook`. Cloudflare Flexible. Health: `{"service":"sellshell"}`. Webhook’u `scripts/set-webhook.sh` ile kur (token’ı sohbete yapıştırma).

## Akış

1. Alıcı **Bakiye yükle** — tutar + supershell cüzdanı. Order `kind=topup` `pending`.
2. Watcher eşleşince `awaiting_admin` — bakiye **yazılmaz**. Yöneticiye `/paid ord_...` gider.
3. Yönetici `/paid` → `paid` + `balanceUsdt` artar. Red: `/expire`.
4. Alıcı Domainler / Satışa hazır listeden **bakiyeden satın al** — listing `sold`, stoktan düşer, order hemen `paid`. Satışa hazır listede durmaz.
5. Yönetici `/teslim ord_... kullanıcı şifre panel` — metin alıcıya iletilir, `deliveredAt` işaretlenir. Şifre diske yazılmaz.

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
| `/orders/<id>` | Durum + local mock / yönetici onayı / teslimat |

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

# local yönetici onayı (prod’da bot /paid):
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
| `TELEGRAM_ADMIN_ID` | Yönetici Telegram `user.id`. `/paid` `/expire` `/teslim` |
| `MINI_APP_URL` | Mini App + menü. Hedef: `https://supershell.click` (trailing slash yok) |
| `CRYPTO_WALLET_ADDRESS` | TRC-20 USDT cüzdan. Yoksa checkout uyarır; mock yine çalışır |
| `CRYPTO_ASSET` / `CRYPTO_NETWORK` | Varsayılan `USDT` / `TRC-20` |
| `CRYPTO_WATCH_WINDOW_MIN` | Varsayılan `120` |
| `TRONGRID_API_KEY` | İsteğe. Yoksa public TronGrid (rate limit) |
| `WATCHER_MOCK` | Local `1`. VPS’te `0` |
| `DEV_BYPASS_TELEGRAM` | Local `1`. VPS’te `0` |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Admin panel `/admin`. Şifre yoksa panel kapalı |

## Admin panel

`https://supershell.click/admin` — kullanıcı + şifre. İlan ekle / sil.

Teslim yöntemi (ilan eklerken birini seç):

- **cPanel** — kullanıcı + şifre (+ panel adresi)
- **WordPress** — kullanıcı + şifre (+ wp-admin)
- **Tek link** — tek URL

Satın alma bakiyeden `paid` olunca bu bilgiler alıcıya Telegram’dan otomatik gider. Şifreler `data/credentials.json` içinde, katalog API’sine çıkmaz. `/teslim` yedek kalır.

## Telegram

Hedef host: **supershell.click**.

1. BotFather’da bot + Menu Button / Web App URL = `https://supershell.click`
2. Mini App allowlist = `supershell.click`
3. Webhook — token’ı sohbete veya `curl` satırına yazma. Site `{"service":"sellshell"}` dönüyorsa sunucuda:

```bash
curl -fsSL https://raw.githubusercontent.com/gulyazani/genesis/main/webhook.sh -o /tmp/webhook.sh
sh /tmp/webhook.sh
```

Script `.env` içindeki `BOT_TOKEN`’ı okur, ekrana yazmaz. `ok true` görmelisin. Token boşsa Telegram 404 verir — o yüzden `${BOT_TOKEN}` ile elle curl atma.

`/start` klavye ve slash komutlar Mini App açmadan da çalışır. Telegram menüsünde listelenir:

- `/domainler` — açık domainler
- `/liste` — satışa hazır
- `/siparisler` — siparişlerim
- `/bakiye` — bakiye
- `/yukle 50` — yükleme başlat (USDT TRC-20)
- `/al ilan-id` — bakiyeden satın al
- `/yardim` — komut listesi

Yönetici (yalnızca `TELEGRAM_ADMIN_ID`):

- `/paid <sipariş-id>` — görülen top-up’ı bakiyeye yaz
- `/expire <sipariş-id>` — yüklemeyi iptal
- `/teslim <sipariş-id> kullanıcı şifre panel` — giriş bilgilerini alıcıya ilet (diske yazılmaz)
- `/help` — kısa hatırlatma

## Nasıl çalışır (cPanel değil)

cPanel’de site = klasörü `public_html`’e at, Apache HTML/PHP okusun. **sellshell öyle değil.**

Bu bir **program**. VPS’te sürekli açık kalır (Docker). Telegram veya tarayıcı `https://supershell.click` deyince Cloudflare istekleri o programa iletir; program sayfayı o an üretir, bakiyeyi yazar, bot mesajı atar. Klasörü panele kopyalamak programı **açmaz** — o yüzden `defaultwebpage.cgi` duruyor.

| Parça | Ne işe yarar |
| --- | --- |
| Kod (`app/`, `lib/`, …) | Programın kendisi. Git ile sunucuya çekilir. |
| Docker | Programı çalıştırır (mini app + bot + izleyici). |
| Cloudflare | `supershell.click` kilidini tutar (HTTPS). VPS’te SSL yok. |
| `.env` | Gizli ayar kağıdı: bot token, senin Telegram ID, cüzdan. **Sadece sunucuda.** Git’e / cPanel’e / sohbete koyma. |

`.env` = environment (ortam değişkenleri). Program açılınca bu dosyayı okur: “botum bu, cüzdan bu.” `.env.example` boş şablondur; gerçeğini sen sunucuda `nano .env` ile doldurursun. Bilgisayarındaki `.env.local` da aynı şey, local demo için.

## Sırada — başka siteler duruyor (Apache’yi kapatma)

Aynı sunucuda diğer cPanel siteleri **açık kalsın**. Apache’yi / 80’i durdurma. sellshell 80’i çalmaz; sadece `supershell.click` ona yönlenir.

1. SSH.
2. Kodu `~/sellshell` gibi bir yere çek (`public_html` değil).
3. `.env` doldur, `docker compose up -d --build` — program `127.0.0.1:43127` dinler, dışarı açılmaz.
4. **Yalnızca** `supershell.click` için Apache proxy: `deploy/apache-supershell.conf` → `httpd` reload. Diğer domain vhost’larına dokunma.
5. Cloudflare SSL **Flexible**.
6. `https://supershell.click/api/health` → `sellshell`. Öbür sitelerin URL’leri aynı kalır.

```bash
cd ~
git clone -b cursor/faz1-mini-app-6faf https://github.com/gulyazani/genesis.git sellshell
cd sellshell
cp .env.example .env
nano .env   # token, admin id, cüzdan, MINI_APP_URL, WATCHER_MOCK=0, DEV_BYPASS_TELEGRAM=0
docker compose up -d --build

# proxy: Ubuntu/Alma yollarından hangisi varsa
sudo cp deploy/apache-supershell.conf /etc/httpd/conf.d/supershell.conf
# yoksa: sudo cp deploy/apache-supershell.conf /etc/apache2/conf.d/supershell.conf
sudo apachectl configtest && sudo systemctl reload httpd
```

Kanıt:

```bash
curl -s http://127.0.0.1:43127/api/health
curl -s -H 'Host: supershell.click' http://127.0.0.1/api/health
curl -s https://supershell.click/api/health
```

`proxy` / `proxy_http` kapalıysa WHM → EasyApache’de aç. `configtest` kızarsa söyle, kırmadan düzeltiriz.

## Veri

- `data/listings.json` — supershell ilanları (şifre / panel yok)
- `data/orders.json` — alış + top-up (`awaiting_admin`, `deliveredAt`)
- `data/users.json` — `telegramUserId` → `balanceUsdt`

Admin CRUD UI ve SQL Faz 2. Registrar otomasyonu yok.
