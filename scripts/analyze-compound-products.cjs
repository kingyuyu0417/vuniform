const fs = require("fs");
let text = fs.readFileSync("src/dedeLamLatestProducts.json", "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text);
const candidates = products.filter((item) => {
  const name = item.name.replace(/^(?:男生|女生|男女生)\s*[-–—:：]?\s*/, "");
  const parts = name.split(/\s[-–—]\s|\s[-–—]/).filter(Boolean);
  return parts.length >= 2 && item.sizes.length % parts.length === 0;
});
console.log(JSON.stringify({ count: candidates.length, examples: candidates.slice(0, 30).map((item) => ({ school: item.school, name: item.name, sizeCount: item.sizes.length })) }, null, 2));
