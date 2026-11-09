import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDirectory = path.join(repoRoot, '.local-reports');
const pageSize = 500;

if (typeof process.loadEnvFile === 'function') {
  const envFile = path.join(repoRoot, '.env.local');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const promptForAccessToken = () => new Promise((resolve, reject) => {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    reject(new Error('Set SUPABASE_ACCESS_TOKEN in the process environment when running non-interactively.'));
    return;
  }

  readline.emitKeypressEvents(input);
  process.stdout.write('Paste a current authenticated staff JWT (input is hidden): ');
  input.setRawMode(true);
  input.resume();
  let token = '';
  const cleanup = () => {
    input.removeListener('keypress', handleKeypress);
    input.setRawMode(false);
    input.pause();
    process.stdout.write('\n');
  };
  const handleKeypress = (character, key = {}) => {
    if (key.ctrl && key.name === 'c') {
      cleanup();
      reject(new Error('Cancelled.'));
      return;
    }
    if (key.name === 'return' || key.name === 'enter') {
      cleanup();
      resolve(token);
      return;
    }
    if (key.name === 'backspace') {
      if (token.length > 0) {
        token = token.slice(0, -1);
        process.stdout.write('\b \b');
      }
      return;
    }
    if (character && !key.ctrl && !key.meta) {
      token += character;
      process.stdout.write('*'.repeat(character.length));
    }
  };
  input.on('keypress', handleKeypress);
});

if (!supabaseUrl || !/^https:\/\/[^\s/]+\.supabase\.co\/?$/.test(supabaseUrl)) {
  fail('Set a valid VITE_SUPABASE_URL in .env.local or the environment.');
}
if (!supabaseAnonKey || /your|你的|publishable_key|project_url/i.test(supabaseAnonKey)) {
  fail('Set VITE_SUPABASE_ANON_KEY in .env.local or the environment. Never use a service-role key.');
}
if (supabaseAnonKey.startsWith('sb_secret_')) {
  fail('VITE_SUPABASE_ANON_KEY contains a secret key. Use the public anon/publishable key; service-role keys are not supported.');
}
const anonKeyParts = supabaseAnonKey.split('.');
if (anonKeyParts.length === 3) {
  let anonKeyClaims;
  try {
    anonKeyClaims = JSON.parse(Buffer.from(anonKeyParts[1], 'base64url').toString('utf8'));
  } catch {
    fail('VITE_SUPABASE_ANON_KEY is not a valid JWT-style public key.');
  }
  if (anonKeyClaims.role === 'service_role') {
    fail('VITE_SUPABASE_ANON_KEY is a service-role key. Use the public anon/publishable key.');
  }
}

let accessToken;
try {
  accessToken = process.env.SUPABASE_ACCESS_TOKEN || await promptForAccessToken();
} catch (error) {
  fail(error.message);
}
if (!accessToken) fail('No access token was provided.');

const tokenParts = accessToken.split('.');
if (tokenParts.length !== 3) {
  fail('SUPABASE_ACCESS_TOKEN must be a Supabase user JWT; service-role keys are not supported.');
}

let tokenClaims;
try {
  tokenClaims = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString('utf8'));
} catch {
  fail('SUPABASE_ACCESS_TOKEN is not a valid JWT.');
}
if (tokenClaims.role !== 'authenticated') {
  fail('SUPABASE_ACCESS_TOKEN must belong to an authenticated staff user; service-role and anonymous tokens are rejected.');
}
if (tokenClaims.exp && Number(tokenClaims.exp) * 1000 <= Date.now()) {
  fail('SUPABASE_ACCESS_TOKEN has expired. Use a current staff session token.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: { Authorization: `Bearer ${accessToken}` },
  },
});

const products = [];
for (let offset = 0; ; offset += pageSize) {
  const { data, error } = await supabase
    .from('products')
    .select('id, school, name, sizes')
    .order('id', { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (error) {
    fail(`Supabase products read failed (${error.code || 'unknown'}): ${error.message}`);
  }
  if (!Array.isArray(data)) {
    fail('Supabase products query returned an unexpected response; no report was generated.');
  }

  products.push(...data);
  if (data.length < pageSize) break;
}

if (products.length === 0) {
  fail('No products are visible to this staff account. Check its branch access; no report was generated.');
}

const bySchool = new Map();
const ids = new Map();
for (const product of products) {
  const school = typeof product.school === 'string' ? product.school.trim() : '';
  const label = school || '(missing school)';
  if (!bySchool.has(label)) bySchool.set(label, { products: 0, errors: [], warnings: [] });
  const entry = bySchool.get(label);
  entry.products += 1;

  const addError = (message) => entry.errors.push(`${product.id || '(no id)'}: ${message}`);
  if (typeof product.id !== 'string' || !product.id.trim()) addError('missing product ID');
  else {
    if (!ids.has(product.id)) ids.set(product.id, []);
    ids.get(product.id).push(label);
  }
  if (!school) addError('missing school name');
  if (typeof product.name !== 'string' || !product.name.trim()) addError('missing product name');
  if (!Array.isArray(product.sizes) || product.sizes.length === 0) {
    addError('no sizes configured');
    continue;
  }

  for (const size of product.sizes) {
    const sizeLabel = String(size?.size ?? '').trim();
    if (!sizeLabel) addError('a size has no label');
    if (size?.price === null || size?.price === undefined || size?.price === '') {
      entry.warnings.push(`${product.id || '(no id)'}: ${sizeLabel || '(unnamed size)'} has no price`);
      continue;
    }
    const price = Number(size.price);
    if (!Number.isFinite(price) || price < 0) {
      addError(`${sizeLabel || '(unnamed size)'} has an invalid price`);
    }
  }
}

for (const [id, schools] of ids) {
  if (schools.length < 2) continue;
  for (const school of new Set(schools)) {
    bySchool.get(school).errors.push(`${id}: duplicate product ID in the visible dataset`);
  }
}

const schools = Array.from(bySchool, ([school, result]) => ({
  school,
  productCount: result.products,
  errors: [...new Set(result.errors)],
  warnings: [...new Set(result.warnings)],
  status: result.errors.length > 0 ? 'fail' : result.warnings.length > 0 ? 'warning' : 'pass',
})).sort((first, second) => first.school.localeCompare(second.school, 'zh-Hant'));

const failed = schools.filter((school) => school.status === 'fail').length;
const warnings = schools.filter((school) => school.status === 'warning').length;
const report = {
  generatedAt: new Date().toISOString(),
  source: 'Supabase products table',
  scope: 'Rows visible to the authenticated staff account under current Supabase RLS and branch access. This is not a whole-database audit.',
  readOnly: true,
  authenticatedRole: tokenClaims.role,
  monitoredSchools: schools.length,
  totalProductRecords: products.length,
  passedSchools: schools.length - failed - warnings,
  warningSchools: warnings,
  failedSchools: failed,
  schools,
};

const markdown = [
  '# Supabase Product Integrity Report',
  '',
  `Generated at: ${report.generatedAt}`,
  '',
  `Scope: ${report.scope}`,
  '',
  `Summary: ${report.passedSchools}/${schools.length} schools passed; ${warnings} with warnings; ${failed} failed; ${products.length} visible product records checked.`,
  '',
  'Checks: product IDs and names, non-empty size lists, size labels and non-negative numeric prices. Missing prices are warnings because the POS supports intentionally unpriced sizes.',
  '',
  ...schools.map((school) => {
    const details = [
      ...school.errors.map((error) => `ERROR ${error}`),
      ...school.warnings.map((warning) => `WARNING ${warning}`),
    ];
    const status = school.status.toUpperCase();
    return `- ${school.school}: ${status} — ${school.productCount} ${school.productCount === 1 ? 'product' : 'products'}${details.length ? ` (${details.join('; ')})` : ''}`;
  }),
].join('\n');

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'school-integrity-supabase.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(outputDirectory, 'school-integrity-supabase.md'), `${markdown}\n`, 'utf8');

console.log(`Supabase read-only product check: ${report.passedSchools} passed, ${warnings} warnings, ${failed} failed (${products.length} visible products across ${schools.length} schools).`);
console.log(`Private local reports written to ${outputDirectory}.`);
console.log('Rows outside this account’s RLS/branch access are not included.');

if (failed > 0) process.exitCode = 1;
