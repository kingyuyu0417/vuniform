import assert from "node:assert/strict";
import test from "node:test";
import { appendExchangeDraft, getDraftExchangeReturnQuantity } from "./exchangeDraft.js";

test("appends exchange returns and queues replacements without losing current cart items", () => {
  const existingCart = [
    { key: "return-1", exchangeReturn: true, productId: "shirt", qty: 1 },
    { key: "replacement-1", productId: "shirt", qty: 1 },
  ];
  const existingQueue = ["trousers"];
  const addedReturn = { key: "return-2", exchangeReturn: true, productId: "skirt", qty: 1 };

  const result = appendExchangeDraft(existingCart, [addedReturn], existingQueue);

  assert.deepEqual(result.cart, [...existingCart, addedReturn]);
  assert.deepEqual(result.replacementQueue, ["trousers", "skirt"]);
  assert.deepEqual(existingCart.map((item) => item.key), ["return-1", "replacement-1"]);
  assert.deepEqual(existingQueue, ["trousers"]);
});

test("counts only draft returns for the same source item and receipt", () => {
  const cart = [
    { exchangeReturn: true, sourceOrderItemId: "item-1", exchangeSourceReceiptId: "receipt-1", qty: 1 },
    { exchangeReturn: true, sourceOrderItemId: "item-1", exchangeSourceReceiptId: "receipt-1", qty: 2 },
    { exchangeReturn: true, sourceOrderItemId: "item-1", exchangeSourceReceiptId: "receipt-2", qty: 3 },
    { exchangeReturn: true, sourceOrderItemId: "item-1", untrackedExchange: true, qty: 4 },
    { exchangeReturn: false, sourceOrderItemId: "item-1", exchangeSourceReceiptId: "receipt-1", qty: 5 },
  ];

  assert.equal(getDraftExchangeReturnQuantity(cart, "item-1", "receipt-1"), 3);
  assert.equal(getDraftExchangeReturnQuantity(cart, "item-1", "receipt-2"), 3);
  assert.equal(getDraftExchangeReturnQuantity(cart, "item-2", "receipt-1"), 0);
});
