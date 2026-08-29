const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "src");
const tempSql = path.join(process.env.TEMP || ".", "uniform-products-sync.sql");
const read = (name) => JSON.parse(fs.readFileSync(path.join(sourceDir, name), "utf8"));
const escapeSql = (value) => `'${String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
const jsonSql = (value) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;

const allProducts = [
  ...read("yanOiTongLauWongFatProducts.json"),
  ...read("dedeLamLatestProducts.json"),
];
const uniqueProducts = new Map();
allProducts.forEach((product) => uniqueProducts.set(`${product.school || ""}\u0000${product.name}`, product));
const values = [...uniqueProducts.values()]
  .map((product, index) => `(${escapeSql(product.id)}, ${escapeSql(product.school)}, ${escapeSql(product.name)}, ${jsonSql(product.sizes)}, ${index}, now())`)
  .join(",\n");

fs.writeFileSync(tempSql, [
  "create table if not exists public.products_backup_20260828 as select * from public.products;",
  "insert into public.products (id, school, name, sizes, display_order, updated_at) values",
  `${values}`,
  "on conflict (id) do update set school = excluded.school, name = excluded.name, sizes = excluded.sizes, display_order = excluded.display_order, updated_at = now();",
].join("\n"), "utf8");

console.log(JSON.stringify({
  source: allProducts.length,
  unique: uniqueProducts.size,
  culinary: [...uniqueProducts.values()].filter((product) => product.school === "中華廚藝學院").length,
  bradbury: [...uniqueProducts.values()].filter((product) => product.school === "保良局白普理幼稚園").length,
  backupTable: "public.products_backup_20260828",
}));

execFileSync("cmd.exe", ["/d", "/c", `npx.cmd supabase db query --linked --file ${tempSql}`], {
  cwd: root,
  stdio: "inherit",
});