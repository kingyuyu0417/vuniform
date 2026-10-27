import assert from "node:assert/strict";
import test from "node:test";
import { createReceiptQrCode, createReceiptQrMatrix } from "./receiptQrCode.js";

test("creates a valid QR matrix for a customer receipt URL", () => {
  const modules = createReceiptQrMatrix(
    "https://uniform-pos-app-current.pages.dev/receipt.html?lang=zh&z=compressed-receipt",
  );

  assert.ok(modules.length > 0);
  assert.equal(modules.length, modules[0].length);
  assert.ok(modules.every((row) => row.every((cell) => typeof cell === "boolean")));
});

test("rejects receipt URLs that exceed QR code capacity", () => {
  assert.throws(() => createReceiptQrMatrix(`https://example.com/${"x".repeat(20000)}`));
});

test("builds the SVG path and viewbox dimensions for a receipt QR code", () => {
  const { path, moduleCount } = createReceiptQrCode("https://example.com/receipt");

  assert.ok(path.startsWith("M"));
  assert.ok(moduleCount > 0);
});
