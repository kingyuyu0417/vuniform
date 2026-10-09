import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "src", "schoolCatalog.json");
const outputPath = path.join(root, "public", "receipt-school-translations.js");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const names = Object.keys(catalog);
const hasChinese = /[\u3400-\u9fff]/;
const englishName = /^[A-Z0-9][A-Z0-9 .,'&()/-]*$/;
const translations = {};
const hasSameMetadata = (first, second) => {
  const firstKeys = Object.keys(first).sort();
  const secondKeys = Object.keys(second).sort();
  return firstKeys.length === secondKeys.length
    && firstKeys.every((key, index) => key === secondKeys[index] && first[key] === second[key]);
};

names.forEach((name, index) => {
  if (!hasChinese.test(name)) return;
  const english = names.slice(index + 1, index + 3).find((candidate) => (
    englishName.test(candidate)
    && hasSameMetadata(catalog[name], catalog[candidate])
  ));
  if (english) translations[name] = english;
});

const output = `export const receiptSchoolTranslations = ${JSON.stringify(translations, null, 2)};\n`;
fs.writeFileSync(outputPath, output);
console.log(`Generated ${Object.keys(translations).length} offline school translations.`);
