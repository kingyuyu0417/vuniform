import test from "node:test";
import assert from "node:assert/strict";
import { mapAnalyzerItems, splitAnalyzerWarnings } from "./mapAnalyzerItems.js";

const item = (gender, size = "M") => ({
  school: "測試學校",
  item: "校服",
  gender,
  size,
  unitPrice: 100,
  source: { sheet: "冬季", cell: "A1", blockId: "auto-1" },
});

test("maps parser gender onto imported rows for new products", () => {
  const { rows, genderByName } = mapAnalyzerItems([item("男")]);

  assert.equal(rows[0].gender, "boys");
  assert.equal(rows[0]["分析區塊"], "auto-1");
  assert.equal(genderByName.get("測試學校 校服"), "boys");
});

test("merges styles listed for both boys and girls as unisex", () => {
  const { rows, genderByName } = mapAnalyzerItems([item("男", "S"), item("女", "M")]);

  assert.deepEqual(rows.map((row) => row.gender), ["unisex", "unisex"]);
  assert.equal(genderByName.get("測試學校 校服"), "unisex");
});

test("maps unknown and unisex labels to the supported unisex value", () => {
  const { rows } = mapAnalyzerItems([item(undefined), item("男女生", "L")]);

  assert.deepEqual(rows.map((row) => row.gender), ["unisex", "unisex"]);
});

test("preserves the tailored flag for expanded sizes through the import mapper", () => {
  const { rows } = mapAnalyzerItems([{
    ...item("女", "領16.5／上圍32-38吋"),
    tailored: true,
  }]);

  assert.equal(rows[0].isTailored, true);
  assert.equal(rows[0]["是否裁碼"], "是");
});

test("does not import bundle prices while preserving the single-unit price", () => {
  const { rows } = mapAnalyzerItems([{
    ...item("男"),
    unitPrice: 50,
    bundles: [{ qty: 2, unit: "件", price: 90 }],
  }]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]["價錢"], 50);
  assert.equal("bundles" in rows[0], false);
});

test("separates blocking parser errors from review warnings", () => {
  const result = splitAnalyzerWarnings([
    { severity: "error", message: "價格讀取失敗" },
    { severity: "warn", message: "組合價不一致" },
    { severity: "info", message: "已展開裁碼" },
  ]);

  assert.deepEqual(result.errors, ["價格讀取失敗"]);
  assert.deepEqual(result.conversionWarnings, ["組合價不一致", "已展開裁碼"]);
});
