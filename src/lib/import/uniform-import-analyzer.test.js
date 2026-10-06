import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { analyzePriceWorkbook, parsePriceText } from "./uniform-import-analyzer.ts";
import { SCHOOL_LAYOUTS } from "./school-layouts.ts";

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

test("does not apply a school-specific layout when the workbook title has no school name", () => {
  const result = analyzePriceWorkbook(
    workbookBuffer("冬季校服價目表"),
    [layout],
  );

  assert.equal(result.items.length, 0);
  assert.equal(result.warnings[0].code, "SCHOOL_LAYOUT_MISMATCH");
  assert.equal(result.warnings[0].severity, "error");
  assert.match(result.warnings[0].message, /無法從 Excel 標題辨識學校/);
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

test("parses the currency amount when a size appears before the price", () => {
  assert.equal(parsePriceText("38寸以上$60"), 60);
  assert.equal(parsePriceText("$44/3對"), 44);
});

test("detects a school title in row four and reads cells from a non-A1 range", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = {};
  XLSX.utils.sheet_add_aoa(sheet, [["香港中國婦女會馮堯敬紀念中學 夏季價目表"]], { origin: "F4" });
  XLSX.utils.sheet_add_aoa(sheet, [
    ["白裙", "", "", "", "2條"],
    ["33", "", "", "87", "174"],
  ], { origin: "B7" });
  XLSX.utils.sheet_add_aoa(sheet, [[23, 76, 152]], { origin: "G8" });
  XLSX.utils.sheet_add_aoa(sheet, [["黑皮帶 $50"], ["38寸以上$60"]], { origin: "J19" });
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");

  const fungLayout = SCHOOL_LAYOUTS.find((candidate) => candidate.school === "香港中國婦女會馮堯敬紀念中學");
  assert.ok(fungLayout);
  const result = analyzePriceWorkbook(
    XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    [fungLayout],
  );

  assert.equal(result.school, "香港中國婦女會馮堯敬紀念中學");
  assert.equal(result.items[0].item, "白裙");
  assert.equal(result.items[0].size, "33");
  assert.equal(result.items[0].unitPrice, 87);
  assert.deepEqual(result.items[0].bundles, [{ qty: 2, unit: "條", price: 174 }]);
  assert.equal(result.items.find((item) => item.item === "黑皮帶")?.unitPrice, 50);
  assert.equal(result.items.find((item) => item.item === "黑皮帶（38寸以上）")?.unitPrice, 60);
  assert.equal(result.items.find((item) => item.size === "腰23／33-38.5寸")?.unitPrice, 76);
  assert.equal(result.items.find((item) => item.size === "腰23／43寸或以上")?.unitPrice, 106);
  assert.equal(result.warnings.some((warning) => warning.code === "SCHOOL_LAYOUT_MISMATCH"), false);
});

test("uses generic detection for an unconfigured school without borrowing another school's layout", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["新學校中學 夏季價目表"],
    ["白恤衫", "尺碼", "單價"],
    ["", "S", 80],
    ["", "M", 90],
    ["", "L", 100],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");

  const result = analyzePriceWorkbook(
    XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    [layout],
    { strict: false, fallbackSchool: "新學校中學" },
  );

  assert.equal(result.genericMode, true);
  assert.ok(result.items.length > 0);
  assert.ok(result.items.every((item) => item.school === "新學校中學"));
  assert.ok(result.warnings.some((warning) => warning.code === "SCHOOL_LAYOUT_MISMATCH" && warning.severity === "warn"));
  assert.ok(result.warnings.some((warning) => warning.code === "GENERIC_LAYOUT" && warning.severity === "warn"));
  assert.equal(result.items.some((item) => item.school === layout.school), false);
});

test("rejects generic detection without a recognized or selected school", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["白恤衫", "尺碼", "單價"],
    ["", "S", 80],
    ["", "M", 90],
    ["", "L", 100],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Products");

  const result = analyzePriceWorkbook(
    XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    [],
    { strict: false },
  );

  assert.equal(result.items.length, 0);
  assert.ok(result.warnings.some((warning) => warning.code === "SCHOOL_NOT_IDENTIFIED" && warning.severity === "error"));
});
