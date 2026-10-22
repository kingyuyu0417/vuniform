import test from "node:test";
import assert from "node:assert/strict";
import qrcode from "qrcode-generator";
import { decodeReceiptQrPayload, encodeReceiptQrPayload } from "./receiptQrPayload.js";

test("compresses a full customer receipt payload and restores it without data loss", async () => {
  const receipt = JSON.stringify({
    id: "VU-20261022-0001",
    school: "聖安多尼學校",
    items: Array.from({ length: 30 }, (_, index) => ({
      name: "冬季白色尖領長袖恤",
      size: String(24 + index),
      length: "24",
      qty: 1,
      price: 90,
    })),
  });

  const encoded = await encodeReceiptQrPayload(receipt);

  assert.equal(encoded.parameter, "z");
  assert.ok(encoded.value.length < receipt.length);
  assert.equal(await decodeReceiptQrPayload(encoded), receipt);

  const compressedQr = qrcode(0, "M");
  compressedQr.addData(`https://uniform-pos-app-current.pages.dev/receipt.html?lang=zh&${encoded.parameter}=${encoded.value}`);
  compressedQr.make();
  assert.ok(compressedQr.getModuleCount() <= 85);

  const legacyBytes = new TextEncoder().encode(receipt);
  let legacyBinary = "";
  legacyBytes.forEach((byte) => { legacyBinary += String.fromCharCode(byte); });
  const legacyQr = qrcode(0, "L");
  legacyQr.addData(`https://uniform-pos-app-current.pages.dev/receipt.html?lang=zh&data=${encodeURIComponent(btoa(legacyBinary))}`);
  assert.throws(() => legacyQr.make());
});

test("keeps short and legacy receipt payloads uncompressed and supports Unicode", async () => {
  const receipt = JSON.stringify({ id: "短單", total: 20 });
  const encoded = await encodeReceiptQrPayload(receipt);

  assert.equal(encoded.parameter, "data");
  assert.equal(await decodeReceiptQrPayload(encoded), receipt);
  assert.equal(await decodeReceiptQrPayload({
    parameter: "data",
    value: "eyJpZCI6IlZVLTAwMDEifQ",
  }), "{\"id\":\"VU-0001\"}");
});
