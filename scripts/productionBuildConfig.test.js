import test from "node:test";
import assert from "node:assert/strict";
import { validateProductionBuildConfig } from "./productionBuildConfig.js";

test("accepts configured Supabase production settings", () => {
  assert.deepEqual(validateProductionBuildConfig({
    VITE_SUPABASE_URL: "https://uniformpos-prod.supabase.co",
    VITE_SUPABASE_ANON_KEY: "sb_publishable_publickey123",
  }), []);
});

test("rejects missing production Supabase settings", () => {
  assert.deepEqual(validateProductionBuildConfig({}), [
    "VITE_SUPABASE_URL must be a valid Supabase project URL.",
    "VITE_SUPABASE_ANON_KEY must be a configured Supabase public key.",
  ]);
});

test("rejects placeholder production settings", () => {
  assert.deepEqual(validateProductionBuildConfig({
    VITE_SUPABASE_URL: "https://xxx.supabase.co",
    VITE_SUPABASE_ANON_KEY: "sb_publishable_xxx",
  }), [
    "VITE_SUPABASE_URL must be a valid Supabase project URL.",
    "VITE_SUPABASE_ANON_KEY must be a configured Supabase public key.",
  ]);
});
