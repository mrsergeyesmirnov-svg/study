import { jsPDF } from "jspdf";
import QRCode from "qrcode";

/** A4: 3×8 сетка бирок с QR на публичную страницу */
export async function downloadLabelsPdf(codes: string[], webOrigin: string) {
  if (!codes.length) {
    alert("Нет свободных бирок (POOL). Сначала сгенерируйте коды.");
    return;
  }

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const cols = 3;
  const rows = 8;
  const marginX = 10;
  const marginY = 12;
  const cellW = (210 - marginX * 2) / cols;
  const cellH = (297 - marginY * 2) / rows;
  const qrSize = Math.min(cellW - 8, cellH - 14);

  let i = 0;
  for (const code of codes) {
    if (i > 0 && i % (cols * rows) === 0) pdf.addPage();
    const pageIndex = i % (cols * rows);
    const col = pageIndex % cols;
    const row = Math.floor(pageIndex / cols);
    const x = marginX + col * cellW + (cellW - qrSize) / 2;
    const y = marginY + row * cellH;

    const url = `${webOrigin.replace(/\/$/, "")}/i/${code}`;
    const dataUrl = await QRCode.toDataURL(url, { margin: 0, width: 256 });

    pdf.addImage(dataUrl, "PNG", x, y, qrSize, qrSize);
    pdf.setFontSize(9);
    pdf.text(code, marginX + col * cellW + cellW / 2, y + qrSize + 5, {
      align: "center",
    });
    pdf.setFontSize(7);
    pdf.setTextColor(120);
    pdf.text("VTGSHMOT", marginX + col * cellW + cellW / 2, y + qrSize + 9, {
      align: "center",
    });
    pdf.setTextColor(0);
    i++;
  }

  pdf.save(`vtgshmot-labels-${codes.length}.pdf`);
}
