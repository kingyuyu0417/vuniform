import test from "node:test";
import assert from "node:assert/strict";
import { validateAndDeduplicateImportRows } from "./importDuplicateGuard.js";

const productIdentity = (product) => ({
  key: `${product.school}\u0000${product.name}\u0000${product.branchId || product.branch_id || ""}`,
  gender: product.gender || "",
});
const sizeIdentity = (size) => `${size.isTailored ? "tailored" : "regular"}\u0000${size.length || ""}\u0000${size.size || ""}`;
const options = {
  getProductIdentity: productIdentity,
  getSizeIdentity: sizeIdentity,
  isIdentityCompatible: (first, second) => !first || !second || first === second || first === "unisex" || second === "unisex",
};
const row = (overrides = {}) => ({
  school: "測試學校",
  name: "白短襪",
  size: "3對裝",
  length: "",
  price: 44,
  gender: "unisex",
  sourceLocation: "Sheet1!E24",
  ...overrides,
});
const product = (overrides = {}) => ({
  id: "product-1",
  school: "測試學校",
  name: "白短襪",
  gender: "unisex",
  branch_id: "",
  sizes: [{ size: "3對裝", price: 44 }],
  ...overrides,
});

test("blocks conflicting prices within a file and identifies both source cells", () => {
  const result = validateAndDeduplicateImportRows({
    rows: [row(), row({ price: 45, sourceLocation: "Sheet1!E25" })],
    existingProducts: [],
    ...options,
  });

  assert.equal(result.rows.length, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Sheet1!E25/);
  assert.match(result.errors[0], /Sheet1!E24/);
  assert.match(result.errors[0], /價格衝突/);
});

test("deduplicates same-price file rows and retains every source and note difference", () => {
  const result = validateAndDeduplicateImportRows({
    rows: [
      row({ note: "第一備註" }),
      row({ sourceLocation: "Sheet1!E25", note: "第二備註" }),
      row({ sourceLocation: "Sheet1!E26", note: "第二備註" }),
    ],
    existingProducts: [],
    ...options,
    getNotes: (entry) => entry.note,
  });

  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.rows[0].sourceLocations, ["Sheet1!E24", "Sheet1!E25", "Sheet1!E26"]);
  assert.equal(result.rows[0].duplicateDetailsDiffer, true);
  assert.match(result.warnings[0], /Sheet1!E24、Sheet1!E25、Sheet1!E26/);
  assert.match(result.warnings[0], /商品資料不同/);
});

test("blocks a conflicting existing product but allows matching price and other branches", () => {
  const conflict = validateAndDeduplicateImportRows({
    rows: [row()],
    existingProducts: [product({ sizes: [{ size: "3對裝", price: 45 }] })],
    ...options,
  });
  assert.equal(conflict.errors.length, 1);
  assert.match(conflict.errors[0], /product-1/);

  const samePrice = validateAndDeduplicateImportRows({
    rows: [row()],
    existingProducts: [product()],
    ...options,
  });
  assert.equal(samePrice.errors.length, 0);
  assert.equal(samePrice.rows.length, 1);

  const differentBranch = validateAndDeduplicateImportRows({
    rows: [row({ branchId: "branch-new" })],
    existingProducts: [product({ branch_id: "branch-old", sizes: [{ size: "3對裝", price: 45 }] })],
    ...options,
  });
  assert.equal(differentBranch.errors.length, 0);
});

test("only compatible product genders participate in duplicate checks", () => {
  const result = validateAndDeduplicateImportRows({
    rows: [row({ gender: "boys" })],
    existingProducts: [product({ gender: "girls", sizes: [{ size: "3對裝", price: 45 }] })],
    ...options,
  });
  assert.equal(result.errors.length, 0);
});
