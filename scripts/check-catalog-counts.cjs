const fs = require("fs");
let text = fs.readFileSync("src/dedeLamLatestProducts.json", "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text);
for (const school of ["屯門官立中學", "南屯門官立中學"]) {
  console.log(`${school}: ${products.filter((item) => item.school === school).length}`);
}
console.log(`TOTAL: ${products.length}`);
