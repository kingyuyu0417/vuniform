import test from "node:test";
import assert from "node:assert/strict";
import {
  getCheckoutDraftStorageKey,
  getCheckoutDraftTabId,
  parseCheckoutDraft,
} from "./checkoutDraft.js";

test("keeps checkout draft storage isolated by cashier and browser tab", () => {
  assert.notEqual(
    getCheckoutDraftStorageKey("cashier-a", "tab-1"),
    getCheckoutDraftStorageKey("cashier-a", "tab-2"),
  );
  assert.notEqual(
    getCheckoutDraftStorageKey("cashier-a", "tab-1"),
    getCheckoutDraftStorageKey("cashier-b", "tab-1"),
  );
});

test("reuses the current tab identifier across page reloads", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };

  const firstId = getCheckoutDraftTabId(storage);
  assert.equal(getCheckoutDraftTabId(storage), firstId);
});

test("restores a recent non-empty checkout draft", () => {
  const now = Date.parse("2026-10-27T06:00:00.000Z");
  const draft = { savedAt: new Date(now - 1000).toISOString(), cart: [{ name: "Shirt" }] };

  assert.deepEqual(parseCheckoutDraft(JSON.stringify(draft), now), draft);
});

test("ignores expired, future, malformed, and empty checkout drafts", () => {
  const now = Date.parse("2026-10-27T06:00:00.000Z");
  assert.equal(parseCheckoutDraft("{", now), null);
  assert.equal(parseCheckoutDraft({ savedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(), cart: [{}] }, now), null);
  assert.equal(parseCheckoutDraft({ savedAt: new Date(now + 1000).toISOString(), cart: [{}] }, now), null);
  assert.equal(parseCheckoutDraft({ savedAt: new Date(now).toISOString(), cart: [] }, now), null);
  assert.ok(parseCheckoutDraft({ savedAt: new Date(now).toISOString(), cart: [], fullSaleReplacement: { id: "receipt-1" } }, now));
});
