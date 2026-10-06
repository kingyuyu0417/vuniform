import test from "node:test";
import assert from "node:assert/strict";
import {
  isVerifiedPriceLayoutRow,
  mergePriceLayouts,
  toVerifiedPriceLayoutRows,
} from "./price-layout-store.js";

const builtIn = {
  school: "Example School",
  sheet: "Sheet1",
  season: "冬",
  signature: "A;A,B",
  blocks: [{
    id: "shirt",
    dataFirst: 3,
    dataLast: 5,
    sizeCol: "A",
    priceCols: [{ col: "B", kind: "unit" }],
  }],
};

test("uses a verified school-and-sheet config to override its built-in layout", () => {
  const stored = {
    ...builtIn,
    season: "夏",
    blocks: [{ ...builtIn.blocks[0], dataLast: 8 }],
  };
  const rows = toVerifiedPriceLayoutRows([stored]);

  assert.equal(isVerifiedPriceLayoutRow(rows[0]), true);
  assert.deepEqual(mergePriceLayouts([builtIn], rows), [{ ...stored, learned: true }]);
});

test("ignores unverified or malformed stored layouts", () => {
  const unverified = { ...toVerifiedPriceLayoutRows([builtIn])[0], verified: false };
  const malformed = {
    ...toVerifiedPriceLayoutRows([builtIn])[0],
    config: { ...builtIn, blocks: [{ ...builtIn.blocks[0], priceCols: [] }] },
  };

  assert.equal(isVerifiedPriceLayoutRow(unverified), false);
  assert.equal(isVerifiedPriceLayoutRow(malformed), false);
  assert.deepEqual(mergePriceLayouts([builtIn], [unverified, malformed]), [builtIn]);
});

test("adds verified layouts for schools without a built-in config", () => {
  const newSchool = { ...builtIn, school: "New School", sheet: "Prices" };
  assert.deepEqual(mergePriceLayouts([builtIn], toVerifiedPriceLayoutRows([newSchool])), [builtIn, { ...newSchool, learned: true }]);
});
