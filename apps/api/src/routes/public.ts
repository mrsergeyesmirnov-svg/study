import { Hono } from "hono";
import { prisma } from "../db.js";
import { publicItemUrl, apiPublicOrigin } from "../env.js";
import { ProductStatus } from "@prisma/client";
import { PRODUCT_CATEGORIES, categoryLabel, isProductCategory } from "../catalog/categories.js";

export const publicRoutes = new Hono();

function rewriteImageUrl(url: string): string {
  const origin = apiPublicOrigin();
  if (!origin) return url;

  const mediaMatch = url.match(/\/api\/media\/([a-z0-9]+)/i);
  if (mediaMatch) return `${origin}/api/media/${mediaMatch[1]}`;

  const uploadMatch = url.match(/\/uploads\/([^/?#]+)/i);
  if (uploadMatch) return `${origin}/uploads/${uploadMatch[1]}`;

  if (url.startsWith("/")) return `${origin}${url}`;
  return url;
}

function serializeProduct(
  product: {
    id: string;
    title: string;
    description: string | null;
    brand: string | null;
    category: string | null;
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
    category: product.category,
    categoryLabel: categoryLabel(product.category),
    size: product.size,
    conditionText: product.conditionText,
    measurements: product.measurements,
    story: product.story,
    priceRub: product.priceRub,
    status: product.status,
    images: product.images
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => rewriteImageUrl(i.url)),
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
  const category = c.req.query("category");
  const q = c.req.query("q");

  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.AVAILABLE,
      barcode: { isNot: null },
      ...(size ? { size } : {}),
      ...(category && isProductCategory(category) ? { category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
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
  const category = c.req.query("category");
  const rows = await prisma.product.findMany({
    where: {
      status: ProductStatus.AVAILABLE,
      size: { not: null },
      ...(category && isProductCategory(category) ? { category } : {}),
    },
    select: { size: true },
    distinct: ["size"],
  });
  return c.json({ sizes: rows.map((r) => r.size).filter(Boolean) });
});

publicRoutes.get("/categories", async (c) => {
  const usedOnly = c.req.query("used") === "1";
  const counts = await prisma.product.groupBy({
    by: ["category"],
    where: { status: ProductStatus.AVAILABLE, category: { not: null } },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((r) => [r.category!, r._count._all]));

  const items = PRODUCT_CATEGORIES.filter((cat) => !usedOnly || (countMap.get(cat.id) ?? 0) > 0).map(
    (cat) => ({
      id: cat.id,
      label: cat.label,
      count: countMap.get(cat.id) ?? 0,
    }),
  );

  return c.json({ items });
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
        product.category ? { category: product.category } : {},
        product.brand ? { brand: product.brand } : {},
        product.size ? { size: product.size } : {},
      ],
    },
    include: { images: true, barcode: true },
    take: 4,
  });

  return c.json({ items: similar.map((p) => serializeProduct(p)) });
});
