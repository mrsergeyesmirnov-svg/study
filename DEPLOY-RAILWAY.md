# Railway — два сервиса, не путать!

## study (API + бот)

| Настройка | Значение |
|-----------|----------|
| Dockerfile Path | `Dockerfile` |
| **Start Command** | **ПУСТО** (удали всё!) |
| Variables | DATABASE_URL, BOT_TOKEN, … |

Стартует сам через `docker-entrypoint.sh` → `@vtgshmot/api`

---

## web (Mini App)

| Настройка | Значение |
|-----------|----------|
| Dockerfile Path | **`Dockerfile.web`** |
| **Start Command** | **ПУСТО** (удали `npm run start:railway -w @vtgshmot/api`!) |
| Variables | только `VITE_API_URL=https://api-домен.up.railway.app` |

**НЕ нужны:** DATABASE_URL, BOT_TOKEN, CHANNEL_*

Стартует: `serve dist` — без Prisma, без api.

---

## Если web падает с prisma / DATABASE_URL

→ В **web** сервисе всё ещё прописан Start Command от API.  
Settings → Deploy → **очисти Start Command** → Save → Redeploy.

## Проверка логов web (успех)

```
serve dist -s -l ...
```

## Проверка логов study (успех)

```
Starting API + Telegram bot
Telegram bot started
```
