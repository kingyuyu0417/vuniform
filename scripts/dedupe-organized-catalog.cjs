const fs = require("fs");
let text = fs.readFileSync("src/dedeLamLatestProducts.json", "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text);
const groups = new Map();
for (const item of products) {
  const key = `${item.school}\u0000${item.name}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(item);
}
const result = [];
let removedExact = 0;
let markedVariants = 0;
for (const items of groups.values()) {
  const first = items[0];
  result.push(first);
  for (const item of items.slice(1)) {
    if (JSON.stringify(first.sizes) === JSON.stringify(item.sizes)) {
      removedExact++;
    } else {
      result.push({ ...item, name: `${item.name}（冬季）` });
      markedVariants++;
    }
  }
}
fs.writeFileSync("src/dedeLamLatestProducts.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ before: products.length, after: result.length, removedExact, markedVariants }));
