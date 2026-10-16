import test from "node:test";
import assert from "node:assert/strict";
import { findProductCatalogReviewGroups } from "./productCatalogNormalization.js";

test("returns the affected product names and conflicting prices for the same size", () => {
  const groups = findProductCatalogReviewGroups([
    {
      id: "skirt-one",
      school: "聖類斯中學",
      branch_id: "branch-1",
      name: "女生 - 校裙",
      sizes: [{ length: "24", size: "30", price: 120 }],
    },
    {
      id: "skirt-two",
      school: "聖類斯中學",
      branch_id: "branch-1",
      name: "女生校裙",
      sizes: [{ length: "24", size: "30", price: 125 }],
    },
  ]);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].products.map((product) => product.name), ["女生 - 校裙", "女生校裙"]);
  assert.deepEqual(groups[0].conflicts, [{
    size: { length: "24", size: "30", price: 120 },
    variants: [
      { productId: "skirt-one", productName: "女生 - 校裙", price: 120 },
      { productId: "skirt-two", productName: "女生校裙", price: 125 },
    ],
  }]);
});

test("does not report equal prices or products from separate schools", () => {
  const groups = findProductCatalogReviewGroups([
    {
      id: "same-price-one",
      school: "學校甲",
      name: "女生 - 校裙",
      sizes: [{ length: "24", size: "30", price: 120 }],
    },
    {
      id: "same-price-two",
      school: "學校甲",
      name: "女生校裙",
      sizes: [{ length: "24", size: "30", price: 120 }],
    },
    {
      id: "other-school",
      school: "學校乙",
      name: "女生校裙",
      sizes: [{ length: "24", size: "30", price: 125 }],
    },
  ]);

  assert.deepEqual(groups, []);
});
