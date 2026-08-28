import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { parseBarcodeFromText } from "../lib/parseBarcode";

type Props = {
  onScan: (code: string) => void;
  onClose: () => void;
  elementId?: string;
};

export function QrScanner({ onScan, onClose, elementId = "qr-reader" }: Props) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(elementId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          const code = parseBarcodeFromText(text);
          if (code) {
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
  }, [onScan, elementId]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div id={elementId} style={{ borderRadius: 12, overflow: "hidden" }} />
      {error && <p style={{ color: "#f88", fontSize: "0.85rem" }}>{error}</p>}
      <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>
        Закрыть камеру
      </button>
    </div>
  );
}
