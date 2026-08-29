import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatPrice, type ProductItem } from "../api";
import { getCart, removeFromCart, clearCart } from "../cart";
import { openTelegramLink } from "../telegram";
import { ProductPhoto } from "../components/ProductPhoto";

export function CartPage() {
  const [items, setItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<string | null>(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    const ids = getCart();
    if (!ids.length) {
      setItems([]);
      setLoading(false);
      return;
    }
    const all = await api.catalog();
    setItems(all.items.filter((i) => ids.includes(i.id)));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const total = items.reduce((s, i) => s + i.priceRub, 0);

  async function checkout() {
    try {
      const res = await api.createOrder(items.map((i) => i.id));
      clearCart();
      setOrderInfo(
        `Заказ оформлен!\n\n${res.paymentInfo}\n\nСумма: ${formatPrice(res.order.totalRub)}`,
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка заказа");
    }
  }

  if (orderInfo) {
    return (
      <div className="app-shell">
        <h2>Заказ создан</h2>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "var(--surface)",
            padding: 16,
            borderRadius: 12,
          }}
        >
          {orderInfo}
        </pre>
        <button type="button" className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/")}>
          В каталог
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 8 }}
          onClick={() => openTelegramLink("https://t.me/vtgceo")}
        >
          Написать @vtgceo
        </button>
      </div>
    );
  }

  return (
    <>
      {loading ? (
        <div className="empty">Загрузка...</div>
      ) : items.length === 0 ? (
        <div className="empty">
          Корзина пуста
          <br />
          <Link to="/">В каталог</Link>
        </div>
      ) : (
        <>
          {items.map((item) => (
            <div key={item.id} className="cart-item">
              <ProductPhoto
                src={item.images[0]}
                alt=""
                style={{ width: 72, height: 72, borderRadius: 8, flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div>{item.title}</div>
                <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  {item.size && `Размер: ${item.size}`}
                </div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{formatPrice(item.priceRub)}</div>
                <button
                  type="button"
                  style={{ background: "none", color: "var(--danger)", padding: 0, marginTop: 8 }}
                  onClick={() => {
                    removeFromCart(item.id);
                    load();
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
          <div style={{ fontSize: "1.2rem", fontWeight: 700, margin: "16px 0" }}>
            Итого: {formatPrice(total)}
          </div>
          <button type="button" className="btn-primary" onClick={checkout}>
            Оформить заказ
          </button>
        </>
      )}
    </>
  );
}
