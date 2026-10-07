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

test("refuses to replace an unresolved checkout key when transaction details change", () => {
  const storage = createStorage();
  getOrCreateCheckoutAttempt(storage, order, () => "attempt-1");

  assert.throws(
    () => getOrCreateCheckoutAttempt(storage, { ...order, total: 200 }, () => "attempt-2"),
    /上次結帳結果尚未確認/,
  );
});

test("clears only the matching cashier checkout key after confirmed success", () => {
  const storage = createStorage();
  getOrCreateCheckoutAttempt(storage, order, () => "attempt-1");
  clearCheckoutAttempt(storage, "cashier-1", "another-attempt");
  assert.equal(getOrCreateCheckoutAttempt(storage, order, () => "attempt-2"), "attempt-1");

  clearCheckoutAttempt(storage, "cashier-1", "attempt-1");
  assert.equal(getOrCreateCheckoutAttempt(storage, order, () => "attempt-2"), "attempt-2");
});

test("refuses to silently discard a corrupted pending checkout record", () => {
  const storage = createStorage();
  storage.setItem("uniform-pos-pending-checkout:cashier-1", "not-json");

  assert.throws(
    () => getOrCreateCheckoutAttempt(storage, order, () => "attempt-1"),
    /為避免重覆落單/,
  );
});
