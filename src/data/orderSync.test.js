import test from "node:test";
import assert from "node:assert/strict";
import { mergeOrderUpdates } from "./orderSync.js";

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
