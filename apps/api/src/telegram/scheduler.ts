import type { Bot } from "grammy";
import { ProductStatus } from "@prisma/client";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { publishProductToChannels, patchChannelCaptionWithLink } from "./channels.js";

const INTERVAL_MS = 30_000;

/**
 * Publishes scheduled drafts that already have a barcode + at least one photo.
 * Channel-import drafts without barcode stay in inbox until admin scans a tag.
 */
export function startPublishScheduler(bot: Bot): void {
  const tick = async () => {
    try {
      await publishDueProducts(bot);
    } catch (e) {
      console.error("publish scheduler error:", e);
    }
  };

  void tick();
  setInterval(tick, INTERVAL_MS);
  console.log(`Publish scheduler started (every ${INTERVAL_MS / 1000}s)`);
}

export async function publishDueProducts(bot: Bot): Promise<number> {
  const now = new Date();
  const due = await prisma.product.findMany({
    where: {
      status: ProductStatus.DRAFT,
      publishAt: { lte: now },
      barcode: { isNot: null },
      images: { some: {} },
    },
    include: { images: true, barcode: true },
    take: 20,
  });

  let published = 0;
  for (const product of due) {
    const code = product.barcode?.code;
    if (!code) continue;

    try {
      const channelIds = await publishProductToChannels(bot, product, code);
      await prisma.product.update({
        where: { id: product.id },
        data: {
          status: ProductStatus.AVAILABLE,
          publishAt: null,
          channelMainId: channelIds.mainId ?? product.channelMainId,
          channelStockId: channelIds.stockId ?? product.channelStockId,
        },
      });
      published += 1;
      console.log(`Scheduled publish: ${code} — ${product.title}`);
    } catch (e) {
      console.error(`Failed scheduled publish ${product.id}:`, e);
    }
  }

  return published;
}

/** Immediate publish helper used by admin "publish now" / link+activate. */
export async function activateProduct(
  bot: Bot,
  productId: string,
  opts: { postToChannels?: boolean } = {},
): Promise<{ ok: boolean; error?: string; code?: string }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { images: true, barcode: true },
  });
  if (!product) return { ok: false, error: "not_found" };
  if (!product.barcode?.code) return { ok: false, error: "no_barcode" };
  if (product.status === ProductStatus.SOLD) return { ok: false, error: "sold" };

  const code = product.barcode.code;
  let channelIds: { mainId?: string; stockId?: string } = {
    mainId: product.channelMainId ?? undefined,
    stockId: product.channelStockId ?? undefined,
  };

  const isChannelImport = product.source === "CHANNEL_IMPORT" && product.channelMainId;

  if (opts.postToChannels !== false && product.images.length > 0) {
    if (isChannelImport) {
      await patchChannelCaptionWithLink(bot, product, code);
      if (env.CHANNEL_STOCK_ID && !product.channelStockId) {
        const stock = await publishProductToChannels(bot, product, code, {
          main: false,
          stock: true,
        });
        channelIds = {
          mainId: product.channelMainId ?? undefined,
          stockId: stock.stockId,
        };
      }
    } else {
      channelIds = await publishProductToChannels(bot, product, code);
    }
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      status: ProductStatus.AVAILABLE,
      publishAt: null,
      channelMainId: channelIds.mainId ?? product.channelMainId,
      channelStockId: channelIds.stockId ?? product.channelStockId,
    },
  });

  return { ok: true, code };
}
