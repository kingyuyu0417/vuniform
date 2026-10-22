import test from "node:test";
import assert from "node:assert/strict";
import { cleanProductName } from "./productNames.js";

test("preserves parenthetical content in product names", () => {
  assert.equal(cleanProductName("冬季 長袖底衫（加厚款）"), "冬季 長袖底衫（加厚款）");
  assert.equal(cleanProductName("運動外套 (新款)"), "運動外套 (新款)");
  assert.equal(cleanProductName("男生黑色短襪（3對）"), "男生黑色短襪（3對）");
});

test("still normalizes whitespace and removes preceding concatenated product names", () => {
  assert.equal(cleanProductName("  恤衫   （冬季） "), "恤衫 （冬季）");
  assert.equal(cleanProductName(`男生${"款".repeat(50)} 女生短袖恤衫`), "女生短袖恤衫");
});
