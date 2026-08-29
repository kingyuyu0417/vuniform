const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const separator = line.indexOf("=");
  if (separator > 0) env[line.slice(0, separator)] = line.slice(separator + 1).trim();
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const apiKey = env.VITE_SUPABASE_ANON_KEY;
const headers = { apikey: apiKey, Authorization: `Bearer ${apiKey}` };
const readJson = (file) => {
  const text = fs.readFileSync(file, "utf8");
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
};
const cleanName = (name) => String(name || "")
  .replace(/（[^）]*）|\([^)]*\)/g, "")
  .replace(/\s+/g, " ")
  .trim();
const keyOf = (product) => `${product.school || "（未分類）"}\u0000${cleanName(product.name)}`;
const sizesOf = (product) => JSON.stringify(product.sizes || []);
const getJson = async (url) => {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
};

(async () => {
  const source = [
    ...readJson(path.join(root, "src", "yanOiTongLauWongFatProducts.json")),
    ...readJson(path.join(root, "src", "dedeLamLatestProducts.json")),
  ];
  const rows = await getJson(`${supabaseUrl}/rest/v1/app_storage?key=eq.products&select=value`);
  const database = rows.length ? JSON.parse(rows[0].value) : [];
  const sourceMap = new Map(source.map((product) => [keyOf(product), product]));
  const databaseMap = new Map(database.map((product) => [keyOf(product), product]));
  const differences = [];
  for (const [key, latest] of sourceMap) {
    const stored = databaseMap.get(key);
    if (!stored) {
      differences.push({ type: "missing-in-database", school: latest.school, name: latest.name });
    } else if (sizesOf(latest) !== sizesOf(stored)) {
      differences.push({ type: "price-or-size-mismatch", school: latest.school, name: latest.name, latest: latest.sizes, database: stored.sizes });
    }
  }
  for (const [key, stored] of databaseMap) {
    if (!sourceMap.has(key)) differences.push({ type: "database-only", school: stored.school, name: stored.name });
  }
  const report = {
    checkedAt: new Date().toISOString(),
    latestSourceProducts: source.length,
    databaseProducts: database.length,
    differences: differences.length,
    details: differences,
  };
  const reportPath = path.join(root, "price-comparison-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ reportPath, latestSourceProducts: source.length, databaseProducts: database.length, differences: differences.length, mismatchSchools: [...new Set(differences.map((item) => item.school))] }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
