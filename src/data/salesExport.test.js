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
  assert.equal(items[1][11], 200);
  assert.equal(items[3][2], "已作廢");
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

test("creates a readable multi-sheet Excel workbook with filters", () => {
  const workbook = createSalesExportWorkbook(XLSX, [{
    id: "receipt-1",
    date: "2026-09-24",
    school: "測試學校",
    total: 100,
    itemCount: 1,
    items: [{ name: "恤衫", size: "M", price: 100, qty: 1 }],
  }]);
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const reopened = XLSX.read(output, { type: "array" });

  assert.deepEqual(reopened.SheetNames, ["閱讀指引", "總覽", "收市對數", "訂單", "商品明細", "按學校", "按門店", "按員工", "商品分析"]);
  assert.equal(reopened.Sheets["訂單"]["!autofilter"].ref, "A1:R2");
  assert.equal(reopened.Sheets["商品明細"]["!autofilter"].ref, "A1:M2");
  assert.equal(reopened.Sheets["總覽"].B8.v, 100);
});
