import { Hono } from "hono";
import { prisma } from "../db.js";
import { isAdmin } from "../env.js";
import { parseInitDataUser } from "../telegram/validate.js";
import { BarcodeStatus, ProductSource, ProductStatus, SoldChannel } from "@prisma/client";
import type { Bot } from "grammy";
import { publishProductToChannels, markSoldInChannels } from "../telegram/channels.js";
import { activateProduct } from "../telegram/scheduler.js";

function requireAdmin(c: { req: { header: (n: string) => string | undefined } }) {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const user = parseInitDataUser(initData);
  if (!user || !isAdmin(user.id)) {
    return { error: "forbidden" as const, user: null };
  }
  return { error: null, user };
}

function serializeAdminProduct(p: {
  id: string;
  title: string;
  priceRub: number;
  status: ProductStatus;
  source: ProductSource;
  size: string | null;
  brand: string | null;
  conditionText: string | null;
  measurements: string | null;
  story: string | null;
  publishAt: Date | null;
  createdAt: Date;
  images: { url: string; sortOrder: number }[];
  barcode: { code: string } | null;
}) {
  return {
    id: p.id,
    title: p.title,
    priceRub: p.priceRub,
    status: p.status,
    source: p.source,
    size: p.size,
    brand: p.brand,
    conditionText: p.conditionText,
    measurements: p.measurements,
    story: p.story,
    publishAt: p.publishAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    images: p.images.sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.url),
    code: p.barcode?.code ?? null,
  };
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
    const limit = Math.min(parseInt(c.req.query("limit") ?? "200", 10), 500);
    const barcodes = await prisma.barcode.findMany({
      where: status ? { status: status as BarcodeStatus } : undefined,
      include: { product: { select: { id: true, title: true, status: true } } },
      orderBy: { code: "asc" },
      take: limit,
    });

    return c.json({ items: barcodes });
  });

  /** Inbox: channel posts waiting for barcode scan → catalog. */
  app.get("/inbox", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const items = await prisma.product.findMany({
      where: {
        status: ProductStatus.DRAFT,
        source: ProductSource.CHANNEL_IMPORT,
        barcode: null,
      },
      include: { images: true, barcode: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return c.json({ items: items.map(serializeAdminProduct) });
  });

  /** Scheduled drafts (have publishAt + usually barcode). */
  app.get("/scheduled", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const items = await prisma.product.findMany({
      where: {
        status: ProductStatus.DRAFT,
        publishAt: { not: null },
      },
      include: { images: true, barcode: true },
      orderBy: { publishAt: "asc" },
      take: 50,
    });

    return c.json({ items: items.map(serializeAdminProduct) });
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
      publishAt?: string | null;
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

    const publishAt = body.publishAt ? new Date(body.publishAt) : null;
    const scheduleLater = !!(publishAt && publishAt.getTime() > Date.now());
    const publishNow = !!body.publish && !scheduleLater;

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
          status: publishNow ? ProductStatus.AVAILABLE : ProductStatus.DRAFT,
          source: ProductSource.ADMIN,
          publishAt: scheduleLater ? publishAt : null,
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
    if (publishNow && product.images.length > 0) {
      channelIds = await publishProductToChannels(bot, product, code);
      await prisma.product.update({
        where: { id: product.id },
        data: {
          channelMainId: channelIds.mainId ?? null,
          channelStockId: channelIds.stockId ?? null,
        },
      });
    }

    return c.json({
      product,
      code,
      published: publishNow,
      scheduled: !!scheduleLater,
      publishAt: scheduleLater ? publishAt!.toISOString() : null,
      channelIds,
    });
  });

  /** Link free barcode to inbox draft → appear in catalog. */
  app.post("/products/:id/link-barcode", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const productId = c.req.param("id");
    const body = await c.req.json<{ code: string; activate?: boolean }>();
    const code = body.code.toUpperCase();

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { barcode: true, images: true },
    });
    if (!product) return c.json({ error: "not_found" }, 404);
    if (product.barcode) return c.json({ error: "already_has_barcode" }, 400);
    if (product.status === ProductStatus.SOLD) return c.json({ error: "sold" }, 400);

    const barcode = await prisma.barcode.findUnique({ where: { code } });
    if (!barcode) return c.json({ error: "barcode_not_found" }, 404);
    if (barcode.status !== BarcodeStatus.POOL || barcode.productId) {
      return c.json({ error: "barcode_not_free" }, 400);
    }

    await prisma.barcode.update({
      where: { code },
      data: {
        productId: product.id,
        status: BarcodeStatus.ASSIGNED,
        assignedAt: new Date(),
      },
    });

    const activate = body.activate !== false;
    if (activate) {
      const result = await activateProduct(bot, product.id);
      if (!result.ok) return c.json({ error: result.error }, 400);
      return c.json({ ok: true, code, activated: true });
    }

    return c.json({ ok: true, code, activated: false });
  });

  app.patch("/products/:id/schedule", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const productId = c.req.param("id");
    const body = await c.req.json<{ publishAt: string | null }>();
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { barcode: true },
    });
    if (!product) return c.json({ error: "not_found" }, 404);
    if (!product.barcode) return c.json({ error: "no_barcode" }, 400);
    if (product.status === ProductStatus.SOLD) return c.json({ error: "sold" }, 400);

    const publishAt = body.publishAt ? new Date(body.publishAt) : null;
    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        publishAt,
        status: ProductStatus.DRAFT,
      },
      include: { images: true, barcode: true },
    });

    return c.json({ product: serializeAdminProduct(updated) });
  });

  app.post("/products/:id/activate", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const productId = c.req.param("id");
    const body = await c.req.json<{ postToChannels?: boolean }>().catch(() => ({}));
    const result = await activateProduct(bot, productId, body);
    if (!result.ok) return c.json({ error: result.error }, 400);
    return c.json(result);
  });

  app.post("/products/:id/dismiss", async (c) => {
    const auth = requireAdmin(c);
    if (auth.error) return c.json({ error: auth.error }, 403);

    const productId = c.req.param("id");
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return c.json({ error: "not_found" }, 404);
    if (product.status !== ProductStatus.DRAFT) {
      return c.json({ error: "not_draft" }, 400);
    }

    await prisma.product.update({
      where: { id: productId },
      data: { status: ProductStatus.ARCHIVED, publishAt: null },
    });
    return c.json({ ok: true });
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

    const status = c.req.query("status");
    const products = await prisma.product.findMany({
      where: status ? { status: status as ProductStatus } : undefined,
      include: { images: true, barcode: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return c.json({ items: products.map(serializeAdminProduct) });
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
