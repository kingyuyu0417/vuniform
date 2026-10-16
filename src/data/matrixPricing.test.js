import test from "node:test";
import assert from "node:assert/strict";
import { calculateMatrixPrices } from "./matrixPricing.js";

test("calculates prices from the first matrix dimension and surcharges the second", () => {
  const result = calculateMatrixPrices([
    { length: "11.5", size: "22", price: null },
    { length: "11.5", size: "23", price: null },
    { length: "12", size: "22", price: null },
  ], {
    basePrices: "11.5=50,12=53",
    surcharges: "22=0,23=3",
  });

  assert.deepEqual(result.sizes.map((item) => item.price), [50, 53, 53]);
  assert.equal(result.matchedCount, 3);
});

test("applies surcharge minimum rules to the second matrix dimension", () => {
  const result = calculateMatrixPrices([
    { length: "40", size: "42", price: null },
    { length: "40", size: "43", price: null },
  ], {
    basePrices: "40=100",
    surcharges: "43+=20",
  });

  assert.deepEqual(result.sizes.map((item) => item.price), [null, 120]);
});

test("uses the tailored base price when the first dimension has no explicit price", () => {
  const result = calculateMatrixPrices([
    { length: "42", size: "43", isTailored: true, price: null },
  ], {
    basePrices: "裁碼=139",
    surcharges: "43=10",
  });

  assert.equal(result.sizes[0].price, 149);
});

test("reports zero matching size combinations", () => {
  const result = calculateMatrixPrices([
    { length: "11.5", size: "22", price: null },
  ], {
    basePrices: "22=50",
    surcharges: "11.5=0",
  });

  assert.equal(result.matchedCount, 0);
  assert.equal(result.sizes[0].price, null);
});

test("preserves prices when filling newly created matrix combinations", () => {
  const existing = { length: "11.5", size: "22", price: 75 };
  const result = calculateMatrixPrices([
    existing,
    { length: "12", size: "22", price: null },
  ], {
    basePrices: "11.5=50,12=53",
    surcharges: "22=0",
  }, { preserveExistingPrices: true });

  assert.equal(result.sizes[0], existing);
  assert.deepEqual(result.sizes.map((item) => item.price), [75, 53]);
});
