import qrcode from "qrcode-generator";

export const createReceiptQrMatrix = (receiptUrl) => {
  let qr;
  try {
    qr = qrcode(0, "M");
    qr.addData(receiptUrl);
    qr.make();
  } catch {
    qr = qrcode(0, "L");
    qr.addData(receiptUrl);
    qr.make();
  }

  const count = qr.getModuleCount();
  return Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, column) => qr.isDark(row, column))
  );
};

export const createReceiptQrCode = (receiptUrl) => {
  const modules = createReceiptQrMatrix(receiptUrl);
  const quietZone = 4;
  const path = modules.flatMap((row, rowIndex) => {
    const segments = [];
    for (let column = 0; column < row.length;) {
      if (!row[column]) {
        column += 1;
        continue;
      }
      const start = column;
      while (column < row.length && row[column]) column += 1;
      segments.push(`M${start + quietZone} ${rowIndex + quietZone}h${column - start}v1h-${column - start}z`);
    }
    return segments;
  }).join("");

  return { path, moduleCount: modules.length };
};
