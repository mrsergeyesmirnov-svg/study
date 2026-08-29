import { Hono } from "hono";
import { prisma } from "../db.js";
import { publicItemUrl } from "../env.js";
import { ProductStatus, BarcodeStatus } from "@prisma/client";

export const publicRoutes = new Hono();

function serializeProduct(
  product: {
    id: string;
    title: string;
    description: string | null;
    brand: string | null;
    size: string | null;
    conditionText: string | null;
    measurements: string | null;
    story: string | null;
    priceRub: number;
    status: ProductStatus;
    images: { url: string; sortOrder: number }[];
    barcode: { code: string } | null;
  },
) {
  return {
    id: product.id,
    code: product.barcode?.code ?? null,
    title: product.title,
    description: product.description,
    brand: product.brand,
    size: product.size,
    conditionText: product.conditionText,
    measurements: product.measurements,
    story: product.story,
    priceRub: product.priceRub,
    status: product.status,
    images: product.images.sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.url),
    publicUrl: product.barcode ? publicItemUrl(product.barcode.code) : null,
    isAvailable: product.status === ProductStatus.AVAILABLE,
  };
}

publicRoutes.get("/item/:code", async (c) => {
  const code = c.req.param("code").toUpperCase();

  const barcode = await prisma.barcode.findUnique({
    where: { code },
    include: {
      product: {
        include: { images: true, barcode: true },
      },
    },
  });

  if (!barcode) {
    return c.json({ error: "not_found" }, 404);
  }

  if (!barcode.product) {
    return c.json({
      code: barcode.code,
      status: barcode.status,
      product: null,
      message: "Бирка ещё не привязана к товару",
    });
  }

  return c.json({
    code: barcode.code,
    status: barcode.status,
    product: serializeProduct({ ...barcode.product, barcode: { code: barcode.code } }),
  });
});

publicRoutes.get("/catalog", async (c) => {
  const size = c.req.query("size");
  const q = c.req.query("q");

  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.AVAILABLE,
      barcode: { isNot: null },
      ...(size ? { size } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { brand: { contains: q } },
            ],
          }
        : {}),
    },
    include: { images: true, barcode: true },
    orderBy: { createdAt: "desc" },
  });

  return c.json({
    items: products.map((p) => serializeProduct(p)),
  });
});

publicRoutes.get("/sizes", async (c) => {
  const rows = await prisma.product.findMany({
    where: { status: ProductStatus.AVAILABLE, size: { not: null } },
    select: { size: true },
    distinct: ["size"],
  });
  return c.json({ sizes: rows.map((r) => r.size).filter(Boolean) });
});

publicRoutes.get("/similar/:productId", async (c) => {
  const productId = c.req.param("productId");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return c.json({ items: [] });

  const similar = await prisma.product.findMany({
    where: {
      status: ProductStatus.AVAILABLE,
      id: { not: productId },
      OR: [
        product.brand ? { brand: product.brand } : {},
        product.size ? { size: product.size } : {},
      ],
    },
    include: { images: true, barcode: true },
    take: 4,
  });

  return c.json({ items: similar.map((p) => serializeProduct(p)) });
});
