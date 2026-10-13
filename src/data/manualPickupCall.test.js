import test from "node:test";
import assert from "node:assert/strict";
import {
  formatManualPickupAnnouncement,
  normalizeManualPickupNumber,
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

test("pickup announcement contains only the entered number and pickup message", () => {
  assert.equal(formatManualPickupAnnouncement("1"), "1號請取貨");
  assert.equal(formatManualPickupAnnouncement("001"), "1號請取貨");
  assert.equal(formatManualPickupAnnouncement("0"), "");
});
