import assert from "node:assert/strict";
import test from "node:test";
import { buildExchangeComparisonRows } from "./exchangeComparison.js";

test("groups returned and replacement sizes of the same product in one comparison row", () => {
  const returnedItems = [
    { key: "return-12", productId: "shirt", name: "恤衫", size: "12", qty: 1 },
    { key: "return-14", productId: "shirt", name: "恤衫", size: "14", qty: 1 },
  ];
  const replacementItems = [
    { key: "new-13", productId: "shirt", name: "恤衫", size: "13", qty: 1 },
  ];

  assert.deepEqual(buildExchangeComparisonRows(returnedItems, replacementItems), [
    {
      key: "shirt",
      returnedItems,
      replacementItems,
    },
  ]);
});

test("keeps unrelated products in separate rows with an empty opposite side", () => {
  const returned = { key: "return-shirt", productId: "shirt", name: "恤衫", size: "12", qty: 1 };
  const replacement = { key: "new-trousers", productId: "trousers", name: "長褲", size: "30", qty: 1 };

  assert.deepEqual(buildExchangeComparisonRows([returned], [replacement]), [
    { key: "shirt", returnedItems: [returned], replacementItems: [] },
    { key: "trousers", returnedItems: [], replacementItems: [replacement] },
  ]);
});

test("groups product-name keys case-insensitively when ids are unavailable", () => {
  const returned = { key: "return", name: "Shirt", size: "12", qty: 1 };
  const replacement = { key: "new", name: " shirt ", size: "13", qty: 1 };

  const [row] = buildExchangeComparisonRows([returned], [replacement]);

  assert.equal(row.returnedItems[0], returned);
  assert.equal(row.replacementItems[0], replacement);
});
