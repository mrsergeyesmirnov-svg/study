# VTGSHMOT Platform — запуск с нуля

Полный контур: бот + Mini App + админка + QR-страницы + автопост в каналы.

## Что уже есть в коде

- **Каталог** — Mini App (каталог, корзина, оформление заказа)
- **Админка** — скан кода, создание товара, «продано в магазине»
- **Бирки** — генерация серии `VTG-000001` …
- **Публичные страницы** — `/i/VTG-000001` для покупателей в шоуруме
- **Автопост** — в каналы (если указаны в `.env`)
- **Заказы** — резервация + текст для перевода на карту

## Быстрый старт

### 1. Установка

```bash
npm install
cp .env.example .env
# отредактируйте .env — см. ниже
```

### 2. База данных

```bash
cd apps/api
npx prisma db push
npm run db:seed   # 50 demo-бирок VTG-000001…
```

### 3. Запуск (два терминала)

```bash
# API + бот
npm run dev -w @vtgshmot/api

# Mini App
npm run dev -w @vtgshmot/web
```

- Каталог: http://localhost:5173  
- Админка: http://localhost:5173/admin  
- Публичная карточка: http://localhost:5173/i/VTG-000001  
- API: http://localhost:3001/api/health  

### 4. Настройка `.env`

| Переменная | Откуда взять |
|------------|--------------|
| `BOT_TOKEN` | BotFather → ваш новый бот |
| `ADMIN_TELEGRAM_IDS` | @userinfobot → ваш numeric id |
| `PUBLIC_URL` | HTTPS-домен (для prod) или ngrok для теста |
| `WEBAPP_URL` | тот же URL (Mini App) |
| `CHANNEL_MAIN_ID` | `@vtgshmot` или `-100...` |
| `CHANNEL_STOCK_ID` | `@nalichievtgshmot` |
| `PAYMENT_CARD_INFO` | текст для клиента после заказа |

### 5. BotFather

```
/setdescription — описание магазина
/setmenubutton — Web App → ваш WEBAPP_URL
/newapp или /myapps — привязать Mini App к боту
```

**Бот должен быть админом** в каналах с правом публиковать посты.

### 6. Прод (VPS или Railway)

**PostgreSQL** уже в `schema.prisma`. Локально — свой Postgres или Railway URL.

---

## Деплой на Railway

### Куда класть variables?

| Место | Что туда |
|-------|----------|
| **Сервис с кодом (GitHub repo)** | `BOT_TOKEN`, `ADMIN_TELEGRAM_IDS`, `PUBLIC_URL`, `WEBAPP_URL`, каналы, `PAYMENT_CARD_INFO` |
| **Сервис PostgreSQL** | Ничего вручную — Railway сам держит `DATABASE_URL`, `PGHOST`, … |
| **Связка** | В **сервисе repo** → Variable `DATABASE_URL` = **Reference** → `${{Postgres.DATABASE_URL}}` |
| **Git / файлы репо** | Секреты **не коммитить** |

**Не дублируй** `DATABASE_URL` в Postgres-сервисе для приложения — только **reference из app-сервиса**.

### Variables в сервисе с кодом (пример)

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
BOT_TOKEN=...
ADMIN_TELEGRAM_IDS=885695690
PUBLIC_URL=https://api-xxxx.up.railway.app
WEBAPP_URL=https://web-xxxx.up.railway.app
CHANNEL_MAIN_ID=@vtgshmot
CHANNEL_STOCK_ID=@nalichievtgshmot
PAYMENT_CARD_INFO=Перевод на карту • заказ №
```

`PORT` — Railway выставит сам.

### Шаги

1. Project → Deploy repo + Add **PostgreSQL**
2. Сервис **api** → Variables (таблица выше)
3. Settings → **Generate Domain**
4. Отдельно задеploy **web** (`apps/web`) или Vercel для Mini App
5. BotFather → Web App URL = `WEBAPP_URL` (HTTPS)

При старте api выполнится `prisma db push` (таблицы создадутся автоматически).

---

## Типичный флоу

1. Админка → «Сгенерировать 100 кодов»
2. Печать бирок (QR = `{PUBLIC_URL}/i/VTG-XXXXXX`)
3. Скан кода → «Новый товар» → фото, цена → опубликовать
4. Покупатель в зале сканирует → `/i/...` → «Купить в Telegram»
5. Продажа в зале → скан → «Продано»

## Что дальше (можно добавить)

- [ ] PDF с QR для печати бирок
- [ ] Планировщик серии постов
- [ ] ЮKassa / Telegram Payments
- [ ] Камера для скана QR в админке (html5-qrcode)
