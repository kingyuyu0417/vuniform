import test from "node:test";
import assert from "node:assert/strict";
import { buildGoogleTranslateUrl } from "../../public/receipt-google-translate.js";

test("creates a Google Translate link that preserves the complete receipt URL", () => {
  const receiptUrl = "https://uniform-pos-app-current.pages.dev/receipt.html?lang=zh&z=compressed-receipt";
  const translateUrl = new URL(buildGoogleTranslateUrl(receiptUrl));

  assert.equal(translateUrl.origin, "https://translate.google.com");
  assert.equal(translateUrl.pathname, "/translate");
  assert.equal(translateUrl.searchParams.get("sl"), "zh-TW");
  assert.equal(translateUrl.searchParams.get("tl"), "en");
  assert.equal(translateUrl.searchParams.get("u"), receiptUrl);
});

test("rejects non-web receipt URLs", () => {
  assert.throws(() => buildGoogleTranslateUrl("javascript:alert(1)"), /HTTP or HTTPS/);
});

test("uses the standalone receipt document for extensionless receipt links", () => {
  const translateUrl = new URL(buildGoogleTranslateUrl(
    "https://uniform-pos-app-current.pages.dev/receipt?lang=zh&z=compressed-receipt",
  ));

  assert.equal(
    translateUrl.searchParams.get("u"),
    "https://uniform-pos-app-current.pages.dev/receipt.html?lang=zh&z=compressed-receipt",
  );
});
