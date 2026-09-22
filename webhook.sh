#!/bin/sh
# Sunucuda (her yerden):
#   curl -fsSL https://raw.githubusercontent.com/gulyazani/genesis/main/webhook.sh -o /tmp/webhook.sh
#   sh /tmp/webhook.sh
# Token'ı ekrana yazmaz. .env içinden okur.

set -e

find_app() {
  for d in \
    "$(pwd)" \
    "$(CDPATH= cd -- "$(dirname "$0")" && pwd)" \
    "$HOME/sellshell" \
    /root/sellshell \
    "$HOME/genesis" \
    /root/genesis \
    /root/supershell \
    "$HOME/supershell"
  do
    [ -n "$d" ] || continue
    if [ -f "$d/.env" ]; then
      printf '%s\n' "$d"
      return 0
    fi
  done

  found=$(find "$HOME" /root /opt -maxdepth 4 -type f -name .env 2>/dev/null | while read -r f; do
    dir=$(dirname "$f")
    if [ -f "$dir/docker-compose.yml" ] || [ -f "$dir/package.json" ]; then
      printf '%s\n' "$dir"
      break
    fi
  done)
  if [ -n "$found" ]; then
    printf '%s\n' "$found"
    return 0
  fi
  return 1
}

APP=$(find_app) || {
  echo "sellshell klasoru / .env bulunamadi."
  echo "pwd: $(pwd)"
  echo "ls ~:"
  ls "$HOME" || true
  exit 1
}

cd "$APP"
echo "klasor $APP"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 yok. Sunucuda: apt install -y python3"
  exit 1
fi

if command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
  docker compose up -d >/dev/null 2>&1 || docker-compose up -d >/dev/null 2>&1 || true
fi

python3 - <<'PY'
from pathlib import Path
import json
import urllib.error
import urllib.parse
import urllib.request

WEBHOOK = "https://supershell.click/api/telegram/webhook"

def parse_env(path):
    env = {}
    text = path.read_text(encoding="utf-8-sig")
    for raw in text.splitlines():
        line = raw.strip().replace("\r", "")
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key.startswith("export "):
            key = key[7:].strip()
        value = value.strip().strip('"').strip("'")
        if " #" in value:
            value = value.split(" #", 1)[0].strip()
        env[key] = value
    return env

env = parse_env(Path(".env"))
token = env.get("BOT_TOKEN", "")
if len(token) < 20 or ":" not in token:
    raise SystemExit(
        "BOT_TOKEN .env icinde yok, kisa veya ':' eksik.\n"
        "nano .env — BotFather tokeni, GitHub tokeni degil. Ornek: 123456789:AA...."
    )

def telegram(method, data=None):
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=urllib.parse.urlencode(data).encode() if data else None,
        method="POST" if data else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as err:
        raw = err.read().decode()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"ok": False, "description": f"HTTP {err.code}"}

me = telegram("getMe")
if not me.get("ok"):
    desc = str(me.get("description", "Unauthorized"))
    raise SystemExit(
        f"Telegram tokeni reddetti: {desc}\n"
        "BotFather'daki tokeni nano .env BOT_TOKEN= satırına yapıştır. "
        "Sohbete / GitHub'a koyma."
    )

data = telegram("setWebhook", {"url": WEBHOOK})
print("ok", data.get("ok"))
print("bot", (me.get("result") or {}).get("username", ""))
print("desc", data.get("description", data.get("result", "")))
if not data.get("ok"):
    raise SystemExit(1)

info = telegram("getWebhookInfo")
result = info.get("result") or {}
print("url", result.get("url", ""))
print("pending", result.get("pending_update_count", 0))
if result.get("last_error_message"):
    print("last_error", result.get("last_error_message"))
PY
