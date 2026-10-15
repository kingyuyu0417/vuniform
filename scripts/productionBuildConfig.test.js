import test from "node:test";
import assert from "node:assert/strict";
import {
  readWranglerProductionVariables,
  validateProductionBuildConfig,
} from "./productionBuildConfig.js";

test("loads only production Vite variables from the Wrangler configuration", () => {
  const variables = readWranglerProductionVariables(`
VITE_SUPABASE_URL = "https://ignored.supabase.co"

[env.production.vars]
VITE_SUPABASE_URL = "https://uniformpos-prod.supabase.co"
VITE_SUPABASE_ANON_KEY = "sb_publishable_publickey123"
SECRET_VALUE = "never exposed"

[env.preview.vars]
VITE_SUPABASE_URL = "https://preview.supabase.co"
`);

  assert.deepEqual(variables, {
    VITE_SUPABASE_URL: "https://uniformpos-prod.supabase.co",
    VITE_SUPABASE_ANON_KEY: "sb_publishable_publickey123",
  });
});

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
