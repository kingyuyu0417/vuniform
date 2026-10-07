import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { analyzePriceWorkbook, parsePackagedSizePrice, parsePriceText } from "./uniform-import-analyzer.ts";
import { SCHOOL_LAYOUTS } from "./school-layouts.ts";
import { mapAnalyzerItems } from "./mapAnalyzerItems.js";

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

const fixtureBuffer = async (name) => {
  const file = await readFile(new URL(`./fixtures/${name}`, import.meta.url));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
};

const renameSheet = (buffer, newName) => {
  const workbook = XLSX.read(buffer, { type: "array" });
  const oldName = workbook.SheetNames[0];
  const renamedWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(renamedWorkbook, workbook.Sheets[oldName], newName);
  return XLSX.write(renamedWorkbook, { type: "array", bookType: "xlsx" });
};

const normalizedItems = (items) => items.map(({ source, ...item }) => ({
  ...item,
  source: { ...source, sheet: "" },
}));

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

test("parses supported package prices as size labels without treating bundle discounts as packages", () => {
  assert.deepEqual(
    ["對", "隻", "包", "盒"].map((unit) => parsePackagedSizePrice(`$44/3${unit}`)),
    [
      { size: "3對裝", price: 44 },
      { size: "3隻裝", price: 44 },
      { size: "3包裝", price: 44 },
      { size: "3盒裝", price: 44 },
    ],
  );
  assert.equal(parsePackagedSizePrice("2件 $88"), null);
  assert.equal(parsePackagedSizePrice("2條 $152"), null);
});

test("keeps Fung Yiu King package product names unchanged and maps package specs to sizes", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = {};
  XLSX.utils.sheet_add_aoa(sheet, [["香港中國婦女會馮堯敬紀念中學 夏季價目表"]], { origin: "F4" });
  XLSX.utils.sheet_add_aoa(sheet, [["$44/3對"], ["$80/6對"]], { origin: "E37" });
  XLSX.utils.sheet_add_aoa(sheet, [["$140/12對"]], { origin: "B39" });
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");

  const fungLayout = SCHOOL_LAYOUTS.find((candidate) => candidate.school === "香港中國婦女會馮堯敬紀念中學");
  assert.ok(fungLayout);
  const result = analyzePriceWorkbook(
    XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    [{ ...fungLayout, signature: undefined }],
  );
  const socks = result.items.filter((item) => item.source.blockId?.startsWith("white-socks-"));

  assert.deepEqual(socks.map(({ item, size, unitPrice }) => [item, size, unitPrice]), [
    ["白短襪", "3對裝", 44],
    ["白短襪", "6對裝", 80],
    ["白短襪", "12對裝", 140],
  ]);
  assert.deepEqual(
    mapAnalyzerItems(socks).rows.map((row) => [row["款式名稱"], row["尺碼"], row["價錢"]]),
    [
      ["白短襪", "3對裝", 44],
      ["白短襪", "6對裝", 80],
      ["白短襪", "12對裝", 140],
    ],
  );
  assert.equal(result.warnings.some((warning) => warning.code === "PACKAGED_SIZE_PARSE_FAIL"), false);
});

test("does not import a bundle discount as a Fung Yiu King package size", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = {};
  XLSX.utils.sheet_add_aoa(sheet, [["香港中國婦女會馮堯敬紀念中學 夏季價目表"]], { origin: "F4" });
  XLSX.utils.sheet_add_aoa(sheet, [["2件 $88"]], { origin: "E37" });
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const fungLayout = SCHOOL_LAYOUTS.find((candidate) => candidate.school === "香港中國婦女會馮堯敬紀念中學");
  assert.ok(fungLayout);

  const result = analyzePriceWorkbook(
    XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    [{ ...fungLayout, signature: undefined }],
  );

  assert.equal(result.items.some((item) => item.source.blockId === "white-socks-3-pair"), false);
  assert.ok(result.warnings.some((warning) => (
    warning.code === "PACKAGED_SIZE_PARSE_FAIL" && warning.severity === "error"
  )));
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
    [{ ...fungLayout, signature: undefined }],
  );

  assert.equal(result.school, "香港中國婦女會馮堯敬紀念中學");
  assert.equal(result.items[0].item, "白裙");
  assert.equal(result.items[0].size, "33");
  assert.equal(result.items[0].unitPrice, 87);
  assert.deepEqual(result.items[0].bundles, [{ qty: 2, unit: "條", price: 174 }]);
  assert.equal(result.items.find((item) => item.item === "黑皮帶")?.unitPrice, 50);
  assert.equal(result.items.find((item) => item.item === "黑皮帶（38寸以上）")?.unitPrice, 60);
  assert.deepEqual(
    ["33寸", "34寸", "35寸", "36寸", "37寸", "38.5寸"].map((length) => (
      result.items.find((item) => item.size === `腰23／${length}`)?.unitPrice
    )),
    [76, 76, 76, 76, 76, 76],
  );
  assert.equal(result.items.find((item) => item.size === "腰23／43寸")?.unitPrice, 106);
  assert.equal(result.items.find((item) => item.size === "腰23／44寸")?.unitPrice, 106);
  assert.equal(result.items.some((item) => item.size?.includes("或以上")), false);
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
  assert.equal(result.suggestedLayouts.length, 1);
  assert.ok(result.suggestedLayouts[0].signature);
});

test("reuses a learned layout only when worksheet labels and structure are unchanged", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["新學校中學 夏季價目表"],
    ["白恤衫", "尺碼", "單價"],
    ["", "S", 80],
    ["", "M", 90],
    ["", "L", 100],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const learned = analyzePriceWorkbook(buffer, [], {
    strict: false,
    fallbackSchool: "新學校中學",
  }).suggestedLayouts;

  const reused = analyzePriceWorkbook(buffer, learned, {
    strict: false,
    fallbackSchool: "新學校中學",
  });
  assert.equal(reused.genericMode, false);
  assert.equal(reused.learnedMode, true);
  assert.equal(reused.items.length, 3);
  assert.ok(reused.warnings.some((warning) => warning.code === "LEARNED_LAYOUT_REUSED"));

  XLSX.utils.sheet_add_aoa(sheet, [[85]], { origin: "C3" });
  const repricedBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const repriced = analyzePriceWorkbook(repricedBuffer, learned, {
    strict: false,
    fallbackSchool: "新學校中學",
  });
  assert.equal(repriced.learnedMode, true);
  assert.equal(repriced.items[0].unitPrice, 85);

  XLSX.utils.sheet_add_aoa(sheet, [["白制服"]], { origin: "A2" });
  const changedBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const changed = analyzePriceWorkbook(changedBuffer, learned, {
    strict: false,
    fallbackSchool: "新學校中學",
  });
  assert.equal(changed.genericMode, true);
  assert.equal(changed.learnedMode, false);
  assert.ok(changed.warnings.some((warning) => warning.code === "LEARNED_LAYOUT_CHANGED"));
  assert.equal(changed.items.length, 3);
  assert.equal(changed.items[0].item, "白制服");
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

test("matches verified real-school layouts after Excel copy suffixes without changing parsed items", async () => {
  const fixtures = [
    { file: "anthony-winter-2026.xlsx", school: "聖安多尼學校", count: 100 },
    { file: "ymca-winter-2026.xlsx", school: "港青基信書院", count: 259 },
    { file: "fung-yiu-king-summer.xlsx", school: "香港中國婦女會馮堯敬紀念中學", count: 318 },
  ];

  for (const fixture of fixtures) {
    const buffer = await fixtureBuffer(fixture.file);
    const workbook = XLSX.read(buffer, { type: "array" });
    const sourceSheet = workbook.SheetNames[0];
    const layout = SCHOOL_LAYOUTS.find((candidate) => candidate.school === fixture.school);
    assert.ok(layout?.signature, `${fixture.school} layout has a verified structure signature`);

    const original = analyzePriceWorkbook(buffer, [layout], { strict: false });
    assert.equal(original.genericMode, false);
    assert.equal(original.items.length, fixture.count);

    const normalizedBuffer = renameSheet(buffer, sourceSheet);
    const inferred = analyzePriceWorkbook(normalizedBuffer, [], { strict: false });
    const roundTrippedLayout = {
      ...layout,
      signature: inferred.suggestedLayouts.find((candidate) => candidate.sheet === sourceSheet)?.signature,
    };
    assert.ok(roundTrippedLayout.signature);
    const roundTrippedOriginal = analyzePriceWorkbook(
      normalizedBuffer,
      [roundTrippedLayout],
      { strict: false },
    );
    const copied = analyzePriceWorkbook(
      renameSheet(buffer, `${sourceSheet} (2)`),
      [roundTrippedLayout],
      { strict: false },
    );
    assert.equal(copied.genericMode, false);
    assert.equal(copied.learnedMode, false);
    assert.equal(copied.items.length, roundTrippedOriginal.items.length);
    assert.deepEqual(normalizedItems(copied.items), normalizedItems(roundTrippedOriginal.items));
    assert.equal(copied.warnings.some((warning) => warning.code === "COPY_LAYOUT_CHANGED"), false);
  }
});

test("expands Fung Yiu King tailored trouser and shirt sizes across their price dimensions", async () => {
  const result = analyzePriceWorkbook(
    await fixtureBuffer("fung-yiu-king-summer.xlsx"),
    SCHOOL_LAYOUTS,
    { strict: false },
  );
  const trousers = result.items.filter((item) => item.source.blockId === "summer-trousers" && item.tailored);
  const shirts = result.items.filter((item) => item.source.blockId === "point-collar-shirt" && item.tailored);
  const mappedTailored = mapAnalyzerItems([...trousers, ...shirts]).rows.filter((row) => row.isTailored);

  assert.equal(trousers.length, 9 * 10);
  assert.equal(shirts.length, 10 * 4);
  assert.equal(mappedTailored.length, trousers.length + shirts.length);
  assert.equal(trousers.some((item) => item.size === "裁碼"), false);
  assert.equal(shirts.some((item) => item.size === "裁碼"), false);
  assert.deepEqual(
    ["33寸", "34寸", "35寸", "36寸", "37寸", "38.5寸"].map((length) => (
      trousers.find((item) => item.size === `腰32／${length}`)?.unitPrice
    )),
    [134, 134, 134, 134, 134, 134],
  );
  assert.deepEqual(
    [trousers.find((item) => item.size === "腰32／33寸")?.unitPrice,
      trousers.find((item) => item.size === "腰32／40寸")?.unitPrice],
    [134, 144],
  );
  assert.deepEqual(
    [shirts.find((item) => item.size === "領16.5／上圍32-38吋")?.unitPrice,
      shirts.find((item) => item.size === "領16.5／上圍40吋")?.unitPrice],
    [94, 104],
  );
});

test("uses the verified YMCA layout for the exact real workbook named with (2)", async () => {
  const original = analyzePriceWorkbook(
    await fixtureBuffer("ymca-winter-2026.xlsx"),
    SCHOOL_LAYOUTS,
    { strict: false },
  );
  const copied = analyzePriceWorkbook(
    await fixtureBuffer("ymca-winter-2026-copy.xlsx"),
    SCHOOL_LAYOUTS,
    { strict: false },
  );

  assert.equal(copied.genericMode, false);
  assert.equal(copied.items.length, 259);
  assert.deepEqual(
    ["43寸", "44寸"].map((length) => (
      original.items.find((item) => item.source.blockId === "m-trousers" && item.size === `腰23／${length}`)?.unitPrice
    )),
    [123, 123],
  );
  assert.deepEqual(normalizedItems(copied.items), normalizedItems(original.items));
  assert.equal(copied.warnings.some((warning) => warning.code === "COPY_LAYOUT_CHANGED"), false);
});

test("falls back to generic parsing when a copied sheet no longer matches its verified signature", async () => {
  const buffer = await fixtureBuffer("ymca-winter-2026.xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const oldName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[oldName], { header: 1, defval: "" });
  const changedSheet = XLSX.utils.aoa_to_sheet(rows.map((row) => row.filter((_, index) => index !== 1)));
  const changedWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(changedWorkbook, changedSheet, `${oldName} (2)`);
  const changedBuffer = XLSX.write(changedWorkbook, { type: "array", bookType: "xlsx" });
  const layout = SCHOOL_LAYOUTS.find((candidate) => candidate.school === "港青基信書院");

  const result = analyzePriceWorkbook(changedBuffer, [layout], {
    strict: false,
    fallbackSchool: "港青基信書院",
  });

  assert.equal(result.genericMode, true);
  assert.ok(result.warnings.some((warning) => warning.code === "COPY_LAYOUT_CHANGED"));
});

test("normalizes the supported Excel copy suffix variants", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["測試中學 夏季價目表"],
    ["白恤衫", "尺碼", "單價"],
    ["", "S", 80],
    ["", "M", 90],
    ["", "L", 100],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const source = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const normalized = renameSheet(source, "Sheet1");
  const suggested = analyzePriceWorkbook(normalized, [], {
    strict: false,
    fallbackSchool: "測試中學",
  }).suggestedLayouts;
  const baseline = analyzePriceWorkbook(normalized, suggested, {
    strict: false,
    fallbackSchool: "測試中學",
  });

  for (const suffix of [" (2)", " (3)", " - 複本", " (副本)", "_copy", "_COPY"]) {
    const copied = analyzePriceWorkbook(
      renameSheet(source, `Sheet1${suffix}`),
      suggested,
      { strict: false, fallbackSchool: "測試中學" },
    );
    assert.equal(copied.genericMode, false, suffix);
    assert.deepEqual(normalizedItems(copied.items), normalizedItems(baseline.items), suffix);
    assert.equal(copied.warnings.some((warning) => warning.code === "COPY_LAYOUT_CHANGED"), false, suffix);
  }
});

test("scores product labels, keeps unit prices, and tags each generic block", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["測試中學 夏季價目表"],
    ["白恤衫"],
    ["", "尺碼", "單價", "2件價"],
    ["", "S", 32, 60],
    ["", "M", 34, 64],
    ["", "L", 36, 68],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");

  const result = analyzePriceWorkbook(
    XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    [],
    { strict: false, fallbackSchool: "測試中學" },
  );
  const mapped = mapAnalyzerItems(result.items);

  assert.equal(result.genericMode, true);
  assert.deepEqual(result.items.map((entry) => [entry.item, entry.size, entry.unitPrice]), [
    ["白恤衫", "S", 32],
    ["白恤衫", "M", 34],
    ["白恤衫", "L", 36],
  ]);
  assert.ok(result.items.every((entry) => entry.source.blockId));
  assert.deepEqual(mapped.rows.map((row) => row["價錢"]), [32, 34, 36]);
  assert.ok(mapped.rows.every((row) => row["分析區塊"]));
});

test("expands inch size ranges for schools without a dedicated layout", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["新學校中學 夏季價目表"],
    ["白長褲"],
    ["款式", "尺碼", "單價"],
    ["", "33-38.5吋", 76],
    ["", "40吋", 86],
    ["", "41.5吋", 96],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");

  const result = analyzePriceWorkbook(
    XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    [],
    { strict: false, fallbackSchool: "新學校中學" },
  );

  assert.equal(result.genericMode, true);
  assert.deepEqual(
    result.items.map((item) => [item.size, item.unitPrice]),
    [
      ["33吋", 76],
      ["34吋", 76],
      ["35吋", 76],
      ["36吋", 76],
      ["37吋", 76],
      ["38.5吋", 76],
      ["40吋", 86],
      ["41.5吋", 96],
    ],
  );
  assert.ok(result.warnings.some((warning) => warning.code === "GENERIC_LAYOUT"));
});

test("does not treat surcharge notes as product names and asks for preview review", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["測試中學 夏季價目表"],
    ["褲長33-38.5吋長同價"],
    ["校褲", "尺碼", "單價"],
    ["校褲", "S", 40],
    ["", "M", 45],
    ["", "L", 50],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");

  const result = analyzePriceWorkbook(
    XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    [],
    { strict: false, fallbackSchool: "測試中學" },
  );

  assert.ok(result.items.length > 0);
  assert.ok(result.items.every((entry) => !/褲長|吋|同價|加\s*\$/.test(entry.item)));
  assert.ok(result.warnings.some((warning) => warning.code === "SURCHARGE_REVIEW"));
});

test("reports ambiguous numeric-only size and price columns instead of guessing", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["測試中學 夏季價目表"],
    ["運動短褲"],
    ["", 30, 31],
    ["", 32, 33],
    ["", 34, 35],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");

  const result = analyzePriceWorkbook(
    XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    [],
    { strict: false, fallbackSchool: "測試中學" },
  );

  assert.equal(result.items.length, 0);
  assert.ok(result.warnings.some((warning) => warning.code === "NUMERIC_COLUMN_AMBIGUOUS"));
});

test("generic review of the real summer sheet never promotes surcharge text to a product", async () => {
  const buffer = await fixtureBuffer("fung-yiu-king-summer.xlsx");
  const result = analyzePriceWorkbook(buffer, [], {
    strict: false,
    fallbackSchool: "香港中國婦女會馮堯敬紀念中學",
  });
  const names = result.items.map((entry) => entry.item);
  const skirt = result.items.find((entry) => entry.item === "白裙" && entry.size === "33");
  const importedSkirtRows = mapAnalyzerItems(skirt ? [skirt] : []).rows;

  assert.equal(skirt?.unitPrice, 87);
  assert.deepEqual(skirt?.bundles, [{ qty: 2, unit: "條", price: 174 }]);
  assert.deepEqual(importedSkirtRows.map((row) => row["價錢"]), [87]);
  assert.ok(names.includes("白長西褲"));
  assert.ok(names.includes("白尖領恤"));
  assert.ok(names.every((name) => !/加\s*\$|或以上|同價|吋|褲長/.test(name)));
  assert.ok(result.warnings.some((warning) => warning.code === "SURCHARGE_REVIEW"));
  assert.ok(result.items.every((entry) => entry.source.blockId));
});

test("keeps the winter set and its single garment options as separate products", async () => {
  const result = analyzePriceWorkbook(
    await fixtureBuffer("ymca-winter-2026.xlsx"),
    SCHOOL_LAYOUTS,
    { strict: false },
  );
  const names = new Set(result.items.map((entry) => entry.item));

  assert.ok(names.has("運動套裝（外套及長褲）"));
  assert.ok(names.has("運動套裝（單件：外套／長褲）"));
});
