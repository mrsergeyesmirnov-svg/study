# Railway — два сервиса, ОДИН Dockerfile

Dockerfile менять в UI **не нужно** — `railway.toml` задаёт один `Dockerfile` для обоих.
Railway сам передаёт `RAILWAY_SERVICE_NAME` → `web` или `study`.

## study (API)

| Настройка | Значение |
|-----------|----------|
| Dockerfile | `Dockerfile` (из railway.toml, не трогать) |
| **Start Command** | **ПУСТО** |
| Variables | DATABASE_URL, BOT_TOKEN, ADMIN_TELEGRAM_IDS, CHANNEL_MAIN_ID=@baobab6714, PUBLIC_URL=https://web-домен, WEBAPP_URL=https://web-домен, **API_PUBLIC_URL=https://study-домен** |

Фото хранятся в Postgres (`/api/media/:id`) — диск Railway эфемерный, без БД картинки пропадали после деплоя.

## web (Mini App)

| Настройка | Значение |
|-----------|----------|
| Dockerfile | тот же `Dockerfile` |
| **Start Command** | **ПУСТО** |
| Variables | только `VITE_API_URL=https://study-домен.up.railway.app` |

## После push

1. **Оба сервиса** → Settings → Deploy → **очисти Start Command**
2. Deploy → Apply / Redeploy **оба**

## Логи (успех)

- **web:** `Building WEB only` → `Starting WEB (Mini App)`
- **study:** `Building API only` → `Starting API + Telegram bot`

## Ошибка chmod / start command

Значит в UI всё ещё прописан Start Command — **удали его полностью**.
