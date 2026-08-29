export const PRODUCT_CATEGORIES = [
  { id: "outerwear", label: "Верхняя одежда" },
  { id: "hoodie", label: "Худи / свитшоты" },
  { id: "knit", label: "Свитера" },
  { id: "shirt", label: "Рубашки" },
  { id: "polo", label: "Поло" },
  { id: "tee", label: "Футболки" },
  { id: "pants", label: "Штаны" },
  { id: "jeans", label: "Джинсы" },
  { id: "shorts", label: "Шорты" },
  { id: "accessories", label: "Аксессуары" },
  { id: "shoes", label: "Обувь" },
  { id: "other", label: "Другое" },
] as const;

export type ProductCategoryId = (typeof PRODUCT_CATEGORIES)[number]["id"];

const ID_SET = new Set<string>(PRODUCT_CATEGORIES.map((c) => c.id));

export function isProductCategory(value: string | null | undefined): value is ProductCategoryId {
  return !!value && ID_SET.has(value);
}

export function categoryLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return PRODUCT_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
