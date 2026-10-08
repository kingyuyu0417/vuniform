import test from "node:test";
import assert from "node:assert/strict";
import { calculateCashSettlement, findPossibleDuplicateSale, summarizeDailyCloseout } from "./salesCloseout.js";

test("calculates cash change and outstanding amount without reversing the signs", () => {
  assert.deepEqual(calculateCashSettlement(80, 100), { changeDue: 20, shortfall: 0 });
  assert.deepEqual(calculateCashSettlement(80, 60), { changeDue: 0, shortfall: 20 });
  assert.deepEqual(calculateCashSettlement(-20, 0), { changeDue: 0, shortfall: 0 });
});

test("warns about the same cashier repeating an identical sale within two minutes", () => {
  const candidate = {
    cashierId: "staff-1",
    branchId: "branch-1",
    school: "學校甲",
    total: 120,
    createdAt: "2026-10-07T10:02:00.000Z",
    items: [{ name: "恤衫", size: "M", price: 120, qty: 1 }],
  };
  const previous = { ...candidate, id: "receipt-1", createdAt: "2026-10-07T10:00:30.000Z" };

  assert.equal(findPossibleDuplicateSale(candidate, [previous]), previous);
});

test("does not warn for another cashier, different basket, voided receipt, or older sale", () => {
  const candidate = {
    cashierId: "staff-1",
    branchId: "branch-1",
    school: "學校甲",
    total: 120,
    createdAt: "2026-10-07T10:02:00.000Z",
    items: [{ name: "恤衫", size: "M", price: 120, qty: 1 }],
  };
  const base = { ...candidate, id: "receipt-1", createdAt: "2026-10-07T10:00:30.000Z" };

  assert.equal(findPossibleDuplicateSale(candidate, [{ ...base, cashierId: "staff-2" }]), null);
  assert.equal(findPossibleDuplicateSale(candidate, [{ ...base, items: [{ ...base.items[0], qty: 2 }] }]), null);
  assert.equal(findPossibleDuplicateSale(candidate, [{ ...base, voidedAt: "2026-10-07T10:01:00.000Z" }]), null);
  assert.equal(findPossibleDuplicateSale(candidate, [{ ...base, createdAt: "2026-10-07T09:50:00.000Z" }]), null);
  assert.equal(findPossibleDuplicateSale({ ...candidate, cashierId: "" }, [base]), null);
});

test("summarizes net exchange differences and actual collections/refunds by channel", () => {
  const summary = summarizeDailyCloseout([
    {
      id: "sale-cash",
      total: 100,
      cashReceived: 120,
      changeDue: 20,
      items: [{ name: "恤衫", size: "M", qty: 1, price: 100 }],
    },
    {
      id: "sale-card",
      total: 200,
      paymentMethod: "card",
      items: [{ name: "長褲", size: "30", qty: 1, price: 200 }],
    },
    {
      id: "exchange-transfer",
      exchangeSourceReceiptId: "sale-card",
      total: 30,
      paymentMethod: "transfer",
      refundDue: 0,
      items: [{ name: "長褲", qty: 1, price: 200, exchangeReturn: true }, { name: "恤衫", qty: 1, price: 230 }],
    },
    {
      id: "exchange-refund",
      exchangeSourceReceiptId: "sale-cash",
      total: 0,
      refundDue: 40,
      refundMethod: "card",
      items: [{ name: "恤衫", qty: 1, price: 40, exchangeReturn: true }],
    },
    { id: "voided", total: 500, voidedAt: "2026-10-07T10:00:00Z" },
  ]);

  assert.deepEqual(summary, {
    salesAmount: 300,
    returnedGoodsAmount: 240,
    exchangeDifference: -10,
    netRevenue: 290,
    totalReceived: 330,
    totalRefunded: 40,
    untrackedReturnOrders: 0,
    channels: {
      cash: { received: 100, refunded: 0 },
      card: { received: 200, refunded: 40 },
      transfer: { received: 30, refunded: 0 },
    },
  });
});

test("falls back to cash for historical payment data and flags refunds without return details", () => {
  const summary = summarizeDailyCloseout([
    { id: "legacy-sale", total: 80, cashReceived: 100, changeDue: 20 },
    { id: "legacy-refund", total: 0, refundDue: 10, exchangeSourceReceiptId: "legacy-sale", items: [] },
  ]);

  assert.equal(summary.channels.cash.received, 80);
  assert.equal(summary.channels.cash.refunded, 10);
  assert.equal(summary.untrackedReturnOrders, 1);
  assert.equal(summary.netRevenue, 70);
});
