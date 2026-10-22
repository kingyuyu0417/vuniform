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

test("applies waist base prices and trouser-length surcharges", () => {
  const result = calculateMatrixPrices([
    { length: "38.5", size: "24", price: null },
    { length: "40", size: "25", price: null },
    { length: "41.5", size: "26", price: null },
    { length: "42", size: "27", price: null },
    { length: "43", size: "28", price: null },
    { length: "50", size: "30", price: null },
  ], {
    basePrices: "24=96,25=99,26=102,27=106,28=113,30=128",
    surcharges: "32+=0,40=10,41.5=20,42=20,43+=30",
  }, { baseDimension: "size", surchargeDimension: "length" });

  assert.deepEqual(result.sizes.map((item) => item.price), [96, 109, 122, 126, 143, 158]);
  assert.equal(result.matchedCount, 6);
});

test("applies skirt-length base prices and chest-width surcharge bands", () => {
  const result = calculateMatrixPrices([
    { length: "36", size: "36", price: null },
    { length: "38", size: "38", price: null },
    { length: "40", size: "40", price: null },
    { length: "42", size: "42", price: null },
    { length: "44", size: "44", price: null },
    { length: "44", size: "46", price: null },
  ], {
    basePrices: "36=128,38=130,40=132,42=134,44=136",
    surcharges: "36+=0,40=10,42=20,44+=30",
  });

  assert.deepEqual(result.sizes.map((item) => item.price), [128, 130, 142, 154, 166, 166]);
  assert.equal(result.matchedCount, 6);
});
