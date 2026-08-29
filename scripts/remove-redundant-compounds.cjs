const fs = require("fs");
let text = fs.readFileSync("src/dedeLamLatestProducts.json", "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text).map((item) => ({ ...item, name: item.name.replace(/校\s+褸/g, "校褸") }));
const key = (item) => `${item.school}\u0000${item.name}`;
const byKey = new Map(products.map((item) => [key(item), item]));
const redundant = new Set();
for (const item of products) {
  const prefix = item.name.match(/^(男生|女生|男女生)\s*[-–—:：]?\s*/)?.[0] || "";
  const body = item.name.slice(prefix.length);
  const parts = body.split(/\s[-–—]\s|\s[-–—]/).filter(Boolean);
  if (parts.length !== 2 || /套裝|配|或/.test(body) || item.sizes.length % 2 !== 0) continue;
  const midpoint = item.sizes.length / 2;
  const first = { school: item.school, name: `${prefix.trim()} - ${parts[0].trim()}`, sizes: item.sizes.slice(0, midpoint) };
  const second = { school: item.school, name: `${prefix.trim()} - ${parts[1].trim()}`, sizes: item.sizes.slice(midpoint) };
  const firstMatch = byKey.get(key(first));
  const secondMatch = byKey.get(key(second));
  if (firstMatch && secondMatch && JSON.stringify(firstMatch.sizes) === JSON.stringify(first.sizes) && JSON.stringify(secondMatch.sizes) === JSON.stringify(second.sizes)) redundant.add(item.id);
}
const result = products.filter((item) => !redundant.has(item.id));
fs.writeFileSync("src/dedeLamLatestProducts.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ before: products.length, after: result.length, removedRedundantCompounds: redundant.size }));
