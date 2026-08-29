const fs = require("fs");
const read = (file) => { let text = fs.readFileSync(file, "utf8"); if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); return JSON.parse(text); };
const source = read("fresh-2026-products.json");
const app = read("src/dedeLamLatestProducts.json");
const names = ["元朗公立中學", "元朗商會小學", "浸信會永隆中學"];
for (const school of names) {
  const sourceItems = source.filter((item) => item.school === school);
  const appItems = app.filter((item) => item.school === school);
  console.log(JSON.stringify({ school, source: sourceItems.length, app: appItems.length, sourcePrices: sourceItems.reduce((total, item) => total + item.sizes.reduce((sum, size) => sum + size.price, 0), 0), appPrices: appItems.reduce((total, item) => total + item.sizes.reduce((sum, size) => sum + size.price, 0), 0) }));
}
