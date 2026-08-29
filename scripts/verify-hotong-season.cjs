const fs = require("fs");
let text = fs.readFileSync("src/dedeLamLatestProducts.json", "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text).filter((item) => item.school.includes("何福堂") && item.name.includes("灰色長西褲"));
const season = (product) => {
  const name = product.name.replace(/\s+/g, "");
  if (product.school.includes("何福堂") && name === "男生-灰色長西褲") return "夏季";
  if (/四季|全年/.test(name)) return "四季";
  if (/冬季|冬裝|長袖|冷衫|校褸|棉褸|衛衣|外套|長褲|長西褲|頸巾/.test(name)) return "冬季";
  return "夏季";
};
console.log(JSON.stringify(products.map((product) => ({ school: product.school, name: product.name, season: season(product) })), null, 2));
