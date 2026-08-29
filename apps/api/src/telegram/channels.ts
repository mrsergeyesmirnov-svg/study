import { Bot } from "grammy";
import { env, publicItemUrl } from "../env.js";
import type { Product, ProductImage } from "@prisma/client";

type ProductWithImages = Product & { images: ProductImage[] };

function formatPost(product: ProductWithImages, code: string): string {
  const lines = [
    `<b>${escapeHtml(product.title)}</b>`,
    "",
    `<blockquote>`,
    product.conditionText ? `состояние ${escapeHtml(product.conditionText)}` : null,
    product.size ? `размер ${escapeHtml(product.size)}` : null,
    `цена: ${product.priceRub}`,
    `</blockquote>`,
    "",
    `<a href="${publicItemUrl(code)}">Оформить заказ</a> · <a href="${env.WEBAPP_URL}">Полное наличие</a>`,
  ].filter(Boolean);

  return lines.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function publishProductToChannels(
  bot: Bot,
  product: ProductWithImages,
  code: string,
  opts: { main?: boolean; stock?: boolean } = {},
): Promise<{ mainId?: string; stockId?: string }> {
  const postMain = opts.main !== false;
  const postStock = opts.stock !== false;
  const caption = formatPost(product, code);
  const photo = product.images[0]?.url;
  const result: { mainId?: string; stockId?: string } = {};

  if (postMain && env.CHANNEL_MAIN_ID && photo) {
    const msg = await bot.api.sendPhoto(env.CHANNEL_MAIN_ID, photo, {
      caption,
      parse_mode: "HTML",
    });
    result.mainId = String(msg.message_id);
  }

  if (postStock && env.CHANNEL_STOCK_ID && photo) {
    const msg = await bot.api.sendPhoto(env.CHANNEL_STOCK_ID, photo, {
      caption,
      parse_mode: "HTML",
    });
    result.stockId = String(msg.message_id);
  }

  return result;
}

/** After linking a barcode to a channel-imported post, patch caption with order link. */
export async function patchChannelCaptionWithLink(
  bot: Bot,
  product: ProductWithImages,
  code: string,
): Promise<void> {
  if (!env.CHANNEL_MAIN_ID || !product.channelMainId) return;
  const caption = formatPost(product, code);
  try {
    await bot.api.editMessageCaption(env.CHANNEL_MAIN_ID, Number(product.channelMainId), {
      caption,
      parse_mode: "HTML",
    });
  } catch {
    /* caption may be too long or message without photo */
  }
}

export async function markSoldInChannels(
  bot: Bot,
  product: Product,
  code: string,
): Promise<void> {
  const soldText = `❌ <b>ПРОДАНО</b>\n${escapeHtml(product.title)}\n${publicItemUrl(code)}`;

  if (env.CHANNEL_MAIN_ID && product.channelMainId) {
    try {
      await bot.api.editMessageCaption(env.CHANNEL_MAIN_ID, Number(product.channelMainId), {
        caption: soldText,
        parse_mode: "HTML",
      });
    } catch {
      /* message may be too old or deleted */
    }
  }

  if (env.CHANNEL_STOCK_ID && product.channelStockId) {
    try {
      await bot.api.deleteMessage(env.CHANNEL_STOCK_ID, Number(product.channelStockId));
    } catch {
      /* ignore */
    }
  }
}
