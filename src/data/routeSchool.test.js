import assert from "node:assert/strict";
import test from "node:test";
import { getSchoolFromStaffRoute } from "./routeSchool.js";

test("reads the school from direct staff page links", () => {
  const school = "中華傳道會劉永生中學";
  assert.equal(getSchoolFromStaffRoute("/products", `?school_id=${encodeURIComponent(school)}`), school);
  assert.equal(getSchoolFromStaffRoute("/menu", `?school=${encodeURIComponent(school)}`), school);
});

test("does not apply a public route school to staff selection", () => {
  assert.equal(getSchoolFromStaffRoute("/queue-status", "?school_id=示範中學"), "");
  assert.equal(getSchoolFromStaffRoute("/queue-display", "?school_id=示範中學"), "");
});
