import test from "node:test";
import assert from "node:assert/strict";
import {
  englishReceiptProductUnit,
  receiptProductTranslationTerms,
  translateReceiptAttribute,
} from "../../public/receipt-translations.js";

test("translates multi-pair sock sizes and uses pack quantity units", () => {
  assert.equal(translateReceiptAttribute("6對"), "6 pairs");
  assert.equal(englishReceiptProductUnit("白短襪", "6對", 1), "pack");
  assert.equal(englishReceiptProductUnit("白短襪", "6對", 2), "packs");
});

test("translates reusable and plastic bags as product names and size values", () => {
  assert.equal(receiptProductTranslationTerms["環保袋"], "Reusable Bag");
  assert.equal(receiptProductTranslationTerms["膠袋"], "Plastic Bag");
  assert.equal(translateReceiptAttribute("環保袋"), "Reusable Bag");
  assert.equal(translateReceiptAttribute("膠袋"), "Plastic Bag");
});

test("preserves ordinary sock pair units", () => {
  assert.equal(englishReceiptProductUnit("長襪", "均碼", 1), "pairs");
});
