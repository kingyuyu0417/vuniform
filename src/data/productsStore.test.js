import test from "node:test";
import assert from "node:assert/strict";
import { isMissingReceiptNameColumnError, loadProducts, normalizeProducts, saveProducts } from "./productsStore.js";

test("detects only missing English receipt name schema errors", () => {
  assert.equal(isMissingReceiptNameColumnError({
    code: "42703",
    message: "column products.receipt_name_en does not exist",
  }), true);
  assert.equal(isMissingReceiptNameColumnError({
    code: "42501",
    message: "permission denied",
  }), false);
});

test("loads the authoritative catalog when the English receipt name column is not installed", async () => {
  const selectedColumns = [];
  const productRow = {
    id: "product-1",
    school: "測試學校",
    name: "恤衫",
    gender: "男裝",
    sizes: [{ size: "M", price: 100 }],
  };
  const supabase = {
    from: () => ({
      select: (columns) => {
        selectedColumns.push(columns);
        const query = {
          order: () => query,
          then: (resolve, reject) => Promise.resolve(selectedColumns.length === 1
            ? { data: null, error: { code: "42703", message: "column products.receipt_name_en does not exist" } }
            : { data: [productRow], error: null }).then(resolve, reject),
        };
        return query;
      },
    }),
  };

  const products = await loadProducts({
    storage: null,
    supabase,
    isSupabaseAuthEnabled: true,
  });

  assert.equal(products.length, 1);
  assert.equal(products[0].school, "測試學校");
  assert.equal(products[0].receiptNameEn, "");
  assert.equal(selectedColumns.length, 2);
  assert.equal(selectedColumns[1].includes("receipt_name_en"), false);
});

test("normalizes saved English receipt names from both product storage shapes", () => {
  const products = normalizeProducts([
    { id: "camel", name: "恤衫", receiptNameEn: "Custom Shirt", sizes: [{ size: "M", price: 100 }] },
    { id: "database", name: "褲", receipt_name_en: "Custom Trousers", sizes: [{ size: "30", price: 150 }] },
  ]);

  assert.equal(products[0].receiptNameEn, "Custom Shirt");
  assert.equal(products[1].receiptNameEn, "Custom Trousers");
});

test("persists and verifies English receipt names with authoritative Supabase products", async () => {
  const rows = [];
  const upsertedRows = [];
  const supabase = {
    from: () => ({
      select: () => ({
        in: async (column, values) => ({
          data: rows.filter((row) => values.includes(row[column])),
          error: null,
        }),
        then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
      }),
      upsert: async (nextRows) => {
        upsertedRows.push(...nextRows);
        rows.push(...nextRows);
        return { error: null };
      },
    }),
  };

  await saveProducts({
    products: [{
      id: "jacket",
      school: "測試學校",
      name: "運動外套",
      receiptNameEn: "Sports Jacket",
      gender: "unisex",
      sizes: [{ size: "M", price: 100 }],
    }],
    supabase,
    isSupabaseAuthEnabled: true,
  });

  assert.equal(upsertedRows[0].receipt_name_en, "Sports Jacket");
});
