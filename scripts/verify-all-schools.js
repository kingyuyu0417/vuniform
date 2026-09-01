import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const schoolProducts = readJson(path.join(repoRoot, 'src', 'fung-yiu-king-products.json'));
const allSchoolFiles = [
  path.join(repoRoot, 'src', 'schoolCatalog.json'),
  path.join(repoRoot, 'src', 'workbookSchoolCatalog.json'),
];

const allSchoolNames = new Set();
for (const file of allSchoolFiles) {
  const catalog = readJson(file);
  for (const school of Object.keys(catalog)) allSchoolNames.add(school);
}

const requiredBySchool = {
  '香港中國婦女會馮堯敬紀念中學': ['皮帶（男女生）', '白襪（男女生）', '底衫（男女生）', '底裙（女生）'],
};

const report = {
  generatedAt: new Date().toISOString(),
  monitoredSchools: Object.keys(requiredBySchool),
  schools: [],
};

const issues = [];

for (const school of Array.from(allSchoolNames).sort((a, b) => a.localeCompare(b, 'zh-Hant'))) {
  const required = requiredBySchool[school];
  if (!required) continue;

  const products = schoolProducts.filter((product) => product.school === school);
  const missing = required.filter((name) => !products.some((product) => product.name === name));
  const result = { school, required, missing, status: missing.length === 0 ? 'pass' : 'fail' };
  report.schools.push(result);

  if (missing.length > 0) {
    issues.push(`${school}: missing ${missing.join(', ')}`);
  }
}

const jsonReportPath = path.join(repoRoot, 'school-integrity-report.json');
const markdownReportPath = path.join(repoRoot, 'school-integrity-report.md');

const totalMonitored = report.schools.length;
const passed = report.schools.filter((entry) => entry.status === 'pass').length;
const failed = totalMonitored - passed;

const markdownReport = [
  '# School Integrity Report',
  '',
  `Generated at: ${report.generatedAt}`,
  '',
  `Summary: ${passed}/${totalMonitored} schools passed; ${failed} failed.`,
  '',
  ...report.schools.map((entry) => `- ${entry.school}: ${entry.status === 'pass' ? 'PASS' : `FAIL (missing ${entry.missing.join(', ')})`}`),
].join('\n');

fs.writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(markdownReportPath, `${markdownReport}\n`, 'utf8');

if (issues.length > 0) {
  console.error('School-wide product integrity check failed.');
  for (const issue of issues) console.error(`- ${issue}`);
  console.error(`Report written to ${jsonReportPath}`);
  process.exit(1);
}

console.log(`All monitored schools passed integrity validation (${totalMonitored} schools).`);
console.log(`Report written to ${jsonReportPath}`);
