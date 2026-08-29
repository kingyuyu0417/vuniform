const fs = require("fs");
const file = "src/dedeLamLatestProducts.json";
let text = fs.readFileSync(file, "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text);
const sizes = (labels, prices) => labels.map((size, index) => ({ size, price: prices[index] }));
const item = (id, school, name, labels, prices) => ({ id, school, name, sizes: sizes(labels, prices) });
const tong = "迦密唐賓南紀念中學";
const li = "恩平工商會李琳明中學";
const tongProducts = [
  item("dede-tong-summer-shirt", tong, "男生 - 白色尖領短袖恤衫", ["12.5", "13", "13.5", "14", "14.5", "15", "15.5"], [47, 50, 53, 56, 59, 63, 69]),
  item("dede-tong-summer-trousers", tong, "男生 - 長西褲", ["23-23", "24-25", "26-27", "28-29", "30", "32", "裁碼"], [78, 83, 88, 93, 98, 105, 125]),
  item("dede-tong-summer-skirt-top", tong, "女生校裙 - 上衣", ["31-32", "33-34", "35-36", "37-38", "39-40", "裁碼"], [47, 50, 53, 56, 60, 75]),
  item("dede-tong-summer-skirt", tong, "女生校裙 - 下裙", ["31-32", "33-34", "35-36", "37-38", "39-40", "裁碼"], [68, 72, 76, 80, 85, 95]),
  item("dede-tong-summer-skirt-set", tong, "女生校裙 - 全套", ["31-32", "33-34", "35-36", "37-38", "39-40", "裁碼"], [115, 122, 129, 136, 145, 170]),
  item("dede-tong-winter-male-shirt", tong, "男生 - 白色尖領長袖恤衫", ["12.5", "13", "13.5", "14", "14.5", "15", "15.5"], [55, 58, 61, 64, 67, 71, 79]),
  item("dede-tong-winter-male-trousers", tong, "男生 - 長西褲（冬季）", ["23-23", "24-25", "26-27", "28-29", "30", "32", "裁碼"], [88, 93, 98, 103, 108, 115, 135]),
  item("dede-tong-winter-female-shirt", tong, "女生 - 白色尖領長袖恤衫", ["12.5", "13", "13.5", "14", "14.5", "15", "15.5"], [55, 58, 61, 64, 67, 71, 79]),
  item("dede-tong-winter-skirt", tong, "女生 - 灰色排褶背心裙", ["31-32", "33-34", "35-36", "37-38", "39-40", "裁碼"], [95, 100, 105, 110, 120, 140]),
  item("dede-tong-tie", tong, "校呔", ["均碼"], [22]),
  item("dede-tong-sport-jacket", tong, "男女生 - 運動套裝外套", ["34", "36", "38", "40", "42", "均碼"], [85, 90, 95, 100, 105, 120]),
  item("dede-tong-sport-trousers", tong, "男女生 - 運動套裝長褲", ["34", "36", "38", "40", "42", "均碼"], [85, 90, 95, 100, 105, 120]),
  item("dede-tong-sport-set", tong, "男女生 - 運動套裝（全套）", ["34", "36", "38", "40", "42", "均碼"], [170, 180, 190, 200, 210, 240]),
  item("dede-tong-winter-coat", tong, "男女生 - 黑色棉褸（連抓毛長袖）", ["8", "10", "12", "14", "16"], [230, 240, 250, 260, 275]),
];
const liProducts = [
  item("dede-li-summer-shirt", li, "男女生 - 藍白條子短袖恤", ["12", "12.5", "13", "13.5", "14", "14.5", "15", "15.5", "16"], [41, 44, 47, 50, 54, 58, 62, 66, 70]),
  item("dede-li-summer-trousers", li, "男生 - 深藍色長西褲", ["34", "35", "36", "37", "38.5", "40", "41.5"], [78, 82, 86, 90, 95, 105, 110]),
  item("dede-li-summer-skirt", li, "女生 - 深藍色半腰裙", ["21-22", "23-24", "25-26", "27-28", "29-30", "31-32"], [68, 73, 78, 83, 88, 95]),
  item("dede-li-non-chinese-short-sleeve-skirt", li, "非華裔女生 - 藍色條子長裙（短袖）", ["32", "34", "36", "38", "40", "42"], [76, 82, 88, 94, 100, 106]),
  item("dede-li-non-chinese-long-sleeve-skirt", li, "非華裔女生 - 藍色條子長裙（長袖）", ["32", "34", "36", "38", "40", "42"], [96, 102, 108, 114, 120, 126]),
  item("dede-li-non-chinese-trousers", li, "非華裔女生 - 深藍色長褲", ["32", "34", "36", "38", "40", "42"], [62, 68, 72, 77, 82, 88]),
  item("dede-li-headscarf", li, "白色頭巾", ["均碼"], [38]),
  item("dede-li-sport-shirt-short", li, "男女生 - 短袖綑邊運動衣", ["34", "36", "38", "40", "43"], [36, 40, 44, 48, 52]),
  item("dede-li-sport-shirt-long", li, "男女生 - 長袖綑邊運動衣", ["34", "36", "38", "40", "43"], [46, 50, 54, 58, 62]),
  item("dede-li-sport-trousers", li, "男女生 - 運動褲", ["S", "M", "L", "XL", "XXL"], [36, 40, 44, 48, 52]),
  item("dede-li-sport-jacket", li, "男女生 - 運動套裝外套", ["34", "36", "38", "40", "42"], [90, 96, 102, 110, 118]),
  item("dede-li-sport-set-trousers", li, "男女生 - 運動套裝長褲", ["34", "36", "38", "40", "42"], [80, 86, 92, 98, 105]),
];
const remove = new Set([tong, li]);
const result = products.filter((product) => !remove.has(product.school));
fs.writeFileSync(file, `${JSON.stringify([...result, ...tongProducts, ...liProducts], null, 2)}\n`, "utf8");
console.log(JSON.stringify({ tong: tongProducts.length, li: liProducts.length, total: result.length + tongProducts.length + liProducts.length }));
