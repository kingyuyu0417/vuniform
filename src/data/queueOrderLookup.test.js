import test from "node:test";
import assert from "node:assert/strict";
import { clearQueueCallMarker, findQueueOrders, normalizeQueueLookup } from "./queueOrderLookup.js";

const orders = [
  { id: "co-first", queue_number: "A001", customer_info: { guestName: "Student One" } },
  { id: "co-second", queue_number: "A001", customer_info: { guestName: "Student Two" } },
  { id: "co-third", queue_number: "A002" },
];

test("queue number lookup returns all same-number orders for explicit disambiguation", () => {
  assert.deepEqual(findQueueOrders(orders, "a001"), orders.slice(0, 2));
});

test("a status QR URL resolves by unique order id rather than a repeated queue number", () => {
  const url = "https://uniform.example/queue-status?id=co-second&school_id=School";
  assert.equal(normalizeQueueLookup(url), "co-second");
  assert.deepEqual(findQueueOrders(orders, url), [orders[1]]);
});

test("an ordinary queue number is normalized without discarding its identity", () => {
  assert.equal(normalizeQueueLookup(" a002 "), "A002");
  assert.deepEqual(findQueueOrders(orders, "a002"), [orders[2]]);
});

test("recalled tickets clear only the active queue call marker", () => {
  assert.deepEqual(
    clearQueueCallMarker({ items: [{ size: "32" }], fitting_called_at: "then", pickup_called_at: "later" }, "FITTING"),
    { items: [{ size: "32" }], pickup_called_at: "later" },
  );
  assert.deepEqual(
    clearQueueCallMarker({ items: [{ size: "32" }], fitting_called_at: "then", pickup_called_at: "later" }, "PICKUP"),
    { items: [{ size: "32" }], fitting_called_at: "then" },
  );
});
