const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const separator = line.indexOf("=");
  if (separator > 0) env[line.slice(0, separator)] = line.slice(separator + 1).trim();
}
const read = (file) => {
  const text = fs.readFileSync(file, "utf8");
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
};
const catalog = [...read(path.join(root, "src", "yanOiTongLauWongFatProducts.json")), ...read(path.join(root, "src", "dedeLamLatestProducts.json"))];
const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" };
(async () => {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/app_storage`, { method: "POST", headers, body: JSON.stringify({ key: "products", value: JSON.stringify(catalog), updated_at: new Date().toISOString() }) });
  if (!response.ok) throw new Error(await response.text());
  const verify = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/app_storage?key=eq.products&select=value`, { headers });
  const rows = await verify.json();
  const stored = rows.length ? JSON.parse(rows[0].value) : [];
  console.log(JSON.stringify({ source: catalog.length, database: stored.length, tuenMunGovernment: stored.filter((item) => item.school === "屯門官立中學").length }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
