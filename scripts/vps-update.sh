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

# .env ve senin compose portun kalsın; kod GitHub main olsun.
cp -a docker-compose.yml /tmp/ss-compose.bak
cp -a .env /tmp/ss-env.bak 2>/dev/null || true

git fetch https://github.com/gulyazani/genesis.git main
git reset --hard FETCH_HEAD

if [ -f /tmp/ss-compose.bak ]; then
  cp /tmp/ss-compose.bak docker-compose.yml
fi
if [ -f /tmp/ss-env.bak ]; then
  cp /tmp/ss-env.bak .env
fi

if [ ! -d app/admin ]; then
  echo "HATA: app/admin yok. git reset calismadi."
  exit 1
fi

echo "kod:"
git log -1 --oneline

docker compose build --no-cache
docker compose up -d --force-recreate

echo "yerel health:"
curl -sS http://127.0.0.1:43127/api/health || true
echo
echo "yerel admin:"
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:43127/admin/login || true
echo "bitti. Ac: https://supershell.click/admin"
echo "health icinde release=ss-admin-1 olmali."
