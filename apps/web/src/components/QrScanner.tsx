import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Props = {
  onScan: (code: string) => void;
  onClose: () => void;
};

export function QrScanner({ onScan, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const id = "qr-reader";
    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          const match = text.match(/VTG-\d+/i) || text.match(/\/i\/(VTG-\d+)/i);
          const code = match
            ? (match[1] ?? match[0]).toUpperCase()
            : text.trim().toUpperCase();
          if (code.startsWith("VTG-")) {
            void scanner.stop().then(() => onScan(code));
          }
        },
        () => {},
      )
      .then(() => {
        startedRef.current = true;
      })
      .catch((e: Error) => setError(e.message || "Нет доступа к камере"));

    return () => {
      if (startedRef.current) {
        void scanner.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div id="qr-reader" style={{ borderRadius: 12, overflow: "hidden" }} />
      {error && <p style={{ color: "#f88", fontSize: "0.85rem" }}>{error}</p>}
      <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>
        Закрыть камеру
      </button>
    </div>
  );
}
