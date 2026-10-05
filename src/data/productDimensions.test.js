import test from "node:test";
import assert from "node:assert/strict";
import { dimensionLabels } from "./productDimensions.js";

test("formats the same size dimensions as the sale page", () => {
  assert.deepEqual(dimensionLabels("校裙"), { length: "裙長", size: "上圍" });
  assert.deepEqual(dimensionLabels("白色長袖恤衫"), { length: "袖長", size: "領圍" });
  assert.deepEqual(dimensionLabels("藏青色短褲"), { length: "褲長", size: "腰圍" });
  assert.deepEqual(dimensionLabels("短袖恤衫"), { length: "", size: "尺碼" });
});
