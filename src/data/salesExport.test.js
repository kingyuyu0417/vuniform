import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { buildSalesExportSheets, createSalesExportWorkbook } from "./salesExport.js";

const findSheet = (sheets, name) => sheets.find((sheet) => sheet.name === name);

test("exports order amounts once per order and keeps item rows separate", () => {
  const sheets = buildSalesExportSheets([
    {
      id: "receipt-1",
      date: "2026-09-24",
      time: "10:00",
      school: "測試學校",
      outletName: "沙田店",
      cashierName: "店員甲",
      total: 300,
      refundDue: 20,
      itemCount: 3,
      items: [
        { name: "恤衫", size: "M", price: 100, qty: 2 },
        { name: "襪", size: "3對裝", price: 100, qty: 1 },
      ],
    },
    {
      id: "receipt-void",
      date: "2026-09-24",
      school: "測試學校",
      total: 500,
      itemCount: 1,
      voidedAt: "2026-09-24T11:00:00.000Z",
      items: [{ name: "已作廢商品", price: 500, qty: 1 }],
    },
  ], { scope: "2026-09-24" });

  const overview = findSheet(sheets, "總覽").rows;
  assert.deepEqual(overview.slice(2, 9), [
    ["符合篩選條件的單數", 2],
    ["有效單數", 1],
    ["已作廢單數", 1],
    ["有效單據金額", 300],
    ["單據退款金額", 20],
    ["淨收入", 280],
    ["有效單據件數", 3],
  ]);

  const orders = findSheet(sheets, "訂單").rows;
  assert.equal(orders.length, 3);
  assert.deepEqual(orders[1].slice(7, 11), [3, 300, 20, 280]);
  assert.deepEqual(orders[2].slice(7, 11), [1, 500, 0, 0]);
  assert.equal(orders[1][13], "現金");
  assert.equal(findSheet(sheets, "收市對數").rows[5][1], 300);

  const items = findSheet(sheets, "商品明細").rows;
  assert.equal(items.length, 4);
  assert.equal(items[0].includes("單據金額"), false);
  assert.equal(items[1][13], 200);
  assert.equal(items[3][2], "已作廢");

  const summary = findSheet(sheets, "摘要").rows;
  assert.deepEqual(summary[3], ["當日總收入（已扣單據退款）", 280]);
  assert.deepEqual(summary[9], ["款式", "尺碼", "長度", "售出件數", "退回件數", "淨售件數"]);
  assert.deepEqual(summary.slice(10), [
    ["恤衫", "M", "", 2, 0, 2],
    ["襪", "3對裝", "", 1, 0, 1],
  ]);
});

test("exports bundle price, discount, and net item amount for promotion auditing", () => {
  const itemRows = findSheet(buildSalesExportSheets([{
    date: "2026-09-24",
    total: 73,
    itemCount: 2,
    items: [{
      name: "長袖底衫",
      size: "20-24",
      price: 40,
      qty: 2,
      twoPiecePrice: 73,
      discountAmount: 7,
    }],
  }]), "商品明細").rows;

  assert.deepEqual(itemRows[0].slice(9), [
    "數量",
    "單價",
    "兩件優惠總價",
    "優惠減免",
    "商品小計",
    "退回標記",
  ]);
  assert.deepEqual(itemRows[1].slice(9), [2, 40, 73, 7, 73, "無退回標記"]);
});

test("groups by school, outlet, cashier, and item without counting voided sales", () => {
  const sheets = buildSalesExportSheets([
    {
      school: "學校甲",
      outletName: "分店甲",
      cashierName: "店員甲",
      total: 200,
      itemCount: 2,
      items: [
        { name: "恤衫", size: "M", price: 100, qty: 2 },
        { name: "恤衫", size: "M", price: 100, qty: 1, exchangeReturn: true },
      ],
    },
    {
      school: "學校甲",
      outletName: "分店甲",
      cashierName: "店員甲",
      total: 300,
      itemCount: 3,
      voidedAt: "2026-09-24",
      items: [{ name: "恤衫", size: "M", price: 300, qty: 1 }],
    },
  ], { outletForOrder: (order) => order.outletName });

  assert.deepEqual(findSheet(sheets, "按學校").rows[1], ["學校甲", 1, 2, 200, 0, 200]);
  assert.deepEqual(findSheet(sheets, "按門店").rows[1], ["分店甲", 1, 2, 200, 0, 200]);
  assert.deepEqual(findSheet(sheets, "按員工").rows[1], ["店員甲", 1, 2, 200, 0, 200]);
  assert.deepEqual(findSheet(sheets, "商品分析").rows[1], ["恤衫", "M", "", 2, 1, 200, 100, 100]);
  assert.deepEqual(findSheet(sheets, "摘要").rows[10], ["恤衫", "M", "", 2, 1, 1]);
});

test("keeps replacement revenue at the new full total while exporting only the refund difference", () => {
  const sheets = buildSalesExportSheets([
    { id: "old-receipt", date: "2026-09-24", total: 100, cashReceived: 100, voidedAt: "2026-09-25" },
    {
      id: "replacement-receipt",
      date: "2026-09-25",
      total: 60,
      refundDue: 40,
      refundMethod: "cash",
      replacementSourceReceiptId: "old-receipt",
      settlementDelta: -40,
      itemCount: 1,
      items: [{ name: "恤衫", size: "M", price: 60, qty: 1 }],
    },
  ]);

  const overview = findSheet(sheets, "總覽").rows;
  assert.equal(overview[5][1], 60);
  assert.equal(overview[6][1], 40);
  assert.equal(overview[7][1], 60);
  assert.equal(findSheet(sheets, "收市對數").rows[5][1], 100);
  assert.equal(findSheet(sheets, "收市對數").rows[6][1], 40);
});

test("exports receiptless exchanges as adjustments without inventing a source receipt", () => {
  const sheets = buildSalesExportSheets([{
    id: "receiptless-exchange",
    date: "2026-09-24",
    total: 30,
    cashReceived: 30,
    untrackedExchange: true,
    adjustmentReason: "更換款式",
    itemCount: 2,
    items: [
      { name: "恤衫", size: "M", price: 100, qty: 1, exchangeReturn: true },
      { name: "長褲", size: "30", price: 130, qty: 1 },
    ],
  }]);

  const orderRow = findSheet(sheets, "訂單").rows[1];
  assert.equal(orderRow[3], "無原單退換");
  assert.equal(orderRow[11], "");
  assert.equal(orderRow[10], 30);
  assert.equal(findSheet(sheets, "收市對數").rows[3][1], 30);
});

test("calculates daily operating ratios and gender mix from item-level catalog categories", () => {
  const sheets = buildSalesExportSheets([
    {
      date: "2026-09-24",
      total: 250,
      cashReceived: 250,
      itemCount: 6,
      items: [
        { name: "男生恤衫", gender: "boys", size: "M", price: 50, qty: 2 },
        { name: "女生校裙", gender: "girls", size: "S", price: 100, qty: 1 },
        { name: "男女生襪", gender: "unisex", size: "3對裝", price: 10, qty: 2 },
        { name: "未分類領帶", size: "M", price: 30, qty: 1 },
      ],
    },
    {
      date: "2026-09-24",
      total: 0,
      itemCount: 1,
      untrackedExchange: true,
      adjustmentReason: "商品退回",
      items: [{ name: "女生校裙", gender: "girls", size: "S", price: 100, qty: 1, exchangeReturn: true }],
    },
  ], { genderForItem: (_order, item) => item.gender });

  const analysis = findSheet(sheets, "比例分析").rows;
  assert.equal(analysis[3][1], 250);
  assert.equal(analysis[5][1], 125);
  assert.equal(analysis[6][1], 6);
  assert.equal(analysis[7][1], 1);
  assert.equal(analysis[8][1], 3);
  assert.equal(analysis[9][1], 1 / 7);
  assert.deepEqual(analysis.slice(12, 16), [
    ["男生", 2, 2 / 6, 2 / 3, 100, 100 / 250, 0],
    ["女生", 1, 1 / 6, 1 / 3, 100, 100 / 250, 1],
    ["男女生", 2, 2 / 6, null, 20, 20 / 250, 0],
    ["未分類", 1, 1 / 6, null, 30, 30 / 250, 0],
  ]);
  assert.deepEqual(analysis[21], ["總計", 250, 1, 0, null]);
  assert.equal(analysis.some((row) => row[0] === "男／女商品件數比例" && row[1].includes("女生 1 件")), true);
});

test("creates a readable multi-sheet Excel workbook with filters", () => {
  const workbook = createSalesExportWorkbook(XLSX, [{
    id: "receipt-1",
    date: "2026-09-24",
    school: "測試學校",
    total: 100,
    itemCount: 1,
    items: [{ name: "恤衫", size: "M", price: 100, qty: 1 }],
  }], { reportDateRange: "2026-09-20 至 2026-09-30" });
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const reopened = XLSX.read(output, { type: "array" });

  assert.deepEqual(reopened.SheetNames, ["摘要", "比例分析", "閱讀指引", "總覽", "收市對數", "訂單", "商品明細", "按學校", "按門店", "按員工", "商品分析"]);
  assert.equal(reopened.Sheets["訂單"]["!autofilter"].ref, "A1:R2");
  assert.equal(reopened.Sheets["商品明細"]["!autofilter"].ref, "A1:O2");
  assert.equal(reopened.Sheets["總覽"].B8.v, 100);
  assert.equal(reopened.Sheets["摘要"]["!autofilter"].ref, "A10:F11");
  assert.equal(reopened.Sheets["摘要"].B2.v, "2026-09-20 至 2026-09-30");
  assert.equal(reopened.Sheets["總覽"].B2.v, "2026-09-20 至 2026-09-30");
  assert.equal(reopened.Sheets["摘要"].B4.v, 100);
  assert.deepEqual([reopened.Sheets["摘要"].A11.v, reopened.Sheets["摘要"].B11.v, reopened.Sheets["摘要"].D11.v], ["恤衫", "M", 1]);
  assert.equal(workbook.Sheets["比例分析"].B4.z, "$#,##0.00");
  assert.equal(workbook.Sheets["比例分析"].B10.z, "0.0%");
  assert.equal(reopened.Sheets["比例分析"].B4.v, 100);
});
