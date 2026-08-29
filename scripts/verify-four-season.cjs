const fs = require("fs");
let text = fs.readFileSync("src/dedeLamLatestProducts.json", "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const products = JSON.parse(text);
const fourSeason = products.filter((item) => /四季|全年/.test(item.name));
const season = (name) => {
	const normalized = name.replace(/\s+/g, "");
	if (/四季|全年/.test(normalized)) return "四季";
	if (/冬季|冬裝|長袖|冷衫|校褸|棉褸|衛衣|外套|長褲|長西褲|頸巾/.test(normalized)) return "冬季";
	return "夏季";
};
const incorrectlyClassified = fourSeason.filter((item) => season(item.name) !== "四季");
console.log(JSON.stringify({ count: fourSeason.length, schools: new Set(fourSeason.map((item) => item.school)).size, incorrectlyClassified: incorrectlyClassified.length }, null, 2));
process.exitCode = incorrectlyClassified.length ? 1 : 0;
