import assert from "node:assert/strict";
import test from "node:test";
import { naturalSizeSort } from "./sizeSort.js";

const sortSizes = (sizes) => sizes.toSorted(naturalSizeSort);

test("sorts standard apparel sizes in the requested order before numbers", () => {
  assert.deepEqual(
    sortSizes(["12", "XXL", "M", "XS", "2", "XXS", "XL", "L", "S", "10"]),
    ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2", "10", "12"],
  );
});

test("sorts numerical sizes by numeric value before Chinese sizes", () => {
  assert.deepEqual(sortSizes(["中文", "10", "2", "一", "1"]), ["1", "2", "10", "一", "中文"]);
});

test("sorts Chinese sizes by stroke collation", () => {
  assert.deepEqual(sortSizes(["三", "四", "一", "二"]), ["一", "二", "三", "四"]);
});

test("keeps tailored sizes after standard, numeric, and Chinese sizes", () => {
  assert.deepEqual(sortSizes(["裁碼", "M", "2", "大"]), ["M", "2", "大", "裁碼"]);
});
