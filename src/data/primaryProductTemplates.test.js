import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDefaultProductName,
  getDefaultProductOptions,
  getPrimaryProductSizePreset,
  getProductStyleLabel,
  getProductSelectorOptions,
  normalizeProductOptions,
  parseProductDimensionPairs,
  parseProductSizeMatrix,
  parseProductSizeLabels,
  PRIMARY_PRODUCT_CATEGORIES,
  PRODUCT_SEASON_OPTIONS,
  splitProductSizePairs,
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
  assert.equal(winterShirt.source, "男女尖領長袖恤衫尺碼總表");
  assert.equal(winterShirt.sizes.length, 32);

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
    options: { sleeve: "long", collar: "round" },
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
      season: "winter",
      gender: "unisex",
      category: "undershirt",
      options: { style: "long-sleeve" },
      sizes: ["20", "22", "24", "26", "28", "30", "32", "34", "36"],
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

test("matches shirt size tables by school level, sleeve length, gender, and collar", () => {
  const longPoint = getPrimaryProductSizePreset({
    schoolLevel: "中學",
    season: "winter",
    gender: "girls",
    category: "shirt",
    options: { sleeve: "long", collar: "point" },
  });
  assert.equal(longPoint.sizes.length, 32);
  assert.equal(longPoint.sizes[4], "12.5×24*");
  assert.equal(longPoint.sizes.at(-1), "21.5×36**");
  const pairedLongPointSizes = splitProductSizePairs(longPoint.sizes);
  assert.equal(pairedLongPointSizes.lengths.length, 32);
  assert.equal(pairedLongPointSizes.lengths[4], "12.5");
  assert.equal(pairedLongPointSizes.sizes[4], "24*");
  assert.equal(pairedLongPointSizes.sizes.at(-1), "36**");

  assert.deepEqual(getPrimaryProductSizePreset({
    schoolLevel: "小學",
    season: "summer",
    gender: "girls",
    category: "shirt",
    options: { sleeve: "long", collar: "round" },
  }).sizes, ["14", "16", "18", "20", "22", "24", "26", "28", "30", "32", "34"]);
  assert.deepEqual(getPrimaryProductSizePreset({
    schoolLevel: "中學",
    season: "summer",
    gender: "girls",
    category: "shirt",
    options: { sleeve: "long", collar: "round" },
  }).sizes, ["34", "36", "38", "40", "43", "46"]);
  assert.deepEqual(getPrimaryProductSizePreset({
    schoolLevel: "小學",
    season: "summer",
    gender: "boys",
    category: "shirt",
    options: { sleeve: "short", collar: "up-down" },
  }).sizes, ["11", "11.5", "12", "12.5", "13", "13.5", "14", "14.5", "15", "15.5", "16", "16.5", "17", "17.5", "18", "18.5", "19", "19.5", "20", "21", "22"]);
  assert.deepEqual(getPrimaryProductSizePreset({
    schoolLevel: "小學",
    season: "summer",
    gender: "girls",
    category: "shirt",
    options: { sleeve: "short", collar: "hawaiian" },
  }).sizes, ["18", "20", "22", "24", "26", "28", "30", "32", "34", "36"]);
});

test("provides the agreed primary and secondary trousers size sets", () => {
  assert.deepEqual(getPrimaryProductSizePreset({
    schoolLevel: "小學",
    season: "summer",
    gender: "boys",
    category: "trousers",
    options: { length: "short" },
  }).sizes, ["12", "13", "14", "15", "16", "17", "18", "19", "20", "22"]);
  assert.deepEqual(getPrimaryProductSizePreset({
    schoolLevel: "小學",
    season: "winter",
    gender: "girls",
    category: "trousers",
    options: { length: "long" },
  }).sizes, ["26", "28", "30", "32", "34", "36", "38", "40", "42"]);

  const secondaryTrousers = getPrimaryProductSizePreset({
    schoolLevel: "中學",
    season: "winter",
    gender: "boys",
    category: "trousers",
    options: { length: "long" },
  });
  assert.deepEqual(secondaryTrousers.matrix.lengths, ["33", "34", "35", "36", "37", "38", "38.5", "40", "41.5", "42", "43", "44", "44.5", "46"]);
  assert.deepEqual(secondaryTrousers.matrix.sizes, ["24", "25", "26", "27", "28", "29", "30", "32", "34", "36", "38", "40", "42", "44", "46", "48", "50", "52"]);
  assert.deepEqual(secondaryTrousers.sizes, secondaryTrousers.matrix.sizes);
  assert.equal(secondaryTrousers.matrix.lengths.length * secondaryTrousers.matrix.sizes.length, 252);
  assert.equal(secondaryTrousers.surchargeRules, "32+=0,40=10,41.5+=20,43+=30");
});

test("provides the agreed skirt length by chest-width matrix", () => {
  const skirt = getPrimaryProductSizePreset({
    schoolLevel: "中學",
    season: "winter",
    gender: "girls",
    category: "skirt",
    options: { style: "long" },
  });
  assert.deepEqual(skirt.matrix, {
    lengths: ["36", "38", "40", "42", "44"],
    sizes: ["36", "38", "40", "42", "44", "46"],
  });
  assert.equal(parseProductSizeMatrix(skirt.matrix.lengths.join(","), skirt.matrix.sizes.join(",")).combinations.length, 30);
});

test("supports custom and blank shirt collar labels", () => {
  assert.equal(getProductStyleLabel("shirt", { sleeve: "long", collar: "other", collarCustom: "企領" }), "長袖／企領");
  assert.equal(getProductStyleLabel("shirt", { sleeve: "long", collar: "unspecified" }), "長袖");
  assert.deepEqual(getProductSelectorOptions("shirt", "collar", "boys", { schoolLevel: "小學", sleeve: "short" }).map(({ value }) => value), [
    "up-down", "hawaiian", "swallow", "eight-character", "other", "unspecified",
  ]);
});

test("parses editable comma-separated, newline-separated, and duplicate size labels", () => {
  assert.deepEqual(parseProductSizeLabels("24，26\n28、裁碼, 26"), ["24", "26", "28", "裁碼"]);
});

test("splits combined shirt sizes into paired collar and sleeve dimensions", () => {
  assert.deepEqual(splitProductSizePairs(["11.5×22", "12×23", "12.5×24*", "21.5×36**"]), {
    lengths: ["11.5", "12", "12.5", "21.5"],
    sizes: ["22", "23", "24*", "36**"],
  });
  assert.equal(splitProductSizePairs(["11.5×22", "invalid"]), null);
});

test("pairs separately entered dimensions in order and rejects mismatched counts", () => {
  assert.deepEqual(parseProductDimensionPairs("11.5, 12\n12.5", "22, 23，24*"), [
    { length: "11.5", size: "22", price: null },
    { length: "12", size: "23", price: null },
    { length: "12.5", size: "24*", price: null },
  ]);
  assert.equal(parseProductDimensionPairs("11.5, 12", "22"), null);
});

test("builds a Cartesian size matrix and removes duplicate dimension labels", () => {
  const matrix = parseProductSizeMatrix("36, 38, 38", "36, 40");
  assert.deepEqual(matrix.lengths, ["36", "38"]);
  assert.deepEqual(matrix.sizes, ["36", "40"]);
  assert.deepEqual(matrix.combinations, [
    { length: "36", size: "36", price: null },
    { length: "36", size: "40", price: null },
    { length: "38", size: "36", price: null },
    { length: "38", size: "40", price: null },
  ]);
  assert.equal(parseProductSizeMatrix("", "36"), null);
});
