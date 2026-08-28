import { Hono } from "hono";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { parseInitDataUser } from "../telegram/validate.js";
import { ProductStatus, OrderStatus } from "@prisma/client";

export const orderRoutes = new Hono();

function getTelegramUser(c: { req: { header: (n: string) => string | undefined } }) {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  return parseInitDataUser(initData);
}

orderRoutes.post("/", async (c) => {
  const user = getTelegramUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{ productIds: string[] }>();
  if (!body.productIds?.length) return c.json({ error: "empty_cart" }, 400);

  const products = await prisma.product.findMany({
    where: {
      id: { in: body.productIds },
      status: ProductStatus.AVAILABLE,
    },
  });

  if (products.length !== body.productIds.length) {
    return c.json({ error: "some_unavailable" }, 400);
  }

  const totalRub = products.reduce((s, p) => s + p.priceRub, 0);
  const reserveUntil = new Date(Date.now() + 60 * 60 * 1000);

  const order = await prisma.$transaction(async (tx) => {
    for (const p of products) {
      await tx.product.update({
        where: { id: p.id },
        data: { status: ProductStatus.RESERVED, reservedUntil: reserveUntil },
      });
    }

    return tx.order.create({
      data: {
        telegramUserId: String(user.id),
        telegramUsername: user.username,
        status: OrderStatus.AWAITING_PAYMENT,
        totalRub,
        items: {
          create: products.map((p) => ({
            productId: p.id,
            priceRub: p.priceRub,
          })),
        },
      },
      include: { items: { include: { product: { include: { barcode: true } } } } },
    });
  });

  return c.json({
    order: {
      id: order.id,
      totalRub: order.totalRub,
      status: order.status,
      items: order.items.map((i) => ({
        title: i.product.title,
        priceRub: i.priceRub,
        code: i.product.barcode?.code,
      })),
    },
    paymentInfo: env.PAYMENT_CARD_INFO.replace("№", `#${order.id.slice(-6).toUpperCase()}`),
  });
});

orderRoutes.get("/my", async (c) => {
  const user = getTelegramUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const orders = await prisma.order.findMany({
    where: { telegramUserId: String(user.id) },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return c.json({ items: orders });
});
