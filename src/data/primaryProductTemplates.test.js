import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDefaultProductName,
  getDefaultProductOptions,
  getPrimaryProductSizePreset,
  getProductStyleLabel,
  getProductSelectorOptions,
  normalizeProductOptions,
  parseProductSizeLabels,
  PRIMARY_PRODUCT_CATEGORIES,
  PRODUCT_SEASON_OPTIONS,
} from "./primaryProductTemplates.js";

test("defines the agreed seasonal and primary-school product categories", () => {
  assert.deepEqual(PRODUCT_SEASON_OPTIONS.map(({ value }) => value), ["summer", "winter", "all"]);
  assert.deepEqual(PRIMARY_PRODUCT_CATEGORIES.map(({ value }) => value), [
    "shirt", "skirt", "trousers", "sweater", "school-jacket", "sports-top",
    "sports-trousers", "sports-jacket", "undershirt", "tie", "socks", "belt",
  ]);
});

test("builds a name and style label from the selected product options", () => {
  const options = { sleeve: "long", collar: "round" };
  assert.equal(getProductStyleLabel("shirt", options), "長袖／圓領");
  assert.equal(buildDefaultProductName({
    season: "winter",
    gender: "girls",
    category: "shirt",
    options,
  }), "冬季 女裝 恤衫（長袖／圓領）");
  assert.deepEqual(getDefaultProductOptions("shirt", "boys"), { sleeve: "short", collar: "round" });
  assert.deepEqual(getProductSelectorOptions("tie", "style", "girls").map(({ value }) => value), ["butterfly-tie"]);
  assert.deepEqual(normalizeProductOptions("tie", "girls", { style: "bow-tie" }), { style: "butterfly-tie" });
});

test("provides school-specific, season- and style-matched sizes without prices", () => {
  const winterShirt = getPrimaryProductSizePreset({
    school: "蘇浙小學",
    season: "winter",
    gender: "boys",
    category: "shirt",
    options: { sleeve: "long", collar: "point" },
  });
  assert.equal(winterShirt.source, "冬 2026 男白長袖恤連章");
  assert.deepEqual(winterShirt.sizes, ["10", "10.5", "11", "11.5", "12", "12.5", "13", "裁碼"]);

  const summerSportPants = getPrimaryProductSizePreset({
    school: "蘇浙小學",
    season: "summer",
    gender: "unisex",
    category: "sports-trousers",
    options: { length: "short" },
  });
  assert.deepEqual(summerSportPants.sizes, ["XS", "S", "M", "L", "XL", "裁碼"]);
  assert.equal(getPrimaryProductSizePreset({
    school: "其他小學",
    season: "winter",
    gender: "boys",
    category: "shirt",
    options: { sleeve: "long", collar: "point" },
  }), null);
  assert.equal(getPrimaryProductSizePreset({
    school: "蘇浙小學",
    season: "all",
    gender: "unisex",
    category: "belt",
  }), null);
});

test("uses the corresponding workbook size sets for dresses, sweaters, undershirts, and socks", () => {
  const cases = [
    {
      season: "summer",
      gender: "girls",
      category: "skirt",
      options: { style: "short" },
      sizes: ["22", "24", "26", "28", "30", "32", "34", "36", "裁碼"],
    },
    {
      season: "winter",
      gender: "girls",
      category: "sweater",
      options: { style: "v-neck-vest" },
      sizes: ["6", "8", "10", "12", "14", "16", "18", "裁碼"],
    },
    {
      season: "summer",
      gender: "unisex",
      category: "undershirt",
      options: { style: "vest" },
      sizes: ["2-6", "8-12", "14-18", "S-XL"],
    },
    {
      season: "summer",
      gender: "unisex",
      category: "socks",
      options: { style: "short" },
      sizes: ["一對", "三對", "半打", "一打"],
    },
  ];
  cases.forEach(({ sizes, ...selection }) => {
    const preset = getPrimaryProductSizePreset({ school: "蘇浙小學", ...selection });
    assert.deepEqual(preset?.sizes, sizes, `${selection.season} ${selection.category}`);
  });
});

test("parses editable comma-separated, newline-separated, and duplicate size labels", () => {
  assert.deepEqual(parseProductSizeLabels("24，26\n28、裁碼, 26"), ["24", "26", "28", "裁碼"]);
});
