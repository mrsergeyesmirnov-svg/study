import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatPrice, type ProductItem } from "../api";
import { ProductPhoto } from "../components/ProductPhoto";
import { PRODUCT_CATEGORIES } from "../lib/categories";

type CatChip = { id: string; label: string; count: number };

export function ShopPage() {
  const [items, setItems] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CatChip[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [size, setSize] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.categories().then((r) => setCategories(r.items)).catch(() => {
      setCategories(PRODUCT_CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: 0 })));
    });
  }, []);

  useEffect(() => {
    setSize("");
  }, [category]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.catalog({
        category: category || undefined,
        size: size || undefined,
        q: q || undefined,
      }),
      api.sizes(category || undefined),
    ])
      .then(([cat, sz]) => {
        setItems(cat.items);
        setSizes(sz.sizes as string[]);
      })
      .finally(() => setLoading(false));
  }, [category, size, q]);

  const chipStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-block",
    width: "auto",
    marginRight: 8,
    padding: "8px 14px",
    ...(active ? {} : {}),
  });

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Поиск..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>

      <div style={{ marginBottom: 10, overflowX: "auto", whiteSpace: "nowrap" }}>
        <button
          type="button"
          className={!category ? "btn-primary" : "btn-secondary"}
          style={chipStyle(!category)}
          onClick={() => setCategory("")}
        >
          Весь магазин
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={category === c.id ? "btn-primary" : "btn-secondary"}
            style={chipStyle(category === c.id)}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
            {c.count > 0 ? ` · ${c.count}` : ""}
          </button>
        ))}
      </div>

      {sizes.length > 0 && (
        <div style={{ marginBottom: 12, overflowX: "auto", whiteSpace: "nowrap" }}>
          <button
            type="button"
            className={!size ? "btn-primary" : "btn-secondary"}
            style={chipStyle(!size)}
            onClick={() => setSize("")}
          >
            Все размеры
          </button>
          {sizes.map((s) => (
            <button
              key={s}
              type="button"
              className={size === s ? "btn-primary" : "btn-secondary"}
              style={chipStyle(size === s)}
              onClick={() => setSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="empty">Загрузка...</div>
      ) : items.length === 0 ? (
        <div className="empty">Пока пусто — добавьте товары через админку</div>
      ) : (
        <div className="grid">
          {items.map((item) => (
            <Link key={item.id} to={`/product/${item.id}`} className="card">
              <ProductPhoto src={item.images[0]} alt={item.title} />
              <div className="card-body">
                <div className="card-price">{formatPrice(item.priceRub)}</div>
                <div className="card-title">{item.title}</div>
                {item.categoryLabel && (
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>
                    {item.categoryLabel}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
