import { Bot } from "grammy";
import { env, publicItemUrl } from "../env.js";

export function createBot(): Bot {
  const bot = new Bot(env.BOT_TOKEN);

  bot.command("start", async (ctx) => {
    await ctx.reply(
      "VTGSHMOT — каталог винтажа\n\n" +
        "🛍 Открыть магазин — кнопка «Каталог» ниже\n" +
        "📦 Админам — «Админка»",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛍 Каталог", web_app: { url: env.WEBAPP_URL } }],
            [{ text: "⚙️ Админка", web_app: { url: `${env.WEBAPP_URL}/admin` } }],
          ],
        },
      },
    );
  });

  bot.command("item", async (ctx) => {
    const code = ctx.match?.trim();
    if (!code) {
      await ctx.reply("Использование: /item VTG-000001");
      return;
    }
    await ctx.reply(`Карточка вещи:\n${publicItemUrl(code)}`);
  });

  return bot;
}

export async function setupBotMenu(bot: Bot): Promise<void> {
  await bot.api.setChatMenuButton({
    menu_button: {
      type: "web_app",
      text: "Каталог",
      web_app: { url: env.WEBAPP_URL },
    },
  });
}
