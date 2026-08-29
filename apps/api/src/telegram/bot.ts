import { Bot } from "grammy";
import { env, publicItemUrl } from "../env.js";
import { registerChannelImport } from "./channelImport.js";

export function createBot(): Bot {
  const bot = new Bot(env.BOT_TOKEN);

  bot.command("start", async (ctx) => {
    await ctx.reply(
      "VTGSHMOT — каталог винтажа\n\n" +
        "🛍 Каталог — кнопка ниже\n" +
        "⚙️ Админка — кнопка «Админка» или команда /admin",
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

  bot.command("admin", async (ctx) => {
    await ctx.reply("Админка VTGSHMOT", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⚙️ Открыть админку", web_app: { url: `${env.WEBAPP_URL}/admin` } }],
        ],
      },
    });
  });

  bot.command("item", async (ctx) => {
    const code = ctx.match?.trim();
    if (!code) {
      await ctx.reply("Использование: /item VTG-000001");
      return;
    }
    await ctx.reply(`Карточка вещи:\n${publicItemUrl(code)}`);
  });

  registerChannelImport(bot);

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
