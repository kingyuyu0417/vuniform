const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => { let text = fs.readFileSync(file, "utf8"); if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); return JSON.parse(text); };
const schoolAliases = {
  "元朗朗屏邨東莞學校": "東莞學校", "博愛醫院歷屆總理聯誼會梁省德學校": "梁省德學校",
  "嗇色園主辦可銘學校": "中華基督教會可銘學校", "香海正覺蓮社佛教梁植偉中學": "仁濟醫院梁植偉中學",
  "鐘聲慈善社胡陳金枝中學": "中華基督教會胡陳金枝中學", "中華基督教會何福堂書院": "聖公會聖西門呂明才中學 / 何福堂中學",
  "中華基督教會基元中學": "基督教香港信義會基元中學", "中華基督教會譚李麗芬紀念中學": "順德聯誼總會譚李麗芬紀念中學",
  "仁愛堂陳黃淑芳紀念中學": "東華三院陳黃淑芳紀念中學", "加拿大神召會嘉智中學": "嘉智中學",
  "保良局西區婦女福利會馮李佩瑤小學": "保良局馮李佩瑤小學", "保良局董玉娣中學": "保良局董玉梯紀念中學",
  "香港青年協會李兆基書院": "順德聯誼總會李兆基書院", "僑港伍氏宗親會伍時暢紀念學校": "順德聯誼總會伍時暢學校",
  "東華三院鄺錫坤伉儷中學": "鄺錫坤中學", "東華三院郭一葦中學": "中華基督教會郭一韋中學"
};
const clean = (value) => String(value || "").replace(/（[^）]*）|\([^)]*\)/g, "").replace(/[–—]/g, "-").replace(/\s+/g, "").trim();
const key = (item) => `${clean(schoolAliases[item.school] || item.school)}\u0000${clean(item.name)}`;
const sizes = (item) => JSON.stringify(item.sizes || []);
const source = read(path.join(root, "vu-2026-products.json"));
const app = read(path.join(root, "src", "dedeLamLatestProducts.json"));
const databasePayload = read(path.join(root, "database-products-snapshot.json"));
const compare = (target) => {
  const map = new Map(target.map((item) => [key(item), item]));
  const result = [];
  for (const item of source) {
    const match = map.get(key(item));
    if (!match) result.push({ type: "missing", school: item.school, name: item.name, source: item.sizes });
    else if (sizes(item) !== sizes(match)) result.push({ type: "price-or-size-mismatch", school: item.school, name: item.name, source: item.sizes, target: match.sizes });
  }
  for (const item of target) if (!source.some((sourceItem) => key(sourceItem) === key(item))) result.push({ type: "extra-or-wrong-school", school: item.school, name: item.name, target: item.sizes });
  return result;
};
const report = { checkedAt: new Date().toISOString(), sourceProducts: source.length, appProducts: app.length, databaseProducts: databasePayload.length, appDifferences: compare(app), databaseDifferences: compare(databasePayload) };
report.summary = {};
for (const [label, details] of [["app", report.appDifferences], ["database", report.databaseDifferences]]) report.summary[label] = { total: details.length, missing: details.filter((x) => x.type === "missing").length, mismatches: details.filter((x) => x.type === "price-or-size-mismatch").length, extraOrWrongSchool: details.filter((x) => x.type === "extra-or-wrong-school").length, schools: [...new Set(details.map((x) => x.school))] };
fs.writeFileSync(path.join(root, "vu-2026-comparison-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.summary, null, 2));
