import test from "node:test";
import assert from "node:assert/strict";
import {
  createCustomerReceiptOrder,
  englishReceiptProductUnit,
  formatReceiptSize,
  receiptProductTranslationTerms,
  receiptTranslationText,
  receiptSchoolTranslations,
  translateReceiptProductName,
  translateReceiptAttribute,
  translateReceiptSchool,
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

test("translates the school, branch, and products on the provided receipt", () => {
  assert.deepEqual(translateReceiptSchool("培僑小學"), {
    text: "Pui Kiu Primary School",
    translated: true,
  });
  assert.equal(translateReceiptProductName("藍開胸長袖冷衫").text, "Blue Open-front Long-sleeve Jumper");
  assert.equal(translateReceiptProductName("炮台山分店").text, "Fortress Hill Branch");
  assert.equal(translateReceiptProductName("店長").text, "Store Manager");
});

test("retains original names when an English product translation is partial", () => {
  assert.deepEqual(translateReceiptProductName("測試短襪"), {
    text: "Short Socks",
    translated: false,
    original: "測試短襪",
  });
  assert.deepEqual(translateReceiptProductName("自訂新商品"), {
    text: "Untranslated",
    translated: false,
    original: "自訂新商品",
  });
  assert.equal(receiptTranslationText(translateReceiptProductName("自訂新商品")), "自訂新商品");
  assert.equal(receiptTranslationText(translateReceiptSchool("未列入字典的新學校")), "未列入字典的新學校");
});

test("translates catalog schools, composable product names, common sizes, and measurements", () => {
  assert.equal(receiptSchoolTranslations["天主教明德學校"], "MENG TAK CATHOLIC SCHOOL");
  assert.ok(Object.keys(receiptSchoolTranslations).length > 0);
  assert.equal(
    receiptTranslationText(translateReceiptProductName("男女生 - 新款拉鏈連帽運動外套")),
    "Unisex - New Zip-up Hooded Sports Jacket",
  );
  assert.equal(translateReceiptAttribute("加大碼"), "Plus Size");
  assert.equal(translateReceiptAttribute("特大碼"), "Extra Large");
  assert.equal(translateReceiptAttribute("26吋"), "26 inches");
  assert.equal(translateReceiptAttribute("120厘米"), "120 cm");
});

test("formats translated receipt dimensions in English", () => {
  assert.equal(formatReceiptSize("長褲", "30", "40", true), "Trouser length: 40 (Waist: 30)");
  assert.equal(formatReceiptSize("長褲", "30", "40", false), "褲長：40（腰圍：30）");
  assert.equal(formatReceiptSize("上衣", "特大碼", "", true), "Size: Extra Large");
});

test("customer receipt payload masks direct customer identifiers and only includes receipt fields", () => {
  const safeOrder = createCustomerReceiptOrder({
    id: "receipt-1",
    customerName: "陳小明",
    customerPhone: "91234567",
    items: [{ name: "恤衫", receiptNameEn: "Custom Shirt", qty: 1, price: 100, size: "M", privateNote: "do not expose" }],
    replacementSourceReceiptId: "old-receipt",
    settlementDelta: 25,
    settlementCashReceived: 30,
    settlementChangeDue: 5,
    privateNote: "do not expose",
  });

  assert.equal(safeOrder.customerName, "陳");
  assert.equal(safeOrder.customerPhone, "4567");
  assert.equal(JSON.stringify(safeOrder).includes("小明"), false);
  assert.equal(JSON.stringify(safeOrder).includes("91234567"), false);
  assert.equal(JSON.stringify(safeOrder).includes("privateNote"), false);
  assert.equal(safeOrder.items[0].privateNote, undefined);
  assert.equal(safeOrder.items[0].receiptNameEn, "Custom Shirt");
  assert.equal(safeOrder.replacementSourceReceiptId, "old-receipt");
  assert.equal(safeOrder.settlementDelta, 25);
  assert.equal(safeOrder.settlementCashReceived, 30);
  assert.equal(safeOrder.settlementChangeDue, 5);
});
