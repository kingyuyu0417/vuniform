import test from "node:test";
import assert from "node:assert/strict";
import { dimensionLabels, hasMatrixSizeOptions } from "./productDimensions.js";
import { normalizeProducts } from "./productsStore.js";

test("formats the same size dimensions as the sale page", () => {
  assert.deepEqual(dimensionLabels("校裙"), { length: "裙長", size: "胸寬" });
  assert.deepEqual(dimensionLabels("白色長袖恤衫"), { length: "領圍", size: "袖長" });
  assert.deepEqual(dimensionLabels("冬季白色尖領長袖恤"), { length: "領圍", size: "袖長" });
  assert.deepEqual(dimensionLabels("藏青色短褲"), { length: "褲長", size: "腰圍" });
  assert.deepEqual(dimensionLabels("短袖恤衫"), { length: "", size: "尺碼" });
});

test("recognizes structured and combined matrix sizes on matrix-capable products", () => {
  assert.equal(hasMatrixSizeOptions({ name: "白色長袖恤衫", sizes: [{ size: "11.5", length: "22" }] }), true);
  assert.equal(hasMatrixSizeOptions({ name: "長袖恤衫", sizes: [{ size: "11.5×22" }] }), true);
  assert.equal(hasMatrixSizeOptions({ name: "長西褲", sizes: [{ size: "40×28*" }] }), true);
  assert.equal(hasMatrixSizeOptions({ name: "校裙", sizes: [{ size: "42 x 28" }] }), true);
});

test("does not classify ordinary sizes or unrelated products as matrix sizes", () => {
  assert.equal(hasMatrixSizeOptions({ name: "長袖恤衫", sizes: [{ size: "12.5" }] }), false);
  assert.equal(hasMatrixSizeOptions({ name: "短袖恤衫", sizes: [{ size: "11.5×22" }] }), false);
  assert.equal(hasMatrixSizeOptions({ name: "短褲", sizes: [{ size: "40×28" }] }), false);
  assert.equal(hasMatrixSizeOptions({ name: "冷衫", sizes: [{ size: "40×28" }] }), false);
});

test("normalizes matrix-shaped product sizes to matrix pricing mode", () => {
  const [shirt, regular] = normalizeProducts([
    { name: "長袖恤衫", priceMode: "simple", sizes: [{ size: "11.5×22" }] },
    { name: "短袖恤衫", priceMode: "simple", sizes: [{ size: "11.5" }] },
  ]);
  assert.equal(shirt.priceMode, "matrix");
  assert.equal(regular.priceMode, "simple");
});
