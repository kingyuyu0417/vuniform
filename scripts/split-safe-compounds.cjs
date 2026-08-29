const fs = require("fs");
const path = require("path");
const file = path.resolve(__dirname, "../src/dedeLamLatestProducts.json");
let text = fs.readFileSync(file, "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text);
const prefix = /^(男生|女生|男女生)\s*[-–—:：]?\s*/;
const splitName = (name) => {
  const first = name.match(prefix);
  const body = name.replace(prefix, "");
  const parts = body.split(/\s[-–—]\s|\s[-–—]/).filter(Boolean);
  if (parts.length !== 2 || /套裝|配|或/.test(body)) return null;
  return parts.map((part) => {
    const ownPrefix = part.match(prefix);
    return { gender: ownPrefix ? ownPrefix[1] : first?.[1] || "男女生", name: part.replace(prefix, "").replace(/^[-–—]\s*/, "").trim() };
  });
};
const result = [];
let splitCount = 0;
for (const item of products) {
  const parts = splitName(item.name);
  if (!parts || item.sizes.length % 2 !== 0) { result.push(item); continue; }
  const midpoint = item.sizes.length / 2;
  for (let index = 0; index < 2; index++) {
    result.push({
      ...item,
      id: `${item.id}-${index + 1}`,
      name: `${parts[index].gender} - ${parts[index].name}`,
      sizes: item.sizes.slice(index * midpoint, (index + 1) * midpoint),
    });
  }
  splitCount++;
}
fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ splitRecords: splitCount, before: products.length, after: result.length }));
