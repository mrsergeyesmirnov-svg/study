import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { QrScanner } from "../components/QrScanner";

export function AdminCreatePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(params.get("code")?.toUpperCase() || "");
  const [codeHint, setCodeHint] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [title, setTitle] = useState("");
  const [priceRub, setPriceRub] = useState("");
  const [size, setSize] = useState("");
  const [conditionText, setConditionText] = useState("отличное");
  const [brand, setBrand] = useState("");
  const [measurements, setMeasurements] = useState("");
  const [story, setStory] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [publish, setPublish] = useState(true);
  const [loading, setLoading] = useState(false);

  async function onScanCode(scanned: string) {
    setCode(scanned);
    setShowCamera(false);
    setCodeHint(null);
    try {
      const res = await api.adminScan(scanned);
      if (res.action === "create_product") {
        setCodeHint("✓ Бирка свободна — заполните карточку");
      } else if (res.action === "mark_sold") {
        setCodeHint("⚠️ На этой бирке уже есть товар. Выберите другую бирку.");
      } else if (res.action === "already_sold") {
        setCodeHint("⚠️ Бирка уже продана");
      } else {
        setCodeHint("Неизвестный код");
      }
    } catch {
      setCodeHint("Не удалось проверить код");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of files) {
      const { url } = await api.uploadImage(file);
      setImageUrls((prev) => [...prev, url]);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code || !title || !priceRub) return alert("Код, название и цена обязательны");
    setLoading(true);
    try {
      await api.adminCreateProduct({
        code,
        title,
        priceRub: parseInt(priceRub, 10),
        size: size || undefined,
        conditionText,
        brand: brand || undefined,
        measurements: measurements || undefined,
        story: story || undefined,
        imageUrls,
        publish,
      });
      alert(publish ? "Товар опубликован!" : "Товар сохранён");
      navigate("/admin");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <h2>Новый товар</h2>
      <form onSubmit={submit}>
        <div className="field">
          <label>Код бирки *</label>
          {showCamera ? (
            <QrScanner
              elementId="qr-reader-create"
              onScan={onScanCode}
              onClose={() => setShowCamera(false)}
            />
          ) : (
            <button
              type="button"
              className="btn-secondary"
              style={{ marginBottom: 8 }}
              onClick={() => setShowCamera(true)}
            >
              📷 Скан QR бирки
            </button>
          )}
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setCodeHint(null);
            }}
            placeholder="VTG-000001"
            required
          />
          {codeHint && (
            <p style={{ fontSize: "0.85rem", marginTop: 6, color: codeHint.startsWith("✓") ? "#8f8" : "#fa8" }}>
              {codeHint}
            </p>
          )}
        </div>
        <div className="field">
          <label>Название *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label>Цена ₽ *</label>
          <input type="number" value={priceRub} onChange={(e) => setPriceRub(e.target.value)} required />
        </div>
        <div className="field">
          <label>Бренд</label>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
        <div className="field">
          <label>Размер</label>
          <input value={size} onChange={(e) => setSize(e.target.value)} />
        </div>
        <div className="field">
          <label>Состояние</label>
          <input value={conditionText} onChange={(e) => setConditionText(e.target.value)} />
        </div>
        <div className="field">
          <label>Замеры</label>
          <textarea value={measurements} onChange={(e) => setMeasurements(e.target.value)} rows={2} />
        </div>
        <div className="field">
          <label>История / детали</label>
          <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={3} />
        </div>
        <div className="field">
          <label>Фото</label>
          <input type="file" accept="image/*" multiple onChange={onFile} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {imageUrls.map((url) => (
              <img key={url} src={url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
            ))}
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          Опубликовать в каналы сразу
        </label>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Сохранение..." : "Сохранить"}
        </button>
      </form>
      <Link to="/admin" style={{ display: "block", textAlign: "center", marginTop: 16 }}>
        ← Админка
      </Link>
    </div>
  );
}
