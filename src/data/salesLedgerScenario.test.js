import test from "node:test";
import assert from "node:assert/strict";
import { clearCheckoutAttempt, getOrCreateCheckoutAttempt } from "./checkoutAttempt.js";
import { getRemainingReturnQuantity } from "./returnLimits.js";
import { findPossibleDuplicateSale, summarizeDailyCloseout } from "./salesCloseout.js";
import { buildSalesExportSheets } from "./salesExport.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test("keeps a checkout, partial exchange, final return, closeout, and void audit financially consistent", () => {
  const storage = createStorage();
  const original = {
    id: "sale-1",
    date: "2026-10-08",
    time: "10:00",
    cashierId: "cashier-1",
    cashierName: "店員甲",
    school: "測試學校",
    total: 200,
    cashReceived: 220,
    changeDue: 20,
    itemCount: 2,
    items: [{ id: 101, name: "恤衫", size: "M", price: 100, qty: 2 }],
  };
  const checkoutKey = getOrCreateCheckoutAttempt(storage, original, () => "attempt-1");
  assert.equal(getOrCreateCheckoutAttempt(storage, original, () => "attempt-2"), checkoutKey);

  const exchange = {
    id: "exchange-1",
    date: "2026-10-08",
    time: "10:05",
    cashierId: "cashier-1",
    cashierName: "店員甲",
    school: "測試學校",
    total: 20,
    cashReceived: 20,
    changeDue: 0,
    itemCount: 2,
    exchangeSourceReceiptId: original.id,
    adjustmentReason: "尺碼不合",
    items: [
      { name: "恤衫", size: "M", price: 100, qty: 1, exchangeReturn: true, sourceOrderItemId: "101" },
      { name: "恤衫", size: "L", price: 120, qty: 1 },
    ],
  };
  const afterPartialExchange = [original, exchange];
  assert.equal(getRemainingReturnQuantity(original.items[0], afterPartialExchange), 1);

  const finalReturn = {
    id: "return-1",
    date: "2026-10-08",
    time: "10:10",
    cashierId: "cashier-1",
    cashierName: "店員甲",
    school: "測試學校",
    total: 0,
    refundDue: 100,
    refundMethod: "card",
    itemCount: 1,
    exchangeSourceReceiptId: original.id,
    adjustmentReason: "不合身退貨",
    items: [
      { name: "恤衫", size: "M", price: 100, qty: 1, exchangeReturn: true, sourceOrderItemId: "101" },
    ],
  };
  const completedOrders = [...afterPartialExchange, finalReturn];
  assert.equal(getRemainingReturnQuantity(original.items[0], completedOrders), 0);

  const closeout = summarizeDailyCloseout(completedOrders);
  assert.equal(closeout.salesAmount, 200);
  assert.equal(closeout.returnedGoodsAmount, 200);
  assert.equal(closeout.exchangeDifference, -80);
  assert.equal(closeout.netRevenue, 120);
  assert.equal(closeout.totalReceived, 220);
  assert.equal(closeout.totalRefunded, 100);
  assert.deepEqual(closeout.channels, {
    cash: { received: 220, refunded: 0 },
    card: { received: 0, refunded: 100 },
    transfer: { received: 0, refunded: 0 },
  });

  const sheets = buildSalesExportSheets(completedOrders);
  const overview = sheets.find((sheet) => sheet.name === "總覽").rows;
  assert.deepEqual(overview.slice(5, 8), [
    ["有效單據金額", 220],
    ["單據退款金額", 100],
    ["淨商品收入（整單替換按新單全額計）", 120],
  ]);
  const productRows = sheets.find((sheet) => sheet.name === "商品分析").rows;
  assert.deepEqual(productRows[1], ["恤衫", "L", "", 1, 0, 120, 0, 120]);
  assert.deepEqual(productRows[2], ["恤衫", "M", "", 2, 2, 200, 200, 0]);

  const voidedReturn = { ...finalReturn, voidedAt: "2026-10-08T10:15:00.000Z" };
  const afterVoid = [...afterPartialExchange, voidedReturn];
  assert.equal(getRemainingReturnQuantity(original.items[0], afterVoid), 1);
  const afterVoidCloseout = summarizeDailyCloseout(afterVoid);
  assert.equal(afterVoidCloseout.netRevenue, 220);
  assert.equal(afterVoidCloseout.totalRefunded, 0);

  clearCheckoutAttempt(storage, original.cashierId, checkoutKey);
});

test("re-running a full sale as an exchange counts only the difference, not a second full sale", () => {
  const original = {
    id: "sale-full",
    total: 220,
    cashReceived: 220,
    itemCount: 2,
    items: [
      { id: 201, name: "恤衫", size: "M", price: 100, qty: 1 },
      { id: 202, name: "長褲", size: "30", price: 120, qty: 1 },
    ],
  };
  const replacement = {
    id: "exchange-full",
    total: 40,
    cashReceived: 40,
    itemCount: 4,
    exchangeSourceReceiptId: original.id,
    adjustmentReason: "整單更正",
    items: [
      { name: "恤衫", size: "M", price: 100, qty: 1, exchangeReturn: true, sourceOrderItemId: "201" },
      { name: "長褲", size: "30", price: 120, qty: 1, exchangeReturn: true, sourceOrderItemId: "202" },
      { name: "恤衫", size: "L", price: 120, qty: 1 },
      { name: "長褲", size: "32", price: 140, qty: 1 },
    ],
  };

  assert.equal(getRemainingReturnQuantity(original.items[0], [original, replacement]), 0);
  assert.equal(getRemainingReturnQuantity(original.items[1], [original, replacement]), 0);
  assert.throws(() => {
    const sourceItem = original.items[0];
    if (1 > getRemainingReturnQuantity(sourceItem, [original, replacement])) {
      throw new Error("Return quantity exceeds the quantity remaining");
    }
  }, /Return quantity exceeds/);

  const closeout = summarizeDailyCloseout([original, replacement]);
  assert.equal(closeout.salesAmount, 220);
  assert.equal(closeout.returnedGoodsAmount, 220);
  assert.equal(closeout.exchangeDifference, 40);
  assert.equal(closeout.netRevenue, 260);
  assert.equal(closeout.totalReceived, 260);
});

test("flags close-in-time duplicate receipts and removes an accidental one only after voiding", () => {
  const original = {
    id: "receipt-0004",
    cashierId: "cashier-1",
    createdAt: "2026-09-24T10:00:00.000Z",
    total: 98,
    items: [{ name: "恤衫", size: "M", price: 98, qty: 1 }],
  };
  const candidate = {
    ...original,
    id: "receipt-0005",
    createdAt: "2026-09-24T10:01:00.000Z",
  };

  assert.equal(findPossibleDuplicateSale(candidate, [original]), original);
  assert.equal(summarizeDailyCloseout([original, candidate]).netRevenue, 196);
  assert.equal(
    summarizeDailyCloseout([original, { ...candidate, voidedAt: "2026-09-24T10:02:00.000Z" }]).netRevenue,
    98,
  );
});
