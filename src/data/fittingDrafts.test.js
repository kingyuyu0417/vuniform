import test from "node:test";
import assert from "node:assert/strict";
import { getFittingDraft, removeFittingDraft, setFittingDraft } from "./fittingDrafts.js";

test("fitting drafts are isolated by school and order id", () => {
  const firstItems = [{ productId: "shirt", size: "32" }];
  const secondItems = [{ productId: "skirt", size: "M" }];
  const drafts = setFittingDraft(
    setFittingDraft({}, "School A", "order-1", firstItems),
    "School A",
    "order-2",
    secondItems,
  );

  assert.deepEqual(getFittingDraft(drafts, "School A", "order-1"), { items: firstItems });
  assert.deepEqual(getFittingDraft(drafts, "School A", "order-2"), { items: secondItems });
  assert.equal(getFittingDraft(drafts, "School B", "order-1"), null);
  assert.equal(getFittingDraft(drafts, "School A", ""), null);
});

test("saving a draft does not mutate the existing draft store", () => {
  const original = { "School A": { "order-1": { items: [{ size: "30" }] } } };
  const updated = setFittingDraft(original, "School A", "order-1", [{ size: "32" }]);

  assert.deepEqual(original["School A"]["order-1"].items, [{ size: "30" }]);
  assert.deepEqual(updated["School A"]["order-1"].items, [{ size: "32" }]);
});

test("removing a draft preserves other customers' drafts", () => {
  const drafts = {
    "School A": {
      "order-1": { items: [{ size: "30" }] },
      "order-2": { items: [{ size: "32" }] },
    },
  };

  assert.deepEqual(removeFittingDraft(drafts, "School A", "order-1"), {
    "School A": { "order-2": { items: [{ size: "32" }] } },
  });
});
