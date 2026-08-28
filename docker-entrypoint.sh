#!/bin/sh
set -e

if [ "$SERVICE_ROLE" = "web" ]; then
  echo "Starting WEB (static Mini App) on port ${PORT:-8080}"
  exec npx serve apps/web/dist -s -l "${PORT:-8080}"
fi

echo "Starting API + Telegram bot on port ${PORT:-3001}"
exec npm run start:railway -w @vtgshmot/api
