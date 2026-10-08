import test from "node:test";
import assert from "node:assert/strict";
import { canReplaceOrder, getReplacementSettlement } from "./orderReplacement.js";

test("settles the difference between the original and replacement totals", () => {
  assert.deepEqual(getReplacementSettlement(100, 140), { difference: 40, collectDue: 40, refundDue: 0 });
  assert.deepEqual(getReplacementSettlement(100, 60), { difference: -40, collectDue: 0, refundDue: 40 });
  assert.deepEqual(getReplacementSettlement(100, 100), { difference: 0, collectDue: 0, refundDue: 0 });
  assert.deepEqual(getReplacementSettlement(100, 0), { difference: -100, collectDue: 0, refundDue: 100 });
});

test("rejects invalid replacement totals", () => {
  assert.throws(() => getReplacementSettlement(-1, 10), /non-negative/);
  assert.throws(() => getReplacementSettlement(10, Number.NaN), /non-negative/);
});

test("allows replacement only when there are no active changes to the source receipt", () => {
  const source = { id: "sale-1" };
  assert.equal(canReplaceOrder(source, []), true);
  assert.equal(canReplaceOrder(source, [{ exchangeSourceReceiptId: "sale-1", voidedAt: "now" }]), true);
  assert.equal(canReplaceOrder(source, [{ exchangeSourceReceiptId: "sale-1" }]), false);
  assert.equal(canReplaceOrder(source, [{ replacementSourceReceiptId: "sale-1" }]), false);
  assert.equal(canReplaceOrder({ ...source, voidedAt: "now" }, []), false);
  assert.equal(canReplaceOrder({ ...source, exchangeSourceReceiptId: "sale-0" }, []), false);
  assert.equal(canReplaceOrder({ ...source, replacementSourceReceiptId: "sale-0" }, []), false);
});
