import assert from "node:assert/strict";
import test from "node:test";
import { getProductImportDimensions } from "./productImportDimensions.js";

test("maps shirt collar and sleeve headers to the catalog dimension fields", () => {
  assert.deepEqual(getProductImportDimensions({ "領 圍": "32", "袖長": "16" }), {
    length: "32",
    size: "16",
  });
});

test("maps trouser dimensions and keeps canonical size headers", () => {
  assert.deepEqual(getProductImportDimensions({ "褲長": "40", "腰圍": "30" }), {
    length: "40",
    size: "30",
  });
  assert.deepEqual(getProductImportDimensions({ 長度: "38", 尺碼: "M" }), {
    length: "38",
    size: "M",
  });
});
