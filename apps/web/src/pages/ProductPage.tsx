import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatPrice, type ProductItem } from "../api";
import { addToCart } from "../cart";

export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<ProductItem | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    api.catalog().then((r) => {
      setItem(r.items.find((i) => i.id === id) ?? null);
    });
  }, [id]);

  if (!item) return <div className="app-shell empty">Товар не найден</div>;

  return (
    <div className="app-shell">
      <button
        type="button"
        className="btn-secondary"
        style={{ width: "auto", marginBottom: 12 }}
        onClick={() => navigate(-1)}
      >
        ← Назад
      </button>
      <div className="gallery">
        {item.images.map((url) => (
          <img key={url} src={url} alt={item.title} />
        ))}
      </div>
      <h2 style={{ margin: "12px 0 4px" }}>{item.title}</h2>
      <div style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 12 }}>
        {formatPrice(item.priceRub)}
      </div>
      {item.size && <p>Размер: {item.size}</p>}
      {item.conditionText && <p>Сост.: {item.conditionText}</p>}
      {item.measurements && <p>Замеры: {item.measurements}</p>}
      {item.story && <p>{item.story}</p>}
      <button
        type="button"
        className="btn-primary"
        style={{ marginTop: 16 }}
        onClick={() => {
          addToCart(item.id);
          navigate("/cart");
        }}
      >
        Добавить в корзину
      </button>
      {item.publicUrl && (
        <Link to={item.publicUrl.replace(/^https?:\/\/[^/]+/, "")} style={{ display: "block", marginTop: 12, textAlign: "center" }}>
          Публичная страница
        </Link>
      )}
    </div>
  );
}
