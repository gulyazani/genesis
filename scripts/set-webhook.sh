#!/bin/sh
# Sunucuda: cd ~/sellshell && sh scripts/set-webhook.sh
# Token'ı ekrana yazmaz. .env içinden okur.

set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Yok: .env  — önce cp .env.example .env ve BOT_TOKEN doldur."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import json
import urllib.error
import urllib.parse
import urllib.request

env = {}
for raw in Path(".env").read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    env[key.strip()] = value.strip().strip('"').strip("'")

token = env.get("BOT_TOKEN", "")
if len(token) < 20 or ":" not in token:
    raise SystemExit("BOT_TOKEN .env icinde yok, kisa veya ':' eksik. nano .env ile duzelt.")

body = urllib.parse.urlencode(
    {"url": "https://supershell.click/api/telegram/webhook"}
).encode()
req = urllib.request.Request(
    f"https://api.telegram.org/bot{token}/setWebhook",
    data=body,
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode())
except urllib.error.HTTPError as err:
    data = json.loads(err.read().decode())

print("ok", data.get("ok"))
print("desc", data.get("description", data.get("result", "")))
if not data.get("ok"):
    raise SystemExit(1)
PY
