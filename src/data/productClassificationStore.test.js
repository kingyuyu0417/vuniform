import test from "node:test";
import assert from "node:assert/strict";
import { insertProduct, loadProducts, normalizeProducts } from "./productsStore.js";

test("preserves seasonal classification when normalizing and inserting a product", async () => {
  const product = {
    id: "seasonal-shirt",
    school: "蘇浙小學",
    name: "冬季 男裝 恤衫（長袖／尖領）",
    gender: "boys",
    season: "winter",
    category: "shirt",
    style: "長袖／尖領",
    sizes: [{ size: "10", price: null }],
  };
  const normalized = normalizeProducts([product])[0];
  assert.equal(normalized.season, "winter");
  assert.equal(normalized.category, "shirt");
  assert.equal(normalized.style, "長袖／尖領");

  let inserted;
  const supabase = {
    from(table) {
      assert.equal(table, "products");
      return {
        insert(payload) {
          inserted = payload;
          return {
            select() {
              return {
                async single() {
                  return { data: { id: payload.id }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  await insertProduct({
    products: [product],
    productId: product.id,
    supabase,
    isSupabaseAuthEnabled: true,
  });

  assert.equal(inserted.season, "winter");
  assert.equal(inserted.category, "shirt");
  assert.equal(inserted.style, "長袖／尖領");
});

test("loads seasonal classification from the Supabase product record", async () => {
  const databaseProduct = {
    id: "summer-shirt",
    school: "蘇浙小學",
    name: "夏季 男裝 恤衫（短袖／尖領）",
    gender: "boys",
    season: "summer",
    category: "shirt",
    style: "短袖／尖領",
    sizes: [{ size: "14", price: null }],
  };
  const supabase = {
    from(table) {
      assert.equal(table, "products");
      return {
        select(columns) {
          assert.match(columns, /season, category, style/);
          return {
            order() {
              return {
                async order() {
                  return { data: [databaseProduct], error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  const products = await loadProducts({ supabase, isSupabaseAuthEnabled: true });
  assert.equal(products[0].season, "summer");
  assert.equal(products[0].category, "shirt");
  assert.equal(products[0].style, "短袖／尖領");
});
