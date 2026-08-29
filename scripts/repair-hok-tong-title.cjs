const fs = require("fs");
let text = fs.readFileSync("src/dedeLamLatestProducts.json", "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text);
const school = "中華基督教會何福堂書院";
const badTitle = /冬\s*季\s*價\s*目\s*表/;
const schoolProducts = products.filter((item) => item.school === school);
const titleItem = schoolProducts.find((item) => badTitle.test(item.name));
const longSleeve = schoolProducts.find((item) => item.name === "男女生 - 白色長袖恤衫");
if (!titleItem || !longSleeve) throw new Error("Expected title and long-sleeve records were not found");
const mergedSizes = [...titleItem.sizes, ...longSleeve.sizes].sort((a, b) => Number.parseFloat(a.size) - Number.parseFloat(b.size));
const result = [];
for (const item of products) {
  if (item.id === titleItem.id) continue;
  if (item.id === longSleeve.id) result.push({ ...item, sizes: mergedSizes });
  else result.push(item);
}
fs.writeFileSync("src/dedeLamLatestProducts.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ removedTitleRecord: titleItem.id, mergedInto: longSleeve.id, mergedSizeCount: mergedSizes.length, schoolCount: result.filter((item) => item.school === school).length }));
