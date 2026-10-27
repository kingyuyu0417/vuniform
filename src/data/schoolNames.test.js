import test from "node:test";
import assert from "node:assert/strict";
import { canonicalSchoolName, schoolCatalogKey } from "./schoolNames.js";

test("normalizes the alternate Tung Koon School name to the catalog name", () => {
  assert.equal(canonicalSchoolName("元朗朗屏屯邨東莞學校"), "元朗朗屏邨東莞學校");
  assert.equal(schoolCatalogKey(" 元朗朗屏屯邨東莞學校 "), "東莞學校");
});

test("preserves existing school aliases and trims surrounding whitespace", () => {
  assert.equal(canonicalSchoolName(" 保良局董玉梯紀念中學 "), "保良局董玉娣中學");
  assert.equal(canonicalSchoolName("測試學校"), "測試學校");
});
