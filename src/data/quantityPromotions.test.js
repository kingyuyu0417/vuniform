import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCartLineTotals,
  calculateReturnDiscounts,
  quantityPromotionTotal,
  validTwoPiecePrice,
} from "./quantityPromotions.js";

test("accepts only a valid lower two-piece total price", () => {
  assert.equal(validTwoPiecePrice(40, 73), 73);
  assert.equal(validTwoPiecePrice(40, 80), null);
  assert.equal(validTwoPiecePrice(40, -1), null);
  assert.equal(validTwoPiecePrice(40, 73.5), null);
  assert.equal(validTwoPiecePrice(40, ""), null);
});

test("repeats a two-piece offer and charges the list price for an odd item", () => {
  assert.equal(quantityPromotionTotal(40, 73, 1), 40);
  assert.equal(quantityPromotionTotal(40, 73, 2), 73);
  assert.equal(quantityPromotionTotal(40, 73, 3), 113);
  assert.equal(quantityPromotionTotal(40, 73, 4), 146);
});

test("pools only matching product, unit price, and promotion price", () => {
  const totals = calculateCartLineTotals([
    { productId: "shirt", name: "底衫", size: "20-24", price: 40, twoPiecePrice: 73, qty: 1 },
    { productId: "shirt", name: "底衫", size: "26-30", price: 40, twoPiecePrice: 73, qty: 1 },
    { productId: "shirt", name: "底衫", size: "32-36", price: 45, twoPiecePrice: 83, qty: 1 },
    { productId: "other", name: "另一款", size: "M", price: 40, twoPiecePrice: 73, qty: 1 },
  ]);

  assert.deepEqual(totals.map((item) => [item.discountAmount, item.lineTotal]), [
    [0, 40],
    [7, 33],
    [0, 45],
    [0, 40],
  ]);
});

test("allocates repeated bundle discounts across mixed-size lines", () => {
  const totals = calculateCartLineTotals([
    { productId: "shirt", name: "底衫", size: "20-24", price: 40, twoPiecePrice: 73, qty: 2 },
    { productId: "shirt", name: "底衫", size: "26-30", price: 40, twoPiecePrice: 73, qty: 2 },
  ]);

  assert.deepEqual(totals.map((item) => [item.discountAmount, item.lineTotal]), [[7, 73], [7, 73]]);
});

test("does not apply offers to returns or committed customer orders", () => {
  const totals = calculateCartLineTotals([
    { name: "底衫", price: 40, twoPiecePrice: 73, qty: 2, exchangeReturn: true },
    { name: "底衫", price: 40, twoPiecePrice: 73, qty: 2, sourceOrderId: "order-1" },
  ]);

  assert.deepEqual(totals.map((item) => [item.discountAmount, item.lineTotal]), [[0, -80], [0, 80]]);
});

test("recalculates promotions on full-sale replacement items", () => {
  const [replacement] = calculateCartLineTotals([{
    productId: "shirt",
    name: "底衫",
    price: 40,
    twoPiecePrice: 73,
    qty: 2,
    replacementSourceOrderItemId: "original-item",
    applyPromotion: true,
  }]);

  assert.equal(replacement.discountAmount, 7);
  assert.equal(replacement.lineTotal, 73);
});

test("reverses the bundle price when one item from a pair is returned", () => {
  const source = [
    { id: "item-1", name: "底衫", size: "20-24", price: 40, qty: 2, twoPiecePrice: 73, discountAmount: 7 },
  ];
  const selected = [{ id: "item-1", name: "底衫", size: "20-24", price: 40, qty: 1 }];

  assert.deepEqual(calculateReturnDiscounts(source, selected), [7]);
  assert.equal(40 - calculateReturnDiscounts(source, selected)[0], 33);
});

test("refunds a single full-price item when a three-item order retains a qualifying pair", () => {
  const source = [
    { id: "item-1", name: "底衫", size: "20-24", price: 40, qty: 3, twoPiecePrice: 73, discountAmount: 7 },
  ];
  const selected = [{ id: "item-1", name: "底衫", size: "20-24", price: 40, qty: 1 }];

  assert.deepEqual(calculateReturnDiscounts(source, selected), [0]);
});

test("accounts for earlier partial returns when refunding the last item in a pair", () => {
  const source = [
    { id: "item-1", name: "底衫", size: "20-24", price: 40, qty: 2, twoPiecePrice: 73, discountAmount: 7 },
  ];
  const selected = [{ id: "item-1", name: "底衫", size: "20-24", price: 40, qty: 1 }];
  const previousReturns = [{
    exchangeReturn: true,
    sourceOrderItemId: "item-1",
    price: 40,
    qty: 1,
    discountAmount: 7,
  }];

  assert.deepEqual(calculateReturnDiscounts(source, selected, previousReturns), [0]);
});
