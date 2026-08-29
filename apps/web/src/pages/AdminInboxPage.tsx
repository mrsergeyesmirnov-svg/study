import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatPrice, type AdminProduct } from "../api";
import { QrScanner } from "../components/QrScanner";

export function AdminInboxPage() {
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.adminInbox();
      setItems(res.items);
    } catch {
      setHint("Не удалось загрузить входящие");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function linkCode(code: string) {
    if (!linkingId) return;
    const normalized = code.toUpperCase().replace(/.*\/i\//, "").trim();
    setShowCamera(false);
    setHint(null);
    try {
      const scan = await api.adminScan(normalized);
      if (scan.action !== "create_product") {
        setHint("Нужна свободная бирка (POOL), эта уже занята или неизвестна");
        return;
      }
      await api.adminLinkBarcode(linkingId, normalized, true);
      setHint(`✓ ${normalized} привязана — товар в каталоге`);
      setLinkingId(null);
      setManualCode("");
      await load();
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Ошибка привязки");
    }
  }

  async function dismiss(id: string) {
    if (!confirm("Убрать из входящих?")) return;
    await api.adminDismissProduct(id);
    await load();
  }

  return (
    <div className="app-shell">
      <h2>Входящие из канала</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 0 }}>
        Посты по форме (название + цена + замеры) попадают сюда. Сканируйте бирку — товар появится в
        каталоге.
      </p>

      {hint && (
        <pre style={{ whiteSpace: "pre-wrap", background: "var(--surface)", padding: 12, borderRadius: 8 }}>
          {hint}
        </pre>
      )}

      {linkingId && (
        <section style={{ marginBottom: 20, padding: 12, background: "var(--surface)", borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>Скан бирки для привязки</h3>
          {showCamera ? (
            <QrScanner
              elementId="qr-reader-inbox"
              onScan={linkCode}
              onClose={() => setShowCamera(false)}
            />
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setShowCamera(true)}>
              📷 Скан QR
            </button>
          )}
          <div className="field" style={{ marginTop: 8 }}>
            <input
              placeholder="VTG-000001"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
          </div>
          <button type="button" className="btn-primary" onClick={() => linkCode(manualCode)}>
            Привязать и в каталог
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 8 }}
            onClick={() => {
              setLinkingId(null);
              setShowCamera(false);
            }}
          >
            Отмена
          </button>
        </section>
      )}

      {loading && <p>Загрузка...</p>}
      {!loading && items.length === 0 && (
        <p style={{ color: "var(--muted)" }}>Пусто. Напишите пост в канал по форме — появится здесь.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((item) => (
          <article
            key={item.id}
            style={{
              background: "var(--surface)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {item.images[0] && (
              <img
                src={item.images[0]}
                alt=""
                style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
              />
            )}
            <div style={{ padding: 12 }}>
              <strong>{item.title}</strong>
              <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
                {formatPrice(item.priceRub)}
                {item.size ? ` · ${item.size}` : ""}
                {item.measurements ? ` · ${item.measurements}` : ""}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setLinkingId(item.id);
                    setHint(null);
                  }}
                >
                  📷 Привязать бирку
                </button>
                <button type="button" className="btn-secondary" onClick={() => dismiss(item.id)}>
                  Скрыть
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Link to="/admin" style={{ display: "block", textAlign: "center", marginTop: 24 }}>
        ← Админка
      </Link>
    </div>
  );
}
