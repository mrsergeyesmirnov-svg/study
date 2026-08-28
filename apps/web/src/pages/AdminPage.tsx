import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { initTelegram } from "../telegram";

export function AdminPage() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [scanCode, setScanCode] = useState("");
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    initTelegram();
    api.adminMe().then((r) => setAdmin(r.admin));
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl) handleScan(codeFromUrl);
  }, [searchParams]);

  async function handleScan(code: string) {
    const normalized = code.toUpperCase().replace(/.*\/i\//, "").trim();
    setScanCode(normalized);
    try {
      const res = await api.adminScan(normalized);
      if (res.action === "create_product") {
        navigate(`/admin/create?code=${normalized}`);
        return;
      }
      if (res.action === "mark_sold") {
        setScanResult(`Товар: ${res.product?.title}\nНажмите «Продано» для подтверждения`);
        return;
      }
      if (res.action === "already_sold") {
        setScanResult("Уже продано");
        return;
      }
      setScanResult("Неизвестный код");
    } catch {
      setScanResult("Ошибка скана или нет доступа");
    }
  }

  async function markSold() {
    if (!scanCode) return;
    await api.adminMarkSold(scanCode);
    setScanResult("✓ Продано — снято с каталога и каналов");
  }

  async function generateBarcodes() {
    const res = await api.adminGenerateBarcodes(100);
    alert(`Создано ${res.codes.length} кодов\n${res.codes.slice(0, 3).join("\n")}...`);
  }

  if (admin === null) return <div className="app-shell empty">Проверка доступа...</div>;

  if (!admin) {
    return (
      <div className="app-shell">
        <h2>Админка</h2>
        <p>Откройте через Telegram-бота. Ваш Telegram ID должен быть в ADMIN_TELEGRAM_IDS.</p>
        <Link to="/">← В каталог</Link>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <h2>⚙️ Админка VTGSHMOT</h2>

      <section style={{ marginBottom: 24 }}>
        <h3>Скан QR / код</h3>
        <div className="field">
          <input
            placeholder="VTG-000001 или вставьте URL"
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan(scanCode)}
          />
        </div>
        <button type="button" className="btn-primary" onClick={() => handleScan(scanCode)}>
          Сканировать
        </button>
        {scanResult && (
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 12, background: "var(--surface)", padding: 12, borderRadius: 8 }}>
            {scanResult}
          </pre>
        )}
        {scanResult?.includes("Продано»") && (
          <button type="button" className="btn-danger" style={{ marginTop: 8 }} onClick={markSold}>
            Продано в магазине
          </button>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3>Бирки</h3>
        <button type="button" className="btn-secondary" onClick={generateBarcodes}>
          Сгенерировать 100 кодов
        </button>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          QR ведёт на /i/VTG-XXXXXX — печать PDF добавим следующим шагом
        </p>
      </section>

      <section>
        <Link to="/admin/create" className="btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
          + Новый товар
        </Link>
        <Link to="/" style={{ display: "block", textAlign: "center", marginTop: 12 }}>
          ← Каталог
        </Link>
      </section>
    </div>
  );
}
