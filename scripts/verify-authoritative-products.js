import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const targetSchool = '香港中國婦女會馮堯敬紀念中學';
const requiredItems = [
  '皮帶（男女生）',
  '白襪（男女生）',
  '底衫（男女生）',
  '底裙（女生）',
];

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const schoolProducts = readJson(path.join(repoRoot, 'src', 'fung-yiu-king-products.json'));
const schoolCatalog = readJson(path.join(repoRoot, 'src', 'schoolCatalog.json'));
const workbookCatalog = readJson(path.join(repoRoot, 'src', 'workbookSchoolCatalog.json'));
const combinedCatalog = { ...schoolCatalog, ...workbookCatalog };

const issues = [];

if (!combinedCatalog[targetSchool]) {
  issues.push(`Missing school metadata for ${targetSchool}`);
}

if (schoolProducts.some((product) => product.school === '示範學校（可刪除）')) {
  issues.push('Demo fallback school still exists in authoritative school product data');
}

const targetProducts = schoolProducts.filter((product) => product.school === targetSchool);
const missingItems = requiredItems.filter((itemName) => !targetProducts.some((product) => product.name === itemName));
if (missingItems.length > 0) {
  issues.push(`Missing required items for ${targetSchool}: ${missingItems.join(', ')}`);
}

if (issues.length > 0) {
  console.error('Product source integrity check failed.');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`Authoritative product check passed for ${targetSchool}.`);
console.log(`Verified items: ${requiredItems.join(', ')}`);
console.log(`Total records: ${targetProducts.length}`);
