import test from "node:test";
import assert from "node:assert/strict";
import {
  formatManualPickupAnnouncement,
  getPickupSpeechErrorMessage,
  getPickupSpeechStartDelayMs,
  normalizeManualPickupNumber,
  retryInterruptedPickupSpeech,
} from "./manualPickupCall.js";

test("manual pickup numbers normalize digits from 1 through 999", () => {
  assert.equal(normalizeManualPickupNumber("1"), "1");
  assert.equal(normalizeManualPickupNumber("001"), "1");
  assert.equal(normalizeManualPickupNumber("999"), "999");
});

test("manual pickup numbers reject empty, zero, non-numeric, and out-of-range input", () => {
  for (const input of ["", "0", "1000", "-1", "1A", "1.5", "１２"]) {
    assert.equal(normalizeManualPickupNumber(input), "", `expected ${JSON.stringify(input)} to be rejected`);
  }
});

test("pickup announcements use the selected spoken language", () => {
  assert.equal(formatManualPickupAnnouncement("1", "yue"), "1號請取貨");
  assert.equal(formatManualPickupAnnouncement("001", "yue"), "1號請取貨");
  assert.equal(formatManualPickupAnnouncement("1", "en"), "Number 1, please collect your order.");
  assert.equal(formatManualPickupAnnouncement("1", "zh"), "1号请取货");
  assert.equal(formatManualPickupAnnouncement("1", "unsupported"), "");
  assert.equal(formatManualPickupAnnouncement("0", "yue"), "");
});

test("pickup speech is scheduled shortly before the chime ends to offset speech startup delay", () => {
  assert.equal(getPickupSpeechStartDelayMs(1.45), 1150);
  assert.equal(getPickupSpeechStartDelayMs(0.2), 0);
});

test("pickup speech errors use actionable localized messages", () => {
  assert.match(getPickupSpeechErrorMessage("interrupted"), /已重試/);
  assert.match(getPickupSpeechErrorMessage("canceled"), /已取消/);
  assert.match(getPickupSpeechErrorMessage("not-allowed"), /未允許/);
  assert.match(getPickupSpeechErrorMessage("unknown"), /檢查裝置語音設定/);
  assert.doesNotMatch(getPickupSpeechErrorMessage("interrupted"), /interrupted/);
});

test("pickup speech retries one interrupted utterance and resumes paused synthesis", async () => {
  let attempts = 0;
  let resumed = 0;
  const result = await retryInterruptedPickupSpeech(async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error("interrupted"), { name: "interrupted" });
    return "spoken";
  }, {
    resume: () => { resumed += 1; },
    wait: async (milliseconds) => assert.equal(milliseconds, 300),
  });

  assert.equal(result, "spoken");
  assert.equal(attempts, 2);
  assert.equal(resumed, 1);
});

test("pickup speech does not retry unrelated or repeated synthesis errors", async () => {
  let attempts = 0;
  await assert.rejects(retryInterruptedPickupSpeech(async () => {
    attempts += 1;
    throw Object.assign(new Error("unavailable"), { name: "not-allowed" });
  }), { name: "not-allowed" });
  assert.equal(attempts, 1);

  attempts = 0;
  await assert.rejects(retryInterruptedPickupSpeech(async () => {
    attempts += 1;
    throw Object.assign(new Error("interrupted"), { name: "interrupted" });
  }, { wait: async () => {} }), { name: "interrupted" });
  assert.equal(attempts, 2);
});
