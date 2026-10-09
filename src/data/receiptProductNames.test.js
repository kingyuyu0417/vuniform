import test from "node:test";
import assert from "node:assert/strict";
import { buildReceiptNameCandidates } from "./receiptProductNames.js";

test("suggests composable English receipt names for products mentioned in Chinese notices", () => {
  const candidates = buildReceiptNameCandidates(
    { productsFound: ["運動外套"] },
    [
      { id: "jacket", school: "測試學校", name: "男女生 - 新款拉鏈連帽運動外套" },
      { id: "shirt", school: "測試學校", name: "白色長袖恤衫" },
      { id: "other-school", school: "其他學校", name: "男女生 - 新款拉鏈連帽運動外套" },
    ],
    "測試學校",
  );

  assert.deepEqual(candidates, [{
    productId: "jacket",
    productName: "男女生 - 新款拉鏈連帽運動外套",
    noticeName: "運動外套",
    existingEnglishName: "",
    suggestedEnglishName: "Unisex - New Zip-up Hooded Sports Jacket",
    needsManualTranslation: false,
  }]);
});

test("requires manual input for unknown Chinese product names and preserves saved names", () => {
  const candidates = buildReceiptNameCandidates(
    { productsFound: ["運動衫"] },
    [{ id: "custom", school: "測試學校", name: "自訂新運動衫", receiptNameEn: "Custom Sports Top" }],
    "測試學校",
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].suggestedEnglishName, "");
  assert.equal(candidates[0].existingEnglishName, "Custom Sports Top");
  assert.equal(candidates[0].needsManualTranslation, true);
});

test("does not produce candidates when the notice has no recognized products", () => {
  assert.deepEqual(buildReceiptNameCandidates({ productsFound: [] }, [
    { id: "shirt", school: "測試學校", name: "白色長袖恤衫" },
  ], "測試學校"), []);
});

test("does not guess a school when neither the notice nor the product page has one selected", () => {
  assert.deepEqual(buildReceiptNameCandidates({ productsFound: ["恤衫"] }, [
    { id: "shirt", school: "測試學校", name: "白色長袖恤衫" },
  ]), []);
});
