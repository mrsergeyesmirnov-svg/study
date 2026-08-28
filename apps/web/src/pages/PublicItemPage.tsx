import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatPrice, type ProductItem } from "../api";
import { openTelegramLink } from "../telegram";

const BOT_SHOP = "https://t.me/vtgconcept_bot/shop";

export function PublicItemPage() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<{
    code: string;
    product: ProductItem | null;
    message?: string;
  } | null>(null);
  const [similar, setSimilar] = useState<ProductItem[]>([]);

  useEffect(() => {
    if (!code) return;
    api.item(code).then((res) => {
      setData(res);
      if (res.product?.id) {
        api.similar(res.product.id).then((s) => setSimilar(s.items));
      }
    });
  }, [code]);

  if (!data) return <div className="app-shell empty">Загрузка...</div>;

  const p = data.product;

  if (!p) {
    return (
      <div className="app-shell">
        <div className="logo-row">
          <h1>VTGSHMOT</h1>
        </div>
        <p>Код: {data.code}</p>
        <p>{data.message || "Товар ещё не заведён"}</p>
      </div>
    );
  }

  const sold = p.status === "SOLD";

  return (
    <div className="app-shell">
      <div className="logo-row">
        <h1>VTGSHMOT</h1>
        <span className={`badge ${sold ? "sold" : "available"}`}>
          {sold ? "Продано" : "В наличии"}
        </span>
      </div>

      <div className="gallery">
        {p.images.map((url) => (
          <img key={url} src={url} alt={p.title} />
        ))}
      </div>

      <h2>{p.title}</h2>
      {p.brand && <p style={{ color: "var(--muted)" }}>{p.brand}</p>}
      <div style={{ fontSize: "1.5rem", fontWeight: 700, margin: "12px 0" }}>
        {formatPrice(p.priceRub)}
      </div>

      {p.size && <p><strong>Размер:</strong> {p.size}</p>}
      {p.conditionText && <p><strong>Состояние:</strong> {p.conditionText}</p>}
      {p.measurements && <p><strong>Замеры:</strong> {p.measurements}</p>}
      {p.story && <p style={{ lineHeight: 1.5 }}>{p.story}</p>}

      {!sold && (
        <>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => openTelegramLink(`${BOT_SHOP}?startapp=product_${p.id}`)}
          >
            Купить в Telegram
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 8 }}
            onClick={() => openTelegramLink("https://t.me/vtgceo")}
          >
            Написать @vtgceo
          </button>
        </>
      )}

      {sold && (
        <p style={{ marginTop: 20, color: "var(--muted)" }}>
          Эта вещь уже нашла хозяина. Смотрите похожие ↓
        </p>
      )}

      {similar.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Похожее</h3>
          <div className="grid">
            {similar.map((item) => (
              <Link key={item.id} to={item.publicUrl?.replace(/^https?:\/\/[^/]+/, "") || `/product/${item.id}`} className="card">
                <img src={item.images[0]} alt="" />
                <div className="card-body">
                  <div className="card-price">{formatPrice(item.priceRub)}</div>
                  <div className="card-title">{item.title}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <p style={{ marginTop: 32, textAlign: "center", color: "var(--muted)", fontSize: "0.8rem" }}>
        Шоурум · СПб · {data.code}
      </p>
    </div>
  );
}
