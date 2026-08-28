import { Hono } from "hono";
import { prisma } from "../db.js";
import { isAdmin } from "../env.js";
import { parseInitDataUser } from "../telegram/validate.js";
import { BarcodeStatus, ProductStatus, SoldChannel } from "@prisma/client";
import type { Bot } from "grammy";
import { publishProductToChannels, markSoldInChannels } from "../telegram/channels.js";

function requireAdmin(c: { req: { header: (n: string) => string | undefined } }) {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const user = parseInitDataUser(initData);
  if (!user || !isAdmin(user.id)) {
    return { error: "forbidden" as const, user: null };
  }
  return { error: null, user };
}

export function adminRoutes(bot: Bot) {
  const app = new Hono();

  app.get("/me", (c) => {
    const initData = c.req.header("X-Telegram-Init-Data") ?? "";
    const user = parseInitDataUser(initData);
    if (!user) return c.json({ authenticated: false, admin: false });
    return c.json({ authenticated: true, admin: isAdmin(user.id), user });
  });

  app.get("/scan/:code", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const code = c.req.param("code").toUpperCase();
    const barcode = await prisma.barcode.findUnique({
      where: { code },
      include: { product: { include: { images: true } } },
    });

    if (!barcode) {
      return c.json({
        code,
        found: false,
        action: "unknown_code",
      });
    }

    if (barcode.status === BarcodeStatus.POOL || !barcode.product) {
      return c.json({
        code,
        found: true,
        status: barcode.status,
        action: "create_product",
        product: null,
      });
    }

    if (barcode.status === BarcodeStatus.SOLD || barcode.product.status === ProductStatus.SOLD) {
      return c.json({
        code,
        found: true,
        status: barcode.status,
        action: "already_sold",
        product: barcode.product,
      });
    }

    return c.json({
      code,
      found: true,
      status: barcode.status,
      action: "mark_sold",
      product: barcode.product,
    });
  });

  app.post("/barcodes/generate", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const body = await c.req.json<{ count?: number; batchId?: string }>();
    const count = Math.min(Math.max(body.count ?? 100, 1), 1000);
    const batchId = body.batchId ?? `batch-${Date.now()}`;

    const last = await prisma.barcode.findFirst({
      orderBy: { code: "desc" },
      where: { code: { startsWith: "VTG-" } },
    });

    let startNum = 1;
    if (last) {
      const m = last.code.match(/VTG-(\d+)/);
      if (m) startNum = parseInt(m[1], 10) + 1;
    }

    const created = [];
    for (let i = 0; i < count; i++) {
      const num = startNum + i;
      const code = `VTG-${String(num).padStart(6, "0")}`;
      const row = await prisma.barcode.create({
        data: { code, batchId, status: BarcodeStatus.POOL },
      });
      created.push(row);
    }

    return c.json({ batchId, count: created.length, codes: created.map((b) => b.code) });
  });

  app.get("/barcodes", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const status = c.req.query("status");
    const barcodes = await prisma.barcode.findMany({
      where: status ? { status: status as BarcodeStatus } : undefined,
      include: { product: { select: { id: true, title: true, status: true } } },
      orderBy: { code: "desc" },
      take: 200,
    });

    return c.json({ items: barcodes });
  });

  app.post("/products", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const body = await c.req.json<{
      code: string;
      title: string;
      priceRub: number;
      brand?: string;
      size?: string;
      conditionText?: string;
      measurements?: string;
      story?: string;
      description?: string;
      costRub?: number;
      imageUrls?: string[];
      publish?: boolean;
    }>();

    const code = body.code.toUpperCase();
    const barcode = await prisma.barcode.findUnique({ where: { code } });
    if (!barcode) return c.json({ error: "barcode_not_found" }, 404);
    if (barcode.status === BarcodeStatus.SOLD) {
      return c.json({ error: "barcode_sold" }, 400);
    }
    if (barcode.productId && barcode.status === BarcodeStatus.ASSIGNED) {
      return c.json({ error: "barcode_already_assigned" }, 400);
    }

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          title: body.title,
          priceRub: body.priceRub,
          brand: body.brand,
          size: body.size,
          conditionText: body.conditionText,
          measurements: body.measurements,
          story: body.story,
          description: body.description,
          costRub: body.costRub,
          status: body.publish ? ProductStatus.AVAILABLE : ProductStatus.DRAFT,
          images: {
            create: (body.imageUrls ?? []).map((url, i) => ({
              url,
              sortOrder: i,
            })),
          },
        },
        include: { images: true },
      });

      await tx.barcode.update({
        where: { code },
        data: {
          productId: p.id,
          status: BarcodeStatus.ASSIGNED,
          assignedAt: new Date(),
        },
      });

      return p;
    });

    let channelIds: { mainId?: string; stockId?: string } = {};
    if (body.publish && product.images.length > 0) {
      channelIds = await publishProductToChannels(bot, product, code);
      await prisma.product.update({
        where: { id: product.id },
        data: {
          channelMainId: channelIds.mainId ?? null,
          channelStockId: channelIds.stockId ?? null,
        },
      });
    }

    return c.json({ product, code, published: !!body.publish, channelIds });
  });

  app.post("/products/:id/sold", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const productId = c.req.param("id");
    const body = await c.req.json<{ channel?: SoldChannel }>().catch(() => ({}) as { channel?: SoldChannel });

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { barcode: true, images: true },
    });
    if (!product) return c.json({ error: "not_found" }, 404);

    const code = product.barcode?.code;
    if (!code) return c.json({ error: "no_barcode" }, 400);

    await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: {
          status: ProductStatus.SOLD,
          soldChannel: body.channel ?? SoldChannel.OFFLINE,
          soldAt: new Date(),
        },
      }),
      prisma.barcode.update({
        where: { code },
        data: { status: BarcodeStatus.SOLD, soldAt: new Date() },
      }),
    ]);

    await markSoldInChannels(bot, product, code);

    return c.json({ ok: true, code });
  });

  app.post("/scan/:code/sold", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const code = c.req.param("code").toUpperCase();
    const barcode = await prisma.barcode.findUnique({
      where: { code },
      include: { product: true },
    });

    if (!barcode?.product) {
      return c.json({ error: "no_product" }, 404);
    }

    const productId = barcode.product.id;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { barcode: true, images: true },
    });
    if (!product) return c.json({ error: "not_found" }, 404);

    await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: {
          status: ProductStatus.SOLD,
          soldChannel: SoldChannel.OFFLINE,
          soldAt: new Date(),
        },
      }),
      prisma.barcode.update({
        where: { code },
        data: { status: BarcodeStatus.SOLD, soldAt: new Date() },
      }),
    ]);

    await markSoldInChannels(bot, product, code);
    return c.json({ ok: true, code });
  });

  app.get("/products", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const products = await prisma.product.findMany({
      include: { images: true, barcode: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return c.json({ items: products });
  });

  app.get("/orders", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const orders = await prisma.order.findMany({
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return c.json({ items: orders });
  });

  app.post("/orders/:id/paid", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const orderId = c.req.param("id");
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { include: { barcode: true } } } } },
    });
    if (!order) return c.json({ error: "not_found" }, 404);

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "PAID" },
    });

    for (const item of order.items) {
      if (item.product.barcode?.code) {
        await prisma.product.update({
          where: { id: item.product.id },
          data: {
            status: ProductStatus.SOLD,
            soldChannel: SoldChannel.TELEGRAM,
            soldAt: new Date(),
          },
        });
        await prisma.barcode.update({
          where: { code: item.product.barcode.code },
          data: { status: BarcodeStatus.SOLD, soldAt: new Date() },
        });
        await markSoldInChannels(bot, item.product, item.product.barcode.code);
      }
    }

    return c.json({ ok: true });
  });

  return app;
}
