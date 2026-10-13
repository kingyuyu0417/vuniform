import test from "node:test";
import assert from "node:assert/strict";
import {
  availableFeatureIds,
  getDisabledQueueRedirect,
  QUEUE_FEATURES_ENABLED,
} from "./queueFeatureAvailability.js";

test("queue features are paused without removing the sales and other tools", () => {
  assert.equal(QUEUE_FEATURES_ENABLED, false);
  assert.deepEqual(
    availableFeatureIds(["sale", "guest", "queue", "track", "fitting", "pickup", "cashier", "records"]),
    ["sale", "records"],
  );
});

test("public queue routes redirect to the public home page", () => {
  for (const pathname of ["/checkin", "/queue-status", "/queue-display"]) {
    assert.equal(getDisabledQueueRedirect(pathname), "/");
  }
});

test("the standalone live manual pickup display remains public while queue features are paused", () => {
  assert.equal(getDisabledQueueRedirect("/queue-live-display"), null);
});

test("staff queue routes redirect to the directory", () => {
  for (const pathname of ["/track", "/fitting", "/pickup", "/cashier"]) {
    assert.equal(getDisabledQueueRedirect(pathname), "/menu");
  }
});

test("the simplified manual pickup caller remains available at the queue route", () => {
  assert.equal(getDisabledQueueRedirect("/queue"), null);
});

test("sales and unrelated routes remain available", () => {
  for (const pathname of ["/", "/menu", "/sale", "/products", "/records", "/staff"]) {
    assert.equal(getDisabledQueueRedirect(pathname), null);
  }
});

test("legacy public queue query links return to home without exposing queue status", () => {
  assert.equal(getDisabledQueueRedirect("/", true), "/");
});
