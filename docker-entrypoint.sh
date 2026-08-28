#!/bin/sh
set -e

if [ "$RAILWAY_SERVICE_NAME" = "web" ]; then
  echo "Starting WEB (Mini App) on port ${PORT:-8080}"
  exec serve /app/apps/web/dist -s -l "${PORT:-8080}"
fi

echo "Starting API + Telegram bot on port ${PORT:-3001}"
exec npm run start:railway -w @vtgshmot/api
