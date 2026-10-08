import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { createPriceListWorkbook } from "./priceListExport.js";

test("exports price lists as a readable Excel worksheet with school, size, length, and price", () => {
  const workbook = createPriceListWorkbook(XLSX, [
    {
      name: "男生長褲",
      school: "測試學校",
      sizes: [
        { size: "30", length: "29", price: 128 },
        { size: "30", length: "30", price: 135 },
      ],
    },
  ], (product) => product.school);
  const worksheet = workbook.Sheets["價目表"];

  assert.ok(worksheet);
  assert.deepEqual(XLSX.utils.sheet_to_json(worksheet, { header: 1 }), [
    ["學校", "款式名稱", "尺碼", "長度", "價錢"],
    ["測試學校", "男生長褲", "30", "29", 128],
    ["測試學校", "男生長褲", "30", "30", 135],
  ]);
  assert.equal(worksheet["!autofilter"].ref, "A1:E3");
});
