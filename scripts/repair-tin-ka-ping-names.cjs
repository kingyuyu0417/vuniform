const fs = require("fs");
const file = "src/dedeLamLatestProducts.json";
let text = fs.readFileSync(file, "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text);
const school = "仁愛堂田家炳中學";
const replacements = new Map([
  ["女生 - 灰色校裙 男女生", "女生 - 灰色校裙"],
  ["男女生 - 白色長袖恤衫 男生", "男女生 - 白色長袖恤衫"],
]);
let changed = 0;
const result = products.map((item) => {
  if (item.school !== school || !replacements.has(item.name)) return item;
  changed++;
  return { ...item, name: replacements.get(item.name) };
});
fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ school, changed }));
