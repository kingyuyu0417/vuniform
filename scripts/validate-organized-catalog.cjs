const fs = require("fs");
let text = fs.readFileSync("src/dedeLamLatestProducts.json", "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text);
const ids = new Set();
const names = new Set();
const issues = [];
for (const item of products) {
  if (!item.id || ids.has(item.id)) issues.push({ type: "duplicate-id", id: item.id, name: item.name });
  ids.add(item.id);
  const key = `${item.school}\u0000${item.name}`;
  if (names.has(key)) issues.push({ type: "duplicate-school-name", school: item.school, name: item.name });
  names.add(key);
  if (!item.name || !item.sizes?.length || item.sizes.some((size) => size.size === undefined || size.price === undefined)) issues.push({ type: "invalid-product", school: item.school, name: item.name });
}
console.log(JSON.stringify({ products: products.length, uniqueIds: ids.size, issues: issues.length, examples: issues.slice(0, 20) }, null, 2));
process.exitCode = issues.length ? 1 : 0;
