import test from "node:test";
import assert from "node:assert/strict";
import { getOrderDateRangeBounds, mergeOrderUpdates } from "./orderSync.js";

test("creates inclusive date range bounds for database queries", () => {
  assert.deepEqual(getOrderDateRangeBounds("2026-10-26", "2026-10-27"), {
    startInclusive: "2026-10-26T00:00:00.000Z",
    endExclusive: "2026-10-28T00:00:00.000Z",
  });
});

test("rejects invalid or reversed date ranges", () => {
  assert.equal(getOrderDateRangeBounds("2026-02-30", "2026-03-01"), null);
  assert.equal(getOrderDateRangeBounds("2026-10-27", "2026-10-26"), null);
});

test("adds newly synced orders and sorts them newest first", () => {
  const orders = mergeOrderUpdates(
    [{ id: "older", createdAt: "2026-10-27T09:00:00Z" }],
    [{ id: "newer", createdAt: "2026-10-27T10:00:00Z" }],
  );

  assert.deepEqual(orders.map((order) => order.id), ["newer", "older"]);
});

test("replaces an existing order when its cloud record changes", () => {
  const orders = mergeOrderUpdates(
    [{ id: "receipt-1", total: 100, createdAt: "2026-10-27T09:00:00Z" }],
    [{ id: "receipt-1", total: 0, voidedAt: "2026-10-27T10:00:00Z", createdAt: "2026-10-27T09:00:00Z" }],
  );

  assert.equal(orders.length, 1);
  assert.equal(orders[0].total, 0);
  assert.ok(orders[0].voidedAt);
});
