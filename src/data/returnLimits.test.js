import test from "node:test";
import assert from "node:assert/strict";
import { getRemainingReturnQuantity, hasUntrackedExchangeHistory } from "./returnLimits.js";

test("computes the remaining returnable quantity across linked adjustments", () => {
  const sourceItem = { id: 21, qty: 5 };
  const orders = [
    { items: [{ exchangeReturn: true, sourceOrderItemId: "21", qty: 2 }] },
    { items: [{ exchangeReturn: true, sourceOrderItemId: 21, qty: 1 }] },
  ];

  assert.equal(getRemainingReturnQuantity(sourceItem, orders), 2);
});

test("does not count returns from voided adjustments", () => {
  const sourceItem = { id: 21, qty: 2 };

  assert.equal(getRemainingReturnQuantity(sourceItem, [
    { voidedAt: "2026-10-07T10:00:00Z", items: [{ exchangeReturn: true, sourceOrderItemId: "21", qty: 2 }] },
  ]), 2);
});

test("does not allow returns without a source item reference", () => {
  assert.equal(getRemainingReturnQuantity({ qty: 3 }, []), 0);
  assert.equal(getRemainingReturnQuantity({ id: "undefined", qty: 3 }, []), 0);
  assert.equal(getRemainingReturnQuantity({ id: "null", qty: 3 }, []), 0);
  assert.equal(getRemainingReturnQuantity({ id: 21, qty: 3, exchangeReturn: true }, []), 0);
});

test("never returns a negative available quantity", () => {
  assert.equal(getRemainingReturnQuantity({ id: 21, qty: 1 }, [
    { items: [{ exchangeReturn: true, sourceOrderItemId: "21", qty: 3 }] },
  ]), 0);
});

test("blocks additional returns when legacy linked exchange history has no item-level return data", () => {
  const originalOrder = { id: "receipt-1", items: [{ id: 21, qty: 2 }] };
  const orders = [
    originalOrder,
    { id: "receipt-2", exchangeSourceReceiptId: "receipt-1", items: [{ name: "校裙", qty: 1 }] },
  ];

  assert.equal(hasUntrackedExchangeHistory(originalOrder, orders), true);
  assert.equal(getRemainingReturnQuantity(originalOrder.items[0], orders), 0);
});
