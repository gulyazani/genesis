#!/bin/sh
# curl -fsSL https://raw.githubusercontent.com/gulyazani/genesis/main/scripts/vps-update.sh | sh
set -e

APP=""
for d in "$HOME/sellshell" /root/sellshell "$(pwd)"; do
  if [ -f "$d/docker-compose.yml" ]; then
    APP="$d"
    break
  fi
done
if [ -z "$APP" ]; then
  echo "sellshell bulunamadi. cd ~/sellshell sonra tekrar dene."
  exit 1
fi

cd "$APP"
echo "klasor $APP"

curl -fsSL https://raw.githubusercontent.com/gulyazani/genesis/main/lib/bot.ts -o lib/bot.ts
git pull --ff-only || true

docker compose build --no-cache
docker compose up -d --force-recreate
echo "bitti. Telegram'da /start"
