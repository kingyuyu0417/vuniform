const normalizeHeader = (value) => String(value ?? "").replace(/\s+/g, "").toLowerCase();

export const hasStandardProductImportHeaders = (rows = []) => {
  const headerText = rows.slice(0, 6).flat().map(normalizeHeader).join("|");
  return ["學校", "款式名稱", "尺碼", "價錢"]
    .every((header) => headerText.includes(normalizeHeader(header)));
};

export const detectProductImportMode = (fileName, rows = []) => {
  const extension = String(fileName || "").toLowerCase().split(".").pop();
  if (extension === "csv") return "smart";
  if (!["xls", "xlsx"].includes(extension)) {
    throw new Error("只支援 Excel 或 CSV 檔案。");
  }
  return hasStandardProductImportHeaders(rows) ? "smart" : "analyzer";
};
