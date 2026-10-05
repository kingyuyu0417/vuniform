import test from "node:test";
import assert from "node:assert/strict";
import { getProductGender, productGenderBackground } from "./productGender.js";
import { normalizeProducts } from "./productsStore.js";

test("uses a saved gender selection before inferring from the product name", () => {
  assert.equal(getProductGender({ name: "女生恤衫", gender: "boys" }), "boys");
});

test("infers legacy product genders from their names and known exceptions", () => {
  assert.equal(getProductGender({ name: "男生長袖恤衫" }), "boys");
  assert.equal(getProductGender({ name: "女生背心校裙" }), "girls");
  assert.equal(getProductGender({ name: "男女生運動外套" }), "unisex");
  assert.equal(getProductGender({ name: "藍／紫色連身校裙" }), "girls");
});

test("uses soft distinct backgrounds for each gender", () => {
  assert.equal(productGenderBackground({ gender: "boys" }), "#EAF4FF");
  assert.equal(productGenderBackground({ gender: "girls" }), "#FFF0F5");
  assert.equal(productGenderBackground({ gender: "unisex" }), "#EAF6F2");
});

test("normalizes inferred legacy genders while preserving saved selections", () => {
  const [legacy, explicit] = normalizeProducts([
    { id: "legacy", name: "男生恤衫", sizes: [] },
    { id: "explicit", name: "男生恤衫", gender: "girls", sizes: [] },
  ]);
  assert.equal(legacy.gender, "boys");
  assert.equal(explicit.gender, "girls");
});
