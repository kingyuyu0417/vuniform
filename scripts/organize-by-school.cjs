const fs = require("fs");
let text = fs.readFileSync("src/dedeLamLatestProducts.json", "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text);
const season = (name) => {
  const normalized = name.replace(/\s+/g, "");
  if (/冬季|冬裝|長袖|冷衫|校褸|棉褸|衛衣|外套|長褲|頸巾/.test(normalized)) return 2;
  if (/夏季|夏裝|短袖|短褲|短西褲|校裙/.test(normalized)) return 1;
  return 1;
};
const gender = (name) => /女生|Girl/i.test(name) ? 2 : /男生|Boy/i.test(name) ? 1 : 3;
const cleanName = (name) => String(name || "").replace(/\s+/g, " ").replace(/校\s+褸/g, "校褸").trim();
const seen = new Set();
const organized = products
  .map((item) => ({ ...item, name: cleanName(item.name) }))
  .filter((item) => {
    const key = `${item.school}\u0000${item.name}\u0000${JSON.stringify(item.sizes)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .sort((a, b) => a.school.localeCompare(b.school, "zh-Hant") || season(a.name) - season(b.name) || gender(a.name) - gender(b.name) || a.name.localeCompare(b.name, "zh-Hant"));
fs.writeFileSync("src/dedeLamLatestProducts.json", `${JSON.stringify(organized, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ before: products.length, after: organized.length, schools: new Set(organized.map((item) => item.school)).size }));
