import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { initTelegram, getTelegramUser } from "../telegram";
import { QrScanner } from "../components/QrScanner";
import { downloadLabelsPdf } from "../lib/labelsPdf";

export function AdminPage() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [scanCode, setScanCode] = useState("");
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [canMarkSold, setCanMarkSold] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [lastBatch, setLastBatch] = useState<string[]>([]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tgUser = getTelegramUser();

  useEffect(() => {
    initTelegram();
    api.adminMe()
      .then((r) => {
        setAdmin(r.admin);
        setApiError(null);
      })
      .catch(() => {
        setAdmin(false);
        setApiError("Не достучались до API. Проверьте VITE_API_URL на web-сервисе и redeploy web.");
      });
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl) handleScan(codeFromUrl);
  }, [searchParams]);

  async function handleScan(code: string) {
    const normalized = code.toUpperCase().replace(/.*\/i\//, "").trim();
    setScanCode(normalized);
    setCanMarkSold(false);
    setShowCamera(false);
    try {
      const res = await api.adminScan(normalized);
      if (res.action === "create_product") {
        navigate(`/admin/create?code=${normalized}`);
        return;
      }
      if (res.action === "mark_sold") {
        setScanResult(`Товар: ${(res as { product?: { title?: string } }).product?.title}\nНажмите «Продано»`);
        setCanMarkSold(true);
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
    setCanMarkSold(false);
  }

  async function generateBarcodes() {
    const res = await api.adminGenerateBarcodes(100);
    setLastBatch(res.codes);
    alert(`Создано ${res.codes.length} кодов\n${res.codes.slice(0, 3).join("\n")}...`);
  }

  async function downloadPdf() {
    const codes =
      lastBatch.length > 0
        ? lastBatch
        : (await api.adminPoolBarcodes()).items.map((b) => b.code);
    await downloadLabelsPdf(codes, window.location.origin);
  }

  if (admin === null) return <div className="app-shell empty">Проверка доступа...</div>;

  if (!admin) {
    return (
      <div className="app-shell">
        <h2>Админка</h2>
        {apiError && <p style={{ color: "#f88" }}>{apiError}</p>}
        <p>Открывайте <b>из Telegram</b> (@vtgconcept_bot → /admin).</p>
        {tgUser?.id && (
          <p>
            Ваш Telegram ID: <b>{tgUser.id}</b>
          </p>
        )}
        <Link to="/">← В каталог</Link>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <h2>⚙️ Админка VTGSHMOT</h2>

      <section style={{ marginBottom: 24 }}>
        <h3>Скан QR / код</h3>
        {showCamera ? (
          <QrScanner onScan={handleScan} onClose={() => setShowCamera(false)} elementId="qr-reader-admin" />
        ) : (
          <button type="button" className="btn-secondary" style={{ marginBottom: 8 }} onClick={() => setShowCamera(true)}>
            📷 Скан камерой
          </button>
        )}
        <div className="field">
          <input
            placeholder="VTG-000001"
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan(scanCode)}
          />
        </div>
        <button type="button" className="btn-primary" onClick={() => handleScan(scanCode)}>
          Найти код
        </button>
        {scanResult && (
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 12, background: "var(--surface)", padding: 12, borderRadius: 8 }}>
            {scanResult}
          </pre>
        )}
        {canMarkSold && (
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
        <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={downloadPdf}>
          📄 Скачать PDF для печати
        </button>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          QR → страница /i/VTG-XXXXXX · A4, 24 бирки на лист
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
