import test from "node:test";
import assert from "node:assert/strict";
import { clearCheckoutAttempt, getOrCreateCheckoutAttempt } from "./checkoutAttempt.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

const order = {
  cashierId: "cashier-1",
  school: "學校甲",
  customerName: "陳同學",
  customerPhone: "9123 4567",
  items: [{ name: "恤衫", size: "M", price: 100, qty: 1 }],
  total: 100,
  cashReceived: 100,
};

test("reuses the same key for an unchanged checkout retry", () => {
  const storage = createStorage();
  let generated = 0;
  const createId = () => `attempt-${++generated}`;

  assert.equal(getOrCreateCheckoutAttempt(storage, order, createId), "attempt-1");
  assert.equal(getOrCreateCheckoutAttempt(storage, { ...order, time: "later" }, createId), "attempt-1");
  assert.equal(generated, 1);
});

test("starts a new attempt when unresolved transaction details change", () => {
  const storage = createStorage();
  getOrCreateCheckoutAttempt(storage, order, () => "attempt-1");

  assert.equal(getOrCreateCheckoutAttempt(storage, { ...order, total: 200 }, () => "attempt-2"), "attempt-2");
  assert.equal(getOrCreateCheckoutAttempt(storage, { ...order, total: 200 }, () => "attempt-3"), "attempt-2");
});

test("reuses the pending replacement key when only its source branch is corrected", () => {
  const storage = createStorage();
  const replacement = { ...order, branchId: "staff-branch", replacementSourceReceiptId: "receipt-1" };
  getOrCreateCheckoutAttempt(storage, replacement, () => "attempt-1");

  assert.equal(
    getOrCreateCheckoutAttempt(storage, { ...replacement, branchId: "source-branch" }, () => "attempt-2"),
    "attempt-1",
  );
});

test("starts a new attempt when the exchange reason changes", () => {
  const storage = createStorage();
  const exchangeOrder = {
    ...order,
    exchangeSourceReceiptId: "receipt-1",
    adjustmentReason: "尺碼不合",
  };
  getOrCreateCheckoutAttempt(storage, exchangeOrder, () => "attempt-1");

  assert.equal(getOrCreateCheckoutAttempt(storage, { ...exchangeOrder, adjustmentReason: "更換款式" }, () => "attempt-2"), "attempt-2");
});

test("starts a distinct attempt for a receiptless exchange", () => {
  const storage = createStorage();
  const sale = { ...order, items: [{ name: "恤衫", size: "M", price: 100, qty: 1 }] };
  getOrCreateCheckoutAttempt(storage, sale, () => "sale-attempt");

  const exchange = {
    ...sale,
    untrackedExchange: true,
    adjustmentReason: "更換款式",
    items: [{ name: "恤衫", size: "M", price: 100, qty: 1, exchangeReturn: true }],
  };
  assert.equal(getOrCreateCheckoutAttempt(storage, exchange, () => "exchange-attempt"), "exchange-attempt");
});

test("starts a new attempt when the payment channel changes", () => {
  const storage = createStorage();
  getOrCreateCheckoutAttempt(storage, { ...order, paymentMethod: "cash" }, () => "attempt-1");

  assert.equal(getOrCreateCheckoutAttempt(storage, { ...order, paymentMethod: "card" }, () => "attempt-2"), "attempt-2");
});

test("starts a new attempt when duplicate-warning acknowledgement changes", () => {
  const storage = createStorage();
  const confirmedOrder = {
    ...order,
    duplicateConfirmed: true,
    duplicateSourceReceiptId: "receipt-1",
  };
  getOrCreateCheckoutAttempt(storage, confirmedOrder, () => "attempt-1");

  assert.equal(getOrCreateCheckoutAttempt(storage, { ...confirmedOrder, duplicateSourceReceiptId: "receipt-2" }, () => "attempt-2"), "attempt-2");
});

test("clears only the matching cashier checkout key after confirmed success", () => {
  const storage = createStorage();
  getOrCreateCheckoutAttempt(storage, order, () => "attempt-1");
  clearCheckoutAttempt(storage, "cashier-1", "another-attempt");
  assert.equal(getOrCreateCheckoutAttempt(storage, order, () => "attempt-2"), "attempt-1");

  clearCheckoutAttempt(storage, "cashier-1", "attempt-1");
  assert.equal(getOrCreateCheckoutAttempt(storage, order, () => "attempt-2"), "attempt-2");
});

test("replaces a corrupted pending checkout record so checkout can proceed", () => {
  const storage = createStorage();
  storage.setItem("uniform-pos-pending-checkout:cashier-1", "not-json");

  assert.equal(getOrCreateCheckoutAttempt(storage, order, () => "attempt-1"), "attempt-1");
  assert.equal(getOrCreateCheckoutAttempt(storage, order, () => "attempt-2"), "attempt-1");
});
