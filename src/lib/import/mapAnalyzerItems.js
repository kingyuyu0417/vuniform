/**
* mapAnalyzerItems.js
* ----------------------------------------
* 將 uniform-import-analyzer 嘅 AnalyzedItem[] 轉做 App 現有
* smartImportRows 食得落嘅標準行格式（學校／款式名稱／尺碼／價錢／是否裁碼）。
*
* 對應：
* school → 學校
* item → 款式名稱
* size → 尺碼（null＝無尺碼如校呔 → 用「均碼」；腰圍×褲長已併埋一粒字串）
* unitPrice → 價錢
* tailored → 是否裁碼（「是」／空）
* gender → 每行附加 gender（男→boys／女→girls／其他→unisex）；
* 同款同時有男女尺碼時合併為 unisex。
*
* 注意：組合價（bundles）按用戶決定唔入 DB，呢度直接唔理。
*/

export const NO_SIZE_LABEL = '均碼';

const ANALYZER_GENDER_MAP = {
  '男': 'boys',
  '男生': 'boys',
  boys: 'boys',
  '女': 'girls',
  '女生': 'girls',
  girls: 'girls',
  '男女': 'unisex',
  '男女生': 'unisex',
  unisex: 'unisex',
};

export function mapAnalyzerItems(items) {
const rows = [];
const gendersByName = new Map();
let tailoredCount = 0;
let noSizeCount = 0;

for (const it of items) {
const school = String(it.school || '').trim();
const name = String(it.item || '').trim();
const size = it.size == null || String(it.size).trim() === ''? NO_SIZE_LABEL: String(it.size).trim();
if (it.size == null) noSizeCount++;
const price = Number(it.unitPrice);
const tailored = Boolean(it.tailored) || size === '裁碼';
if (tailored) tailoredCount++;
if (!name ||!Number.isFinite(price) || price < 0) continue;

const row = {
'學校': school,
'款式名稱': name,
'尺碼': size,
'價錢': price,
'是否裁碼': tailored? '是': '',
isTailored: tailored,
'長度': '',
// 下面兩個唔係畀 smartImportRows 用，係畀 preview 睇同埋 debug
'分析備註': it.note || '',
'來源': it.source? `${it.source.sheet}!${it.source.cell}`: '',
'分析區塊': it.source?.blockId || '',
};
rows.push(row);

const key = `${school} ${name}`;
const genders = gendersByName.get(key) || new Set();
genders.add(ANALYZER_GENDER_MAP[String(it.gender || '').trim().toLowerCase()] || 'unisex');
gendersByName.set(key, genders);
}

const genderByName = new Map(
  [...gendersByName].map(([key, genders]) => [key, genders.size === 1 ? [...genders][0] : 'unisex']),
);
rows.forEach((row) => {
  row.gender = genderByName.get(`${row['學校']} ${row['款式名稱']}`) || 'unisex';
});

return {
rows,
genderByName,
summary: {
items: items.length,
rows: rows.length,
tailoredCount,
noSizeCount,
},
};
}

/**
* 將 analyzer warnings 分流：
* error → errors（擋住，要人處理）
* warn/info → conversionWarnings（preview 顯示，等確認）
*/
export function splitAnalyzerWarnings(warnings) {
const errors = [];
const conversionWarnings = [];
for (const w of warnings || []) {
const text = `${w.message}`;
if (w.severity === 'error') errors.push(text);
else conversionWarnings.push(`${w.severity === 'warn'? '': ''}${text}`);
}
return { errors, conversionWarnings};
}
