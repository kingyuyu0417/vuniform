import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProducts, saveProducts } from "./productsStore.js";

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
