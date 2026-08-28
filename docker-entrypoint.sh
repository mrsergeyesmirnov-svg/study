#!/bin/sh
set -e

echo "Starting API + Telegram bot on port ${PORT:-3001}"
exec npm run start:railway -w @vtgshmot/api
