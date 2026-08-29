import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatPrice, type AdminProduct } from "../api";

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminScheduledPage() {
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.adminScheduled();
      setItems(res.items);
    } catch {
      setHint("Не удалось загрузить расписание");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function publishNow(id: string) {
    try {
      await api.adminActivateProduct(id);
      setHint("✓ Опубликовано сейчас");
      await load();
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function cancelSchedule(id: string) {
    await api.adminScheduleProduct(id, null);
    await load();
  }

  async function dismiss(id: string) {
    if (!confirm("Архивировать черновик?")) return;
    await api.adminDismissProduct(id);
    await load();
  }

  return (
    <div className="app-shell">
      <h2>Планировщик</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 0 }}>
        Товары с отложенной публикацией. В указанное время уйдут в канал и каталог.
      </p>

      {hint && (
        <pre style={{ whiteSpace: "pre-wrap", background: "var(--surface)", padding: 12, borderRadius: 8 }}>
          {hint}
        </pre>
      )}

      {loading && <p>Загрузка...</p>}
      {!loading && items.length === 0 && (
        <p style={{ color: "var(--muted)" }}>
          Нет отложенных. При создании товара выберите «Отложить» и дату.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((item) => (
          <article
            key={item.id}
            style={{ background: "var(--surface)", borderRadius: 12, padding: 12 }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              {item.images[0] && (
                <img
                  src={item.images[0]}
                  alt=""
                  style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }}
                />
              )}
              <div style={{ flex: 1 }}>
                <strong>{item.title}</strong>
                <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  {item.code ?? "без кода"} · {formatPrice(item.priceRub)}
                </div>
                <div style={{ marginTop: 4 }}>📅 {formatWhen(item.publishAt)}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" className="btn-primary" onClick={() => publishNow(item.id)}>
                Опубликовать сейчас
              </button>
              <button type="button" className="btn-secondary" onClick={() => cancelSchedule(item.id)}>
                Снять с расписания
              </button>
              <button type="button" className="btn-secondary" onClick={() => dismiss(item.id)}>
                Архив
              </button>
            </div>
          </article>
        ))}
      </div>

      <Link to="/admin/create" className="btn-secondary" style={{ display: "block", textAlign: "center", marginTop: 20, textDecoration: "none" }}>
        + Запланировать новый
      </Link>
      <Link to="/admin" style={{ display: "block", textAlign: "center", marginTop: 16 }}>
        ← Админка
      </Link>
    </div>
  );
}
