#!/bin/sh
set -e

if [ "$RAILWAY_SERVICE_NAME" = "web" ]; then
  echo "Starting WEB (Mini App) on port ${PORT:-8080}"
  API_URL="${VITE_API_URL:-}"
  echo "window.__VTG_API__ = ${API_URL:+\"${API_URL}\"};" > /app/apps/web/dist/config.js
  echo "Wrote config.js API=${API_URL:-/api (relative)}"
  exec serve /app/apps/web/dist -s -l "${PORT:-8080}"
fi

echo "Starting API + Telegram bot on port ${PORT:-3001}"
echo "Prisma db push (accept-data-loss) then node..."
exec npm run start:railway -w @vtgshmot/api
