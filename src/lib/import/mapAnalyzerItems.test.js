import test from "node:test";
import assert from "node:assert/strict";
import { mapAnalyzerItems, splitAnalyzerWarnings } from "./mapAnalyzerItems.js";

const item = (gender, size = "M") => ({
  school: "測試學校",
  item: "校服",
  gender,
  size,
  unitPrice: 100,
  source: { sheet: "冬季", cell: "A1" },
});

test("maps parser gender onto imported rows for new products", () => {
  const { rows, genderByName } = mapAnalyzerItems([item("男")]);

  assert.equal(rows[0].gender, "boys");
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

test("separates blocking parser errors from review warnings", () => {
  const result = splitAnalyzerWarnings([
    { severity: "error", message: "價格讀取失敗" },
    { severity: "warn", message: "組合價不一致" },
    { severity: "info", message: "已展開裁碼" },
  ]);

  assert.deepEqual(result.errors, ["價格讀取失敗"]);
  assert.deepEqual(result.conversionWarnings, ["組合價不一致", "已展開裁碼"]);
});
