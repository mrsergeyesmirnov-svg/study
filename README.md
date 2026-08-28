# VTGSHMOT Platform

Telegram-магазин винтажа с нуля: бот, Mini App, QR-бирки, админка, автопост в каналы.

## Документация

- [Запуск и настройка](SETUP.md)
- [Исследование и архитектура](docs/VTGSHMOT-study.md)

## Стек

- **API:** Hono + Prisma + grammY
- **Web:** React + Vite + Telegram WebApp SDK
- **DB:** SQLite (dev) / PostgreSQL (prod)

## Структура

```
apps/api/   — backend, бот, API
apps/web/   — Mini App + публичные страницы /i/:code
```
