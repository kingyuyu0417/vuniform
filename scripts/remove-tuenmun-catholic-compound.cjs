const fs = require("fs");
let text = fs.readFileSync("src/dedeLamLatestProducts.json", "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text);
const school = "屯門天主教中學";
const redundantName = "男女生 - 黑色V領背心冷衫 黑色V領長袖冷衫";
const result = products.filter((item) => !(item.school === school && item.name === redundantName));
fs.writeFileSync("src/dedeLamLatestProducts.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ removed: products.length - result.length, remaining: result.filter((item) => item.school === school).length }));
