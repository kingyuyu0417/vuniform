import test from "node:test";
import assert from "node:assert/strict";
import { findProductForOrderItem } from "./orderProductMatching.js";

const suzhouSweater = {
  id: "suzhou-vest",
  school: "蘇浙小學",
  branch_id: "fortress-hill",
  name: "兩季通用 男女通用 冷衫（V領背心）",
  sizes: [{ size: "8", price: 109 }],
};
const fanlingSweater = {
  id: "fanling-vest",
  school: "粉嶺官立中學",
  branch_id: "tai-po",
  name: "兩季通用 男女通用 冷衫（V領背心）",
  sizes: [{ size: "36", price: 110 }],
};

test("resolves same-name receipt items from the receipt school", () => {
  const product = findProductForOrderItem(
    [suzhouSweater, fanlingSweater],
    { school: "粉嶺官立中學", branchId: "tai-po" },
    { name: fanlingSweater.name, size: "36" },
  );

  assert.equal(product, fanlingSweater);
});

test("prefers the receipt branch when the same school has duplicate product names", () => {
  const otherBranchProduct = {
    ...fanlingSweater,
    id: "fanling-other-branch",
    branch_id: "sha-tin",
  };
  const product = findProductForOrderItem(
    [otherBranchProduct, fanlingSweater],
    { school: "粉嶺官立中學", branchId: "tai-po" },
    { name: fanlingSweater.name },
  );

  assert.equal(product, fanlingSweater);
});

test("does not fall back to a same-name product from a different school", () => {
  const product = findProductForOrderItem(
    [suzhouSweater],
    { school: "粉嶺官立中學", branchId: "tai-po" },
    { name: suzhouSweater.name },
  );

  assert.equal(product, null);
});

test("ignores another school's product ID and falls back within the receipt school", () => {
  const product = findProductForOrderItem(
    [suzhouSweater, fanlingSweater],
    { school: "粉嶺官立中學" },
    { productId: "suzhou-vest", name: suzhouSweater.name },
  );

  assert.equal(product, fanlingSweater);
});
