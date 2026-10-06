import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { analyzePriceWorkbook } from "./uniform-import-analyzer.ts";

const layout = {
  sheet: "Sheet1",
  school: "英皇書院同學會小學第二校",
  season: "冬",
  blocks: [{
    id: "shirt",
    name: "白色長袖恤衫",
    dataFirst: 3,
    dataLast: 3,
    sizeCol: "A",
    priceCols: [{ col: "B", kind: "unit" }],
  }],
};

const workbookBuffer = (schoolName) => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [`${schoolName} 冬季價目表`],
    ["尺碼", "單價"],
    ["M", 100],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
};

test("does not apply the Kings layout to another school's Sheet1", () => {
  const result = analyzePriceWorkbook(
    workbookBuffer("香港中國婦女會馮堯敬紀念中學"),
    [layout],
  );

  assert.equal(result.items.length, 0);
  assert.equal(result.warnings[0].code, "SCHOOL_LAYOUT_MISMATCH");
  assert.equal(result.warnings[0].severity, "error");
  assert.match(result.warnings[0].message, /馮堯敬紀念中學/);
  assert.match(result.warnings[0].message, /英皇書院同學會小學第二校/);
});

test("still applies a school layout when the workbook title matches it", () => {
  const result = analyzePriceWorkbook(
    workbookBuffer("英皇書院同學會小學第二校"),
    [layout],
  );

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].school, "英皇書院同學會小學第二校");
  assert.equal(result.items[0].unitPrice, 100);
  assert.equal(result.warnings.some((warning) => warning.code === "SCHOOL_LAYOUT_MISMATCH"), false);
});
