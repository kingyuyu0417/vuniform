const fs = require("fs");
const path = require("path");
const file = path.resolve(__dirname, "../src/dedeLamLatestProducts.json");
let text = fs.readFileSync(file, "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const catalog = JSON.parse(text);
const school = "屯門官立中學";
const sizes = (values, prices) => values.map((size, index) => ({ size, price: prices[index] }));
const additions = [
  { id: "dede-tmgov-sport-shirt", school, name: "男女生 - 運動短袖衫", sizes: sizes(["30/XS", "32/S", "34/M", "36/L", "38/XL", "40/XXL"], [34, 37, 40, 43, 46, 50]) },
  { id: "dede-tmgov-sport-set", school, name: "男女生 - 四季運動套裝", sizes: sizes(["30/XS", "32/S", "34/M", "36/L", "38/XL", "40/XXL"], [164, 172, 180, 190, 200, 210]) },
  { id: "dede-tmgov-winter-trousers", school, name: "男生 - 灰色長西褲（冬季）", sizes: sizes(["22-23", "24-25", "26-27", "28-29", "30-31", "32"], [89, 92, 95, 98, 103, 110]) },
  { id: "dede-tmgov-scarf", school, name: "男女生 - 藍色頸巾", sizes: sizes(["均碼"], [43]) },
];
const keep = catalog.filter((item) => item.school !== school || !additions.some((addition) => addition.id === item.id));
fs.writeFileSync(file, `${JSON.stringify([...keep, ...additions], null, 2)}\n`, "utf8");
console.log(JSON.stringify({ school, count: additions.length, total: keep.length + additions.length }));
