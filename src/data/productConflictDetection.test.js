import test from "node:test";
import assert from "node:assert/strict";
import { findConflictingProductIds } from "./productConflictDetection.js";

const detect = (products) => findConflictingProductIds(products, {
  getProductIdentity: (product) => ({ key: `${product.school}:${product.name}`, gender: product.gender || "" }),
  getSizeIdentity: (size) => `${size.length || ""}:${size.size}`,
  isIdentityCompatible: (first, second) => !first.gender || !second.gender || first.gender === second.gender,
});

test("allows different prices for different sizes", () => {
  const product = {
    id: "shirt",
    school: "School",
    name: "Shirt",
    sizes: [{ size: "28", price: 80 }, { size: "30", price: 90 }],
  };

  assert.deepEqual([...detect([product])], []);
});

test("blocks conflicting prices for the same size within a product", () => {
  const product = {
    id: "shirt",
    school: "School",
    name: "Shirt",
    sizes: [{ size: "28", price: 80 }, { size: "28", price: 90 }],
  };

  assert.deepEqual([...detect([product])], ["shirt"]);
});

test("blocks both duplicate styles when the same size has different prices", () => {
  const products = [
    { id: "shirt-a", school: "School", name: "Shirt", sizes: [{ size: "28", price: 80 }] },
    { id: "shirt-b", school: "School", name: "Shirt", sizes: [{ size: "28", price: 90 }] },
  ];

  assert.deepEqual([...detect(products)].sort(), ["shirt-a", "shirt-b"]);
});

test("blocks every duplicate style when one row also contains conflicting duplicate sizes", () => {
  const products = [
    { id: "shirt-a", school: "School", name: "Shirt", sizes: [{ size: "28", price: 90 }] },
    { id: "shirt-b", school: "School", name: "Shirt", sizes: [{ size: "28", price: 80 }, { size: "28", price: 90 }] },
  ];

  assert.deepEqual([...detect(products)].sort(), ["shirt-a", "shirt-b"]);
});

test("allows compatible records with matching prices and ignores incompatible genders", () => {
  const products = [
    { id: "same-price", school: "School", name: "Shirt", sizes: [{ size: "28", price: 80 }] },
    { id: "same-price-copy", school: "School", name: "Shirt", sizes: [{ size: "28", price: 80 }] },
    { id: "boy", school: "School", name: "Boy Shirt", gender: "boy", sizes: [{ size: "28", price: 80 }] },
    { id: "girl", school: "School", name: "Boy Shirt", gender: "girl", sizes: [{ size: "28", price: 90 }] },
  ];

  assert.deepEqual([...detect(products)], []);
});
