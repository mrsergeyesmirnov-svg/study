import type { Bot, Context } from "grammy";
import { ProductSource, ProductStatus } from "@prisma/client";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { parseChannelPost } from "./parseChannelPost.js";
import { downloadTelegramFile, largestPhotoFileId } from "./downloadFile.js";

function importChatIds(): Set<string> {
  const ids = [env.CHANNEL_IMPORT_ID, env.CHANNEL_MAIN_ID].filter(Boolean) as string[];
  return new Set(ids.map(normalizeChatId));
}

function normalizeChatId(id: string): string {
  // Accept @username or numeric -100...
  return id.trim();
}

function chatMatches(ctxChat: { id: number; username?: string }, allowed: Set<string>): boolean {
  if (allowed.size === 0) return false;
  const idStr = String(ctxChat.id);
  const uname = ctxChat.username ? `@${ctxChat.username}` : "";
  for (const a of allowed) {
    if (a === idStr || a === uname || (uname && a.replace(/^@/, "") === ctxChat.username)) {
      return true;
    }
  }
  return false;
}

export function registerChannelImport(bot: Bot): void {
  bot.on("channel_post", (ctx) => void handleChannelPost(bot, ctx));
  bot.on("edited_channel_post", (ctx) => void handleChannelPost(bot, ctx, true));
}

async function handleChannelPost(bot: Bot, ctx: Context, isEdit = false): Promise<void> {
  const msg = ctx.channelPost ?? ctx.editedChannelPost;
  if (!msg || !ctx.chat) return;

  const allowed = importChatIds();
  if (!chatMatches(ctx.chat, allowed)) return;

  const chatId = String(ctx.chat.id);
  const messageId = String(msg.message_id);
  const mediaGroupId = msg.media_group_id ?? null;

  // Media-group follow-up: only photo, no caption — append image to existing draft.
  if (mediaGroupId && !msg.caption && !msg.text && msg.photo) {
    await appendMediaGroupPhoto(bot, chatId, mediaGroupId, msg.photo);
    return;
  }

  const caption = msg.caption ?? msg.text ?? "";
  const parsed = parseChannelPost(caption);
  if (!parsed) return;

  const fileId = msg.photo ? largestPhotoFileId(msg.photo) : null;
  const imageUrl = fileId ? await downloadTelegramFile(bot, fileId) : null;

  const existing = await prisma.product.findUnique({
    where: {
      sourceChatId_sourceMessageId: { sourceChatId: chatId, sourceMessageId: messageId },
    },
    include: { images: true, barcode: true },
  });

  if (existing) {
    if (existing.status !== ProductStatus.DRAFT || existing.barcode) {
      // Already linked / published — don't overwrite from channel edits.
      return;
    }
    if (isEdit) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          title: parsed.title,
          priceRub: parsed.priceRub,
          size: parsed.size,
          conditionText: parsed.conditionText,
          measurements: parsed.measurements,
          brand: parsed.brand,
          story: parsed.story,
        },
      });
    }
    return;
  }

  // Same media group already imported via another message with caption.
  if (mediaGroupId) {
    const groupHit = await prisma.product.findFirst({
      where: {
        sourceChatId: chatId,
        sourceMediaGroupId: mediaGroupId,
        source: ProductSource.CHANNEL_IMPORT,
      },
    });
    if (groupHit) {
      if (imageUrl) {
        const count = await prisma.productImage.count({ where: { productId: groupHit.id } });
        await prisma.productImage.create({
          data: { productId: groupHit.id, url: imageUrl, sortOrder: count },
        });
      }
      return;
    }
  }

  await prisma.product.create({
    data: {
      title: parsed.title,
      priceRub: parsed.priceRub,
      size: parsed.size,
      conditionText: parsed.conditionText,
      measurements: parsed.measurements,
      brand: parsed.brand,
      story: parsed.story,
      status: ProductStatus.DRAFT,
      source: ProductSource.CHANNEL_IMPORT,
      sourceChatId: chatId,
      sourceMessageId: messageId,
      sourceMediaGroupId: mediaGroupId,
      channelMainId: messageId,
      images: imageUrl
        ? { create: [{ url: imageUrl, sortOrder: 0 }] }
        : undefined,
    },
  });

  console.log(`Channel import draft: "${parsed.title}" (${chatId}/${messageId})`);
}

async function appendMediaGroupPhoto(
  bot: Bot,
  chatId: string,
  mediaGroupId: string,
  photos: { file_id: string; width: number; height: number }[],
): Promise<void> {
  const product = await prisma.product.findFirst({
    where: {
      sourceChatId: chatId,
      sourceMediaGroupId: mediaGroupId,
      source: ProductSource.CHANNEL_IMPORT,
      status: ProductStatus.DRAFT,
    },
  });
  if (!product) return;

  const fileId = largestPhotoFileId(photos);
  if (!fileId) return;
  const imageUrl = await downloadTelegramFile(bot, fileId);
  if (!imageUrl) return;

  const count = await prisma.productImage.count({ where: { productId: product.id } });
  await prisma.productImage.create({
    data: { productId: product.id, url: imageUrl, sortOrder: count },
  });
}
