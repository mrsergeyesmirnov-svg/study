import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatPrice, type ProductItem } from "../api";
import { ProductPhoto } from "../components/ProductPhoto";

export function ShopPage() {
  const [items, setItems] = useState<ProductItem[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [size, setSize] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.catalog({ size: size || undefined, q: q || undefined }), api.sizes()])
      .then(([cat, sz]) => {
        setItems(cat.items);
        setSizes(sz.sizes as string[]);
      })
      .finally(() => setLoading(false));
  }, [size, q]);

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
      {sizes.length > 0 && (
        <div style={{ marginBottom: 12, overflowX: "auto", whiteSpace: "nowrap" }}>
          <button
            type="button"
            className={!size ? "btn-primary" : "btn-secondary"}
            style={{ display: "inline-block", width: "auto", marginRight: 8, padding: "8px 14px" }}
            onClick={() => setSize("")}
          >
            Все
          </button>
          {sizes.map((s) => (
            <button
              key={s}
              type="button"
              className={size === s ? "btn-primary" : "btn-secondary"}
              style={{ display: "inline-block", width: "auto", marginRight: 8, padding: "8px 14px" }}
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
