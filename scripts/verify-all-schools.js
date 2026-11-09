import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const productSourceFiles = [
  'src/dedeLamLatestProducts.json',
  'src/fung-yiu-king-products.json',
  'src/yanOiTongLauWongFatProducts.json',
];
const schoolCatalogFiles = [
  'src/schoolCatalog.json',
  'src/workbookSchoolCatalog.json',
];
const requiredBySchool = {
  '香港中國婦女會馮堯敬紀念中學': ['皮帶（男女生）', '白襪（男女生）', '底衫（男女生）', '底裙（女生）'],
};

const schoolMetadata = new Set(
  schoolCatalogFiles.flatMap((file) => Object.keys(readJson(path.join(repoRoot, file)))),
);
const schoolProducts = new Map();
const productsById = new Map();
const globalIssues = [];
let totalProductCount = 0;

for (const sourceFile of productSourceFiles) {
  const filePath = path.join(repoRoot, sourceFile);
  const products = readJson(filePath);
  if (!Array.isArray(products)) {
    globalIssues.push(`${sourceFile}: expected a product array`);
    continue;
  }

  totalProductCount += products.length;
  products.forEach((product, index) => {
    const source = path.basename(sourceFile);
    if (!product || typeof product !== 'object' || Array.isArray(product)) {
      globalIssues.push(`${sourceFile}[${index}]: expected a product object`);
      return;
    }

    const school = typeof product.school === 'string' ? product.school.trim() : '';
    if (!school) {
      globalIssues.push(`${sourceFile}[${index}]: missing school name`);
      return;
    }

    if (!schoolProducts.has(school)) schoolProducts.set(school, { products: [], sources: new Set(), issues: [] });
    const schoolEntry = schoolProducts.get(school);
    schoolEntry.products.push(product);
    schoolEntry.sources.add(source);

    if (!product.id || typeof product.id !== 'string') {
      schoolEntry.issues.push(`${source}: product is missing a string id`);
    } else {
      if (!productsById.has(product.id)) productsById.set(product.id, []);
      productsById.get(product.id).push({ school, source });
    }

    if (typeof product.name !== 'string' || !product.name.trim()) {
      schoolEntry.issues.push(`${source}: product ${product.id || '(no id)'} is missing a name`);
    }
    if (!schoolMetadata.has(school)) {
      schoolEntry.issues.push(`School metadata is missing for ${school}`);
    }
    if (!Array.isArray(product.sizes) || product.sizes.length === 0) {
      schoolEntry.issues.push(`${source}: product ${product.id || '(no id)'} has no sizes`);
      return;
    }

    for (const size of product.sizes) {
      const sizeLabel = String(size?.size ?? '').trim();
      const price = typeof size?.price === 'number' || (typeof size?.price === 'string' && size.price.trim())
        ? Number(size.price)
        : Number.NaN;
      if (!sizeLabel) {
        schoolEntry.issues.push(`${source}: product ${product.id || '(no id)'} has a size without a label`);
      }
      if (!Number.isFinite(price) || price < 0) {
        schoolEntry.issues.push(`${source}: product ${product.id || '(no id)'} has an invalid price for ${sizeLabel || '(no size)'}`);
      }
    }
  });
}

for (const [id, occurrences] of productsById) {
  if (occurrences.length < 2) continue;
  const locations = occurrences.map(({ school, source }) => `${school} (${source})`).join(', ');
  for (const { school } of occurrences) {
    schoolProducts.get(school).issues.push(`Duplicate product id ${id}: ${locations}`);
  }
}

for (const [school, required] of Object.entries(requiredBySchool)) {
  const entry = schoolProducts.get(school);
  if (!entry) {
    globalIssues.push(`Required-item school has no product data: ${school}`);
    continue;
  }
  const missing = required.filter((name) => !entry.products.some((product) => product.name === name));
  if (missing.length > 0) entry.issues.push(`Missing required items: ${missing.join(', ')}`);
}

const schools = Array.from(schoolProducts, ([school, entry]) => ({
  school,
  productCount: entry.products.length,
  sourceFiles: Array.from(entry.sources).sort(),
  issues: [...new Set(entry.issues)],
  status: entry.issues.length === 0 ? 'pass' : 'fail',
})).sort((first, second) => first.school.localeCompare(second.school, 'zh-Hant'));

const report = {
  generatedAt: new Date().toISOString(),
  scope: 'Schools represented in repository product source files; this does not cover Supabase or browser-local products.',
  checkedSources: productSourceFiles,
  monitoredSchools: schools.length,
  totalProductRecords: totalProductCount,
  schools,
  globalIssues,
};

const passed = schools.filter((entry) => entry.status === 'pass').length;
const failed = schools.length - passed;
const jsonReportPath = path.join(repoRoot, 'school-integrity-report.json');
const markdownReportPath = path.join(repoRoot, 'school-integrity-report.md');
const markdownReport = [
  '# School Integrity Report',
  '',
  `Generated at: ${report.generatedAt}`,
  '',
  `Scope: ${report.scope}`,
  '',
  `Summary: ${passed}/${schools.length} schools passed; ${failed} failed; ${totalProductCount} product records checked.`,
  '',
  'Checks: school metadata, product IDs and names, non-empty size lists, size labels and non-negative numeric prices; required staple items for 香港中國婦女會馮堯敬紀念中學.',
  '',
  ...schools.map((entry) => `- ${entry.school}: ${entry.status === 'pass' ? 'PASS' : `FAIL (${entry.issues.join('; ')})`} — ${entry.productCount} ${entry.productCount === 1 ? 'product' : 'products'}`),
  ...(globalIssues.length > 0 ? ['', '## Global issues', '', ...globalIssues.map((issue) => `- ${issue}`)] : []),
].join('\n');

fs.writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(markdownReportPath, `${markdownReport}\n`, 'utf8');

if (failed > 0 || globalIssues.length > 0) {
  console.error(`School product integrity check failed (${failed} of ${schools.length} schools; ${globalIssues.length} global issues).`);
  for (const entry of schools.filter((school) => school.status === 'fail')) {
    console.error(`- ${entry.school}: ${entry.issues.join('; ')}`);
  }
  for (const issue of globalIssues) console.error(`- ${issue}`);
  console.error(`Report written to ${jsonReportPath}`);
  process.exit(1);
}

console.log(`All product source checks passed (${passed} schools, ${totalProductCount} product records).`);
console.log(`Report written to ${jsonReportPath}`);
