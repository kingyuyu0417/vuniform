const fs = require("fs");
let text = fs.readFileSync("src/dedeLamLatestProducts.json", "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text);
const school = "中華基督教會何福堂書院";
const winter = {
  id: "dede-hotong-winter-grey-trousers",
  school,
  name: "男生 - 灰色長西褲（冬季）",
  sizes: [
    { size: "33", price: 90 }, { size: "34", price: 93 }, { size: "35", price: 97 },
    { size: "36", price: 101 }, { size: "37", price: 105 }, { size: "38.5", price: 109 },
  ],
};
const withoutDuplicate = products.filter((item) => !(item.school === school && item.name === winter.name));
fs.writeFileSync("src/dedeLamLatestProducts.json", `${JSON.stringify([...withoutDuplicate, winter], null, 2)}\n`, "utf8");
console.log(JSON.stringify({ school, added: winter.name, schoolCount: withoutDuplicate.filter((item) => item.school === school).length + 1 }));
