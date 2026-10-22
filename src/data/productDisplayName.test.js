import test from "node:test";
import assert from "node:assert/strict";
import { productDisplayName } from "./productDisplayName.js";

test("hides general-use and all-season labels from displayed names", () => {
  assert.equal(productDisplayName("兩季通用 男女通用 冷衫（開胸長袖）"), "冷衫（開胸長袖）");
  assert.equal(productDisplayName("四季通用 男女通用 運動上衣（長袖）"), "運動上衣（長袖）");
  assert.equal(productDisplayName("男女通用 兩季通用 底衫（長袖）"), "底衫（長袖）");
});

test("preserves specific season and product style labels", () => {
  assert.equal(productDisplayName("冬季 女生 恤衫（長袖／圓領）"), "冬季 恤衫（長袖／圓領）");
  assert.equal(productDisplayName("夏季 男女生 校裙（背心裙）"), "夏季 校裙（背心裙）");
  assert.equal(productDisplayName("Boy's Sports Jacket"), "Sports Jacket");
});
