import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";
import { createBot, setupBotMenu } from "./telegram/bot.js";
import { publicRoutes } from "./routes/public.js";
import { adminRoutes } from "./routes/admin.js";
import { orderRoutes } from "./routes/orders.js";
import { uploadRoutes } from "./routes/upload.js";
import { mediaRoutes } from "./routes/media.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    allowHeaders: ["Content-Type", "X-Telegram-Init-Data"],
  }),
);

app.get("/api/health", (c) => c.json({ ok: true, service: "vtgshmot-api" }));

app.route("/api/public", publicRoutes);
app.route("/api/orders", orderRoutes);
app.route("/api/upload", uploadRoutes);
app.route("/api/media", mediaRoutes);

const bot = createBot();
app.route("/api/admin", adminRoutes(bot));

app.use("/uploads/*", serveStatic({ root: "./" }));

const port = env.PORT;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API http://localhost:${info.port}`);
});

if (env.BOT_TOKEN.includes("REPLACE") || env.BOT_TOKEN.includes("TEST_TOKEN")) {
  console.warn("BOT_TOKEN placeholder — API only, bot not started");
} else {
  bot
    .start({
      onStart: async () => {
        console.log("Telegram bot started");
        try {
          await setupBotMenu(bot);
        } catch (e) {
          console.warn("Menu button setup skipped:", e);
        }
      },
    })
    .catch((e) => console.error("Bot failed to start:", e.message));

  process.on("SIGINT", () => bot.stop());
  process.on("SIGTERM", () => bot.stop());
}
