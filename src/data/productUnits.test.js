import test from "node:test";
import assert from "node:assert/strict";
import { productUnit } from "./productUnits.js";

test("uses packs for socks sold in multi-pair sizes", () => {
  for (const size of ["3對", "6對", "12對"]) {
    assert.equal(productUnit("白短襪", size), "包");
  }
});

test("accepts size objects and preserves pair units for ordinary socks", () => {
  assert.equal(productUnit("白短襪", { size: "3對" }), "包");
  assert.equal(productUnit("女生黑色長襪", "均碼"), "對");
});

test("does not treat multi-pair sizes of non-sock products as packs", () => {
  assert.equal(productUnit("恤衫", "3對"), "件");
});
