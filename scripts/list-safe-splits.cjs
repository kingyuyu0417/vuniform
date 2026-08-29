const fs = require("fs");
let text = fs.readFileSync("src/dedeLamLatestProducts.json", "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text);
const candidates = products.filter((item) => {
  const name = item.name.replace(/^(?:男生|女生|男女生)\s*[-–—:：]?\s*/, "");
  const parts = name.split(/\s[-–—]\s|\s[-–—]/).filter(Boolean);
  return parts.length === 2 && item.sizes.length % 2 === 0 && !/套裝|配|或/.test(name);
});
const groups = {};
for (const item of candidates) groups[item.sizes.length] = (groups[item.sizes.length] || 0) + 1;
console.log(JSON.stringify({ count: candidates.length, bySizeCount: groups, examples: candidates.slice(0, 20).map((item) => ({ school: item.school, name: item.name, sizes: item.sizes.length })) }, null, 2));
