import test from "node:test";
import assert from "node:assert/strict";
import { getActiveFittingOrder } from "./fittingOrderState.js";

const firstPending = { id: "order-1", status: "PENDING" };
const secondPending = { id: "order-2", status: "PENDING" };

test("a selected order that left fitting cannot fall through to another ticket", () => {
  const selectedOrder = { id: "order-done", status: "PREPARING" };
  assert.equal(getActiveFittingOrder(selectedOrder, [firstPending]), null);
});

test("an unresolved route-selected order cannot fall through to the first pending ticket", () => {
  assert.equal(getActiveFittingOrder(null, [firstPending], "order-from-route", ""), null);
});

test("a manually selected pending order takes precedence over the pending queue", () => {
  assert.equal(getActiveFittingOrder(secondPending, [firstPending]), secondPending);
});

test("the first pending order remains the default when there is no pinned selection", () => {
  assert.equal(getActiveFittingOrder(null, [firstPending]), firstPending);
});
