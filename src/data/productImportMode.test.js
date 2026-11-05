import assert from "node:assert/strict";
import test from "node:test";
import { detectProductImportMode, hasStandardProductImportHeaders } from "./productImportMode.js";

test("routes standard Excel files to smart import", () => {
  const rows = [
    ["學校", "款式名稱", "尺碼", "價錢"],
    ["示範小學", "白恤衫", "M", 100],
  ];
  assert.equal(detectProductImportMode("products.xlsx", rows), "smart");
  assert.equal(hasStandardProductImportHeaders(rows), true);
});

test("routes parallel price-list Excel files to layout analysis", () => {
  assert.equal(detectProductImportMode("price-list.xls", [
    ["冬季價目表"],
    ["款式", "尺碼", "價格", "款式", "尺碼", "價格"],
  ]), "analyzer");
});

test("routes CSV files to smart import", () => {
  assert.equal(detectProductImportMode("products.csv", []), "smart");
});

test("rejects unsupported import file types", () => {
  assert.throws(() => detectProductImportMode("products.pdf"), /只支援 Excel 或 CSV 檔案/);
});
