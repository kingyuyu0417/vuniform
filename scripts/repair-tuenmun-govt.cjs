const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "src", "dedeLamLatestProducts.json");
const school = "屯門官立中學";
const sizePrices = (sizes, prices) => sizes.map((size, index) => ({ size, price: prices[index] }));
const product = (id, name, sizes, prices) => ({ id, school, name, sizes: sizePrices(sizes, prices) });
const repaired = [
  product("dede-tmgov-summer-male-shirt", "男生 - 白色短袖恤", ["12", "12.5", "13", "13.5", "14", "14.5"], [36, 39, 42, 45, 48, 51]),
  product("dede-tmgov-summer-male-trousers", "男生 - 灰色長西褲", ["22-23", "24-25", "26-27", "28-29", "30-31", "32"], [80, 83, 86, 89, 94, 101]),
  product("dede-tmgov-summer-female-shirt", "女生 - 短袖恤衫 配紅色格仔領呔", ["30", "32", "34", "36", "38", "40"], [57, 61, 65, 69, 73, 78]),
  product("dede-tmgov-summer-female-skirt", "女生 - 紅色格仔半截裙", ["18-19", "20-21", "22-23", "24-25", "26-27", "28-29", "30-32"], [75, 79, 83, 87, 92, 97, 103]),
  product("dede-tmgov-sport-shirt", "男女生 - 運動短袖衫", ["30/XS", "32/S", "34/M", "36/L", "38/XL", "40/XXL"], [34, 37, 40, 43, 46, 50]),
  product("dede-tmgov-sport-shorts", "男女生 - 運動短褲", ["XS", "S", "M", "L", "XL", "XXL"], [34, 37, 40, 43, 46, 50]),
  product("dede-tmgov-sport-set", "男女生 - 四季運動套裝", ["30/XS", "32/S", "34/M", "36/L", "38/XL", "40/XXL"], [164, 172, 180, 190, 200, 210]),
  product("dede-tmgov-winter-shirt", "男女生 - 白色長袖恤衫", ["12", "12.5", "13", "13.5", "14", "14.5"], [47, 49, 52, 55, 58, 61]),
  product("dede-tmgov-winter-male-trousers", "男生 - 灰色長西褲（冬季）", ["22-23", "24-25", "26-27", "28-29", "30-31", "32"], [89, 92, 95, 98, 103, 110]),
  product("dede-tmgov-winter-female-skirt", "女生 - 紅色格仔半腰校裙", ["18-19", "20-21", "22-23", "24-25", "26-27", "28-29"], [97, 102, 107, 112, 117, 122]),
  product("dede-tmgov-winter-coat", "男女生 - 校褸", ["6", "8", "10", "12", "14", "16"], [223, 232, 243, 253, 268, 283]),
  product("dede-tmgov-scarf", "男女生 - 藍色頸巾", ["均碼"], [43]),
];

let text = fs.readFileSync(catalogPath, "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const catalog = JSON.parse(text).filter((item) => item.school !== school);
fs.writeFileSync(catalogPath, `${JSON.stringify([...catalog, ...repaired], null, 2)}\n`, "utf8");
console.log(JSON.stringify({ school, repairedProducts: repaired.length, catalogProducts: catalog.length + repaired.length }));
