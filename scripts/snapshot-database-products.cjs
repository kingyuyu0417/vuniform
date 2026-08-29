const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) { const i = line.indexOf("="); if (i > 0) env[line.slice(0, i)] = line.slice(i + 1).trim(); }
(async () => {
  const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` };
  const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/app_storage?key=eq.products&select=value`, { headers });
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json();
  const products = rows.length ? JSON.parse(rows[0].value) : [];
  fs.writeFileSync(path.join(root, "database-products-snapshot.json"), `${JSON.stringify(products, null, 2)}\n`, "utf8");
  console.log(`DATABASE_PRODUCTS=${products.length}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
