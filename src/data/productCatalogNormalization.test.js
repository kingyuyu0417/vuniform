import test from "node:test";
import assert from "node:assert/strict";
import { findProductCatalogReviewGroups, removeProductCatalogReviewProducts } from "./productCatalogNormalization.js";

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

test("shows conflicts for product names that the catalog identity treats as the same style", () => {
  const products = [
    {
      id: "winter-unisex",
      school: "測試小學",
      gender: "unisex",
      season: "winter",
      name: "冬季 男女生 校裙（款式甲）",
      sizes: [{ size: "24", price: 100 }],
    },
    {
      id: "winter-unisex-variant",
      school: "測試小學",
      gender: "unisex",
      season: "winter",
      name: "冬季 男女生 校裙（款式乙）",
      sizes: [{ size: "24", price: 110 }],
    },
    {
      id: "summer-unisex",
      school: "測試小學",
      gender: "unisex",
      season: "summer",
      name: "夏季 男女生 校裙（款式丙）",
      sizes: [{ size: "24", price: 120 }],
    },
  ];

  const groups = findProductCatalogReviewGroups(products);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].products.map(({ id }) => id), ["winter-unisex", "winter-unisex-variant"]);
  assert.deepEqual(groups[0].conflicts[0].variants.map(({ productId, price }) => [productId, price]), [
    ["winter-unisex", 100],
    ["winter-unisex-variant", 110],
  ]);
  assert.deepEqual(removeProductCatalogReviewProducts(products, groups).productIds, ["winter-unisex", "winter-unisex-variant"]);
});

test("keeps same-name conflicts separate when gender or season is incompatible", () => {
  const products = [
    {
      id: "boys",
      school: "測試小學",
      gender: "boys",
      season: "winter",
      name: "男生 恤衫",
      sizes: [{ size: "24", price: 100 }],
    },
    {
      id: "girls",
      school: "測試小學",
      gender: "girls",
      season: "winter",
      name: "女生 恤衫",
      sizes: [{ size: "24", price: 110 }],
    },
    {
      id: "summer",
      school: "測試小學",
      gender: "boys",
      season: "summer",
      name: "男生 恤衫",
      sizes: [{ size: "24", price: 120 }],
    },
  ];

  assert.deepEqual(findProductCatalogReviewGroups(products), []);
});
