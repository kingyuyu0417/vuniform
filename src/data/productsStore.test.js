import test from "node:test";
import assert from "node:assert/strict";
import { isMissingReceiptNameColumnError, loadProducts, normalizeProducts, saveProducts, updateProduct } from "./productsStore.js";

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

test("preserves two-piece promotion prices when normalizing products", () => {
  const [product] = normalizeProducts([{
    id: "undershirt",
    name: "長袖底衫",
    sizes: [{ size: "20-24", price: 40, twoPiecePrice: 73 }],
  }]);

  assert.equal(product.sizes[0].twoPiecePrice, 73);
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


test("keeps a manually updated cloud price when reloading despite an older bundled fallback", async () => {
  const databaseProducts = [{
    id: "shirt-1",
    school: "測試學校",
    name: "白恤衫",
    gender: "unisex",
    priceMode: "simple",
    sizes: [{ size: "M", length: "", price: 120 }],
  }];
  const supabase = {
    from(table) {
      assert.equal(table, "products");
      return {
        update(payload) {
          return {
            eq(column, id) {
              assert.equal(column, "id");
              return {
                select() {
                  return {
                    async single() {
                      const product = databaseProducts.find((entry) => entry.id === id);
                      Object.assign(product, payload);
                      return { data: { id }, error: null };
                    },
                  };
                },
              };
            },
          };
        },
        select() {
          return {
            order() {
              return {
                async order() {
                  return { data: databaseProducts, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  await updateProduct({
    products: databaseProducts.map((product) => ({
      ...product,
      sizes: product.sizes.map((size) => ({ ...size, price: 125 })),
    })),
    productId: "shirt-1",
    supabase,
    isSupabaseAuthEnabled: true,
  });

  const loaded = await loadProducts({
    supabase,
    isSupabaseAuthEnabled: true,
    fallbackProducts: [{
      id: "shirt-1",
      school: "測試學校",
      name: "白恤衫",
      sizes: [{ size: "M", length: "", price: 100 }],
    }],
  });

  assert.equal(databaseProducts[0].sizes[0].price, 125);
  assert.equal(loaded[0].sizes[0].price, 125);
});
