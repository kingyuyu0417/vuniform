import { PRODUCT_IMPORT_HEADER_ALIASES, normalizeProductImportHeader } from "./productImportHeaders.js";

export const hasStandardProductImportHeaders = (rows = []) => {
  const headers = new Set(rows.slice(0, 6).flat().map(normalizeProductImportHeader));
  return ["school", "name", "size", "price"].every((field) => (
    PRODUCT_IMPORT_HEADER_ALIASES[field]
      .some((alias) => headers.has(normalizeProductImportHeader(alias)))
  ));
};

export const detectProductImportMode = (fileName, rows = []) => {
  const extension = String(fileName || "").toLowerCase().split(".").pop();
  if (extension === "csv") return "smart";
  if (!["xls", "xlsx"].includes(extension)) {
    throw new Error("只支援 Excel 或 CSV 檔案。");
  }
  return hasStandardProductImportHeaders(rows) ? "smart" : "analyzer";
};
