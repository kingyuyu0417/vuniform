/**
 * uniform-import-analyzer.ts
 * ----------------------------------------
 * 校服價目 Excel / CSV 智能分析器
 *
 * 做咩：
 *   將「唔係正規表格」嘅校服價目 Excel（多區塊並排、款式名拆散、
 *   日期陷阱、組合價、裁碼展開等）解析成標準商品記錄，
 *   同時輸出所有可疑位（warnings）等人手確認。
 *
 * 用法：
 *   import { analyzePriceWorkbook } from './uniform-import-analyzer';
 *   import { SCHOOL_LAYOUTS } from './school-layouts';
 *   const buf = await file.arrayBuffer();
 *   const result = analyzePriceWorkbook(buf, SCHOOL_LAYOUTS);
 *   // result.items    → 標準商品記錄，可直接入 DB
 *   // result.warnings → preview 畫面列出，等用戶 confirm 先入
 *
 * 依賴：npm i xlsx
 */

import * as XLSX from 'xlsx';

/* ================= 型別 ================= */

export type Severity = 'error' | 'warn' | 'info';

export interface ImportWarning {
  sheet: string;
  cell?: string;
  code: string;
  severity: Severity;
  message: string;
}
/**
 * Warning codes:
 *  DATE_AS_SIZE       尺碼格被 Excel 轉咗做日期（用顯示文字，但要人知）
 *  BUNDLE_MISMATCH    組合價 ≠ 數量×單價（可能有折扣）
 *  SET_TOTAL_MISMATCH 全套價 ≠ 各件相加 / 套裝 ≠ ratio×單件
 *  UNAVAILABLE_SIZE   「x」= 冇呢個碼
 *  DUAL_PRICE         名格有數字、價錢格又有另一個數字
 *  STRAY_CELL         唔屬於任何區塊嘅文字格（雜訊）
 *  PRICE_PARSE_FAIL   價錢格讀唔到數字
 *  NO_LAYOUT_CONFIG   搵唔到版面設定（自動偵測，需人手確認）
 *  CUSTOM_SIZE_USED   「裁碼」按大碼清單展開
 *  INFERRED_SIZE      推斷細碼（等用戶刪減）
 *  PACKAGED_SIZE_PARSE_FAIL 包裝格格式無法確認
 */

export interface BundleInfo { qty: number; unit: string; price: number; }

export interface AnalyzedItem {
  school: string;
  season: string;
  gender?: string;
  item: string;                    // 款式名（已套用官方名）
  size: string | null;             // 離散尺碼；null = 無尺碼（如校呔）
  unitPrice: number;
  tailored?: boolean;              // true = 裁碼（展開或字面）
  bundles: BundleInfo[];           // 2件 / 3件 / 2條 …
  setTotal?: number;               // 全套價（複合款式）
  note?: string;
  source: { sheet: string; cell: string; blockId?: string; blockName?: string };
}

export interface PriceColConfig {
  col: string;                     // 'B'
  kind: 'unit' | 'bundle' | 'setTotal';
  label?: string;                  // 雙產品並排時用；否則用 block 名
  note?: string;                   // 該 label 專用備註（覆蓋 block.note）
  bundleQty?: number;
  bundleUnit?: string;
  customSizes?: string[];          // R14：取代「裁碼」嘅大碼清單
  customNote?: string;
  customNoteAppend?: boolean;      // true = 備註接喺 block.note 後面；false = 取代
  belowMinSizes?: string[];        // R15：細過最細碼嘅清單
}

export interface SecondDimConfig {
  label: string;                   // '褲長'
  values: { label: string; plus: number; note?: string }[];
  belowMinFirstDim?: string[];     // 第一維度嘅細碼（如腰 21,22）
  tailorNote?: string;             // 「裁碼」行備註
  bundleNote?: string;             // 附加備註（如「2條價按每條加錢計」）
  sizeTemplate?: (dim1: string, dim2: string) => string;
}

export interface BlockConfig {
  id: string;
  gender?: string;
  name?: string;
  nameCells?: string[];            // 從呢啲格讀出拼合（兼做 DUAL_PRICE 檢查）
  nameCol?: string;                // 無尺碼模式：款式名喺邊欄
  note?: string;
  dataFirst: number;               // 1-indexed，含頭尾
  dataLast: number;
  sizeCol?: string | null;
  sizeKind?: 'normal' | 'pack';     // pack = 包裝單位（3對/6對），唔展開
  packagePriceFromSourceCell?: boolean; // 價格與包裝規格同在款式來源格
  multiLine?: boolean;             // R18：一格多值（換行分隔），拆開對應
  sizeListCell?: string;           // R19：尺碼唔喺自己欄，去指定格攞（換行分隔）
  priceCols: PriceColConfig[];
  expandRanges?: boolean;          // R10，預設 true
  secondDim?: SecondDimConfig;     // R11 二維變體
  setCheck?: { setLabel: string; singleLabel: string; ratio: number }; // R7
  unavailableMarks?: string[];     // 預設 ['x']
  reviewNotes?: string[];
}

export interface SheetLayoutConfig {
  sheet: string;
  school?: string;
  season?: string;
  signature?: string;
  learned?: boolean;
  blocks: BlockConfig[];
  ignoreCells?: string[];          // 已知備註格，唔當雜訊
  nameAliases?: Record<string, string>; // 內部名 → 官方名（如 掛呔 → 校呔）
  cellOverrides?: Record<string, string>; // 個別格覆寫（如通告價唔同 Excel：{ 'G13': '21' }）
}

export interface AnalyzeResult {
  school: string;
  season: string;
  genericMode: boolean;
  learnedMode: boolean;
  suggestedLayouts: SheetLayoutConfig[];
  items: AnalyzedItem[];
  warnings: ImportWarning[];
  stats: { sheets: number; blocks: number; items: number; warnings: number };
}

/* ================= 小工具 ================= */

const INFERRED_NOTE = '細碼推斷：跟最細碼價（待用戶刪減）';
const TITLE_SCAN_ROWS = 5;

function colToIdx(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function idxToCol(i: number): string {
  let s = '';
  i++;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}
function parseAddr(addr: string): [number, number] {
  const m = addr.match(/^([A-Z]+)(\d+)$/i)!;
  return [parseInt(m[2], 10) - 1, colToIdx(m[1])];
}
/** 價錢文字 → 數字 */
export function parsePriceText(t: string): number | null {
  const currencyAmount = t.match(/[$]\s*(\d+(?:\.\d+)?)/);
  if (currencyAmount) return Number(currencyAmount[1]);
  const cleaned = t.replace(/[$\s,，]/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function parsePackagedSizePrice(text: string): { size: string; price: number } | null {
  const match = String(text || '').match(/^\s*\$\s*(\d+(?:\.\d{1,2})?)\s*\/\s*(\d+)\s*(對|隻|包|盒)\s*$/);
  if (!match) return null;
  return { size: `${Number(match[2])}${match[3]}裝`, price: Number(match[1]) };
}
const isNumericText = (t: string) =>
  t !== '' && /[0-9]/.test(t) && !isNaN(parseFloat(t.replace(/[$\s,，]/g, '')));
const isTextSize = (value: string) =>
  /^(?:裁碼|均碼|XXS|XS|S|M|L|XL|XXL|[2-9]XL)$/i.test(value.trim());

/** 將換行分隔嘅多值格拆開（R18） */
export function splitLines(t: string): string[] {
  return t.split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== '');
}
const LETTER_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
/** R10：範圍尺碼展開（16-18 → 16,17,18；S-XL → S,M,L,XL） */
export function expandSizeRange(raw: string): string[] | null {
  const t = raw.trim();
  let m = t.match(/^(\d+(?:\.\d+)?)\s*[-–~]\s*(\d+(?:\.\d+)?)\s*((?:寸|吋)(?:長)?)?$/i);
  if (m) {
    const a = parseFloat(m[1]), b = parseFloat(m[2]);
    if (b <= a || b - a > 40) return null;
    const unit = m[3] ?? '';
    const skipsPreviousWholeSize = Number.isInteger(a) && unit && b % 1 === 0.5;
    const step = Number.isInteger(a) && (Number.isInteger(b) || skipsPreviousWholeSize)
      ? 1
      : 0.5;
    const out: string[] = [];
    const lastRegularSize = skipsPreviousWholeSize ? Math.floor(b) - 1 : b;
    for (let v = a; v <= lastRegularSize + 1e-9; v += step)
      out.push(`${Number(v.toFixed(2))}${unit}`);
    if (out.length && Number(out[out.length - 1].replace(/[^\d.]/g, '')) < b)
      out.push(`${b}${unit}`);
    return out;
  }
  m = t.match(/^([A-Z]+)\s*[-–~]\s*([A-Z]+)$/i);
  if (m) {
    const a = LETTER_ORDER.indexOf(m[1].toUpperCase());
    const b = LETTER_ORDER.indexOf(m[2].toUpperCase());
    if (a === -1 || b === -1 || b <= a) return null;
    return LETTER_ORDER.slice(a, b + 1);
  }
  return null;
}

/* ================= 讀檔 → grid ================= */

interface SheetGrid {
  name: string;
  grid: string[][];      // 顯示文字（raw:false — R1 關鍵）
  isDate: boolean[][];   // 該格係咪日期格式
  nRows: number; nCols: number;
}

function sheetToGrid(name: string, ws: XLSX.WorkSheet): SheetGrid {
  const ref = ws['!ref'];
  const grid: string[][] = [];
  const isDate: boolean[][] = [];
  let nRows = 0, nCols = 0;
  if (ref) {
    const [s, e] = ref.split(':');
    const [r1, c1] = parseAddr(s); const [r2, c2] = parseAddr(e);
    // raw:false 攞顯示文字：「2-6」唔會變日期物件
    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    nRows = r2 + 1; nCols = c2 + 1;
    for (let r = 0; r < nRows; r++) {
      grid.push(Array(nCols).fill(''));
      isDate.push(Array(nCols).fill(false));
    }

    for (let r = 0; r <= r2 - r1; r++) {
      for (let c = 0; c <= c2 - c1; c++) {
        const absoluteRow = r1 + r;
        const absoluteCol = c1 + c;
        const v = (json[r] && json[r][c]) ?? '';
        grid[absoluteRow][absoluteCol] = String(v).trim();
        const cell = (ws as any)[idxToCol(absoluteCol) + (absoluteRow + 1)];
        isDate[absoluteRow][absoluteCol] = !!cell && cell.t === 'd';
      }
    }
  }
  return { name, grid, isDate, nRows, nCols };
}

function sheetStructureSignature(g: SheetGrid, blocks: BlockConfig[]): string {
  const gridContents = g.grid
    .map((row) => row
      .map((value, index) => {
        if (!value) return '';
        const content = isNumericText(value) ? '#' : value.replace(/\s+/g, ' ').replace(/[;|]/g, ' ');
        return `${idxToCol(index)}:${content}`;
      })
      .filter(Boolean)
      .join('|'))
    .join(';');
  const inferredLayout = JSON.stringify(blocks.map((block) => ({
    id: block.id,
    name: block.name,
    dataFirst: block.dataFirst,
    dataLast: block.dataLast,
    sizeCol: block.sizeCol,
    priceCols: block.priceCols,
  })));
  const contents = `${gridContents}\n${inferredLayout}`;
  let hash = 14695981039346656037n;
  for (let index = 0; index < contents.length; index++) {
    hash ^= BigInt(contents.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return `v1-${hash.toString(16).padStart(16, '0')}`;
}

function normalizeSheetName(name: string): string {
  return name.trim().replace(/(?:\s+\((?:[2-9]|\d{2,})\)|\s*-\s*複本|\s*\(副本\)|_copy)$/i, '').trim();
}

function cellText(g: SheetGrid, addr: string): string {
  const [r, c] = parseAddr(addr);
  return (g.grid[r] && g.grid[r][c]) ?? '';
}

function detectTitle(g: SheetGrid, knownSchools: string[] = []): { school: string; season: string } {
  let school = '', season = '';
  const titleCells = g.grid.slice(0, Math.min(TITLE_SCAN_ROWS, g.nRows)).flat();
  const normalizedTitle = titleCells.join('').replace(/\s+/g, '');
  school = knownSchools
    .filter((candidate) => normalizedTitle.includes(candidate.replace(/\s+/g, '')))
    .sort((a, b) => b.length - a.length)[0] ?? '';
  for (const t of titleCells) {
    const m = t.match(/(.+?(?:學校|書院|學院|中學|小學))/);
    if (m && !school) school = m[1].replace(/\s+/g, '');
    const sm = t.match(/(冬|夏)/);
    if (sm && !season) season = sm[1];
  }
  return { school, season };
}

function findSurchargeNotes(g: SheetGrid): ImportWarning[] {
  const warnings: ImportWarning[] = [];
  for (let row = 0; row < g.nRows; row++) {
    for (let col = 0; col < g.nCols; col++) {
      const text = g.grid[row]?.[col] ?? '';
      if (!/(?:加\s*\$\s*\d+|(?:褲長|長度|上圍).*(?:寸|吋)|(?:寸|吋).*(?:同價|加\s*\$))/i.test(text)) continue;
      warnings.push({
        sheet: g.name,
        cell: `${idxToCol(col)}${row + 1}`,
        code: 'SURCHARGE_REVIEW',
        severity: 'warn',
        message: `「${text}」係附加費／尺寸說明，唔會當作獨立商品匯入；請核對預覽中的價格處理。`,
      });
    }
  }
  return warnings;
}

/* ================= 主入口 ================= */

export function analyzePriceWorkbook(
  buffer: ArrayBuffer,
  layouts: SheetLayoutConfig[] = [],
  opts: { strict?: boolean; fallbackSchool?: string } = {},
): AnalyzeResult {
  const strict = opts.strict ?? true; // 預設：冇設定嘅 sheet 唔出 items，只 warning（寧缺勿錯）
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const items: AnalyzedItem[] = [];
  const warnings: ImportWarning[] = [];
  const suggestedLayouts: SheetLayoutConfig[] = [];
  let school = '', season = '';
  let blockCount = 0;
  let genericMode = false;
  let learnedMode = false;

  for (const sheetName of wb.SheetNames) {
    const g = sheetToGrid(sheetName, wb.Sheets[sheetName]);
    warnings.push(...findSurchargeNotes(g));
    const knownSchools = [...new Set([
      ...layouts.map((layout) => layout.school),
      opts.fallbackSchool,
    ].filter((name): name is string => Boolean(name)))];
    const title = detectTitle(g, knownSchools);
    if (title.school && !school) { school = title.school; season = title.season; }

    // 同名 sheet 要按校名配對；校名不明或不符時，唔套用具名版面，避免讀錯別校價錢。
    const detectedSchool = title.school || school;
    const normalizedSheetName = normalizeSheetName(sheetName);
    const isCopySheet = normalizedSheetName !== sheetName.trim();
    const cands = layouts.filter((l) => normalizeSheetName(l.sheet) === normalizedSheetName);
    const candidateLayout = cands.find((l) => l.school === title.school && l.season === title.season)
      ?? cands.find((l) => !l.school && l.season === title.season);
    const currentSuggestedBlocks = candidateLayout?.signature ? suggestBlocks(g) : [];
    const changedLayout = Boolean(
      candidateLayout?.signature
      && candidateLayout.signature !== sheetStructureSignature(g, currentSuggestedBlocks),
    );
    const missingCopySignature = Boolean(isCopySheet && candidateLayout && !candidateLayout.signature);
    const changedLayoutOrUnverifiedCopy = changedLayout || missingCopySignature;
    const layout = changedLayoutOrUnverifiedCopy ? undefined : candidateLayout;
    let layoutMismatch = false;
    if (changedLayoutOrUnverifiedCopy && candidateLayout) {
      warnings.push({
        sheet: sheetName,
        code: isCopySheet ? 'COPY_LAYOUT_CHANGED' : 'LEARNED_LAYOUT_CHANGED',
        severity: 'warn',
        message: isCopySheet
          ? `「${sheetName}」係疑似副本，但版面結構未能核對（${missingCopySignature ? '未有已驗證結構記錄' : '結構與已驗證版面不同'}），已轉通用辨識；請逐項核對。`
          : `「${sheetName}」結構同上次核對過嘅版面不同，已停用已記住版面並改用通用辨識；請逐項核對。`,
      });
    }
    if (isCopySheet && !candidateLayout && !changedLayoutOrUnverifiedCopy) {
      warnings.push({
        sheet: sheetName,
        code: 'COPY_LAYOUT_CHANGED',
        severity: 'warn',
        message: `「${sheetName}」係疑似副本，但校名／季節／版面未能配對已驗證設定，已轉通用辨識；請逐項核對。`,
      });
    }
    if (!layout && cands.length > 0 && !changedLayoutOrUnverifiedCopy) {
      layoutMismatch = true;
      const configuredSchools = [...new Set(cands.map((candidate) => candidate.school).filter(Boolean))];
      const message = configuredSchools.length === 1
        ? `版面設定屬於「${configuredSchools[0]}」，但${detectedSchool ? `Excel 偵測到「${detectedSchool}」` : '無法從 Excel 標題辨識學校'}`
        : `有多個版面設定（${configuredSchools.join('、') || '未指定學校'}），但偵測到嘅學校「${detectedSchool || '（未知）'}」無法配對`;
      warnings.push({
        sheet: sheetName,
        code: 'SCHOOL_LAYOUT_MISMATCH',
        severity: strict ? 'error' : 'warn',
        message: strict
          ? `「${sheetName}」${message}，已跳過唔分析，避免套用錯誤價目版面。`
          : `「${sheetName}」${message}；唔會套用別校版面，改用通用辨識並要求人工核對。`,
      });
    }
    if (layoutMismatch && strict) {
      continue;
    } else if (layout) {
      if (layout.school && !school) school = layout.school;
      if (layout.season && !season) season = layout.season;
      if (layout.learned) {
        learnedMode = true;
        warnings.push({
          sheet: sheetName,
          code: 'LEARNED_LAYOUT_REUSED',
          severity: 'warn',
          message: `「${sheetName}」使用已記住版面；請核對本次所有款式、尺碼及價格後再匯入。`,
        });
      }
      blockCount += layout.blocks.length;
      const ctx = { school: layout.school ?? school, season: layout.season ?? season };
      if (layout.cellOverrides) {
        for (const [addr, val] of Object.entries(layout.cellOverrides)) {
          const [ri, ci] = parseAddr(addr);
          if (g.grid[ri] && g.grid[ri][ci] !== undefined) {
            const old = g.grid[ri][ci];
            g.grid[ri][ci] = val;
            warnings.push({
              sheet: sheetName, cell: addr, code: 'PRICE_OVERRIDE', severity: 'warn',
              message: `「${addr}」原值 ${old} 已按設定覆寫為 ${val}（如：通告價唔同 Excel）`,
            });
          }
        }
      }
      for (const b of layout.blocks) parseBlock(g, b, ctx, items, warnings, layout);
      checkStrayCells(g, layout, warnings);
    } else if (!strict) {
      const { blocks: guessed, warnings: detectionWarnings } = detectGenericBlocks(g);
      warnings.push(...detectionWarnings.map((warning) => ({
        sheet: sheetName,
        code: warning.code,
        severity: 'warn' as const,
        message: warning.message,
      })));
      for (const block of guessed.filter((candidate) => !candidate.priceCols.some((column) => column.kind === 'unit'))) {
        warnings.push({
          sheet: sheetName,
          code: 'GENERIC_NO_UNIT_PRICE',
          severity: 'warn',
          message: `區塊「${block.name ?? block.id}」只辨識到多件／組合價欄，沒有可靠單件價，未建立商品；請核對表格欄位。`,
        });
      }
      const fallbackSchool = detectedSchool || opts.fallbackSchool || school;
      if (!fallbackSchool) {
        warnings.push({
          sheet: sheetName, code: 'SCHOOL_NOT_IDENTIFIED', severity: 'error',
          message: `「${sheetName}」未能從標題辨識學校，請先在商品管理選擇正確學校，再重新分析。`,
        });
        continue;
      }
      if (guessed.length === 0) {
        warnings.push({
          sheet: sheetName, code: 'NO_LAYOUT_CONFIG', severity: 'error',
          message: `「${sheetName}」未能自動辨識款式／尺碼／價錢欄，請改用標準格式匯入或整理 Excel 後再試。`,
        });
        continue;
      }
      genericMode = true;
      suggestedLayouts.push({
        sheet: sheetName,
        school: fallbackSchool,
        season: title.season || season,
        signature: sheetStructureSignature(g, guessed),
        learned: true,
        blocks: guessed.map(({ reviewNotes, ...block }) => block),
      });
      for (const block of guessed) {
        for (const note of block.reviewNotes ?? []) {
          warnings.push({
            sheet: sheetName,
            code: 'GENERIC_BLOCK_REVIEW',
            severity: 'warn',
            message: `區塊「${block.name ?? block.id}」：${note}`,
          });
        }
      }
      warnings.push({
        sheet: sheetName, code: 'GENERIC_LAYOUT', severity: 'warn',
        message: layoutMismatch
          ? `「${sheetName}」已使用通用辨識（${guessed.length} 個區塊），完全唔會套用其他學校設定；請逐項核對款式、尺碼及價錢。`
          : `「${sheetName}」未有專用版面設定，已用通用辨識（${guessed.length} 個區塊）；請逐項核對款式、尺碼及價錢。`,
      });
      blockCount += guessed.length;
      const ctx = { school: fallbackSchool, season: title.season || season };
      for (const b of guessed) parseBlock(g, b, ctx, items, warnings);
    } else {
      warnings.push({
        sheet: sheetName, code: 'NO_LAYOUT_CONFIG', severity: 'info',
        message: `「${sheetName}」冇版面設定，已跳過（如需分析請加設定或用人手對位）`,
      });
    }
  }
  return {
    school, season, genericMode, learnedMode, suggestedLayouts, items, warnings,
    stats: { sheets: wb.SheetNames.length, blocks: blockCount, items: items.length, warnings: warnings.length },
  };
}

/** CSV 入口：標準格式直接讀，否則當 grid 走同一套流程 */
export function analyzeCsvText(text: string, layouts: SheetLayoutConfig[] = []): AnalyzeResult {
  const wb = XLSX.read(text, { type: 'string' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const header: string[] = ((XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })[0] as any[]) ?? []).map(String);
  const h = header.join();
  if (/款式/.test(h) && /單價/.test(h)) {
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
    const items: AnalyzedItem[] = rows.map((r, i) => ({
      school: String(r['學校'] ?? ''), season: String(r['季節'] ?? ''),
      gender: r['性別區'] ? String(r['性別區']) : undefined,
      item: String(r['款式'] ?? ''), size: r['尺碼'] === '' || r['尺碼'] == null ? null : String(r['尺碼']),
      unitPrice: parseFloat(String(r['單價'])) || 0,
      bundles: ([
        r['組合1數量'] ? { qty: +r['組合1數量'], unit: String(r['組合1單位'] ?? ''), price: parseFloat(String(r['組合1價'])) || 0 } : null,
        r['組合2數量'] ? { qty: +r['組合2數量'], unit: String(r['組合2單位'] ?? ''), price: parseFloat(String(r['組合2價'])) || 0 } : null,
        r['組合數量'] ? { qty: +r['組合數量'], unit: String(r['組合單位'] ?? ''), price: parseFloat(String(r['組合價'])) || 0 } : null,
      ].filter(Boolean) as BundleInfo[]),
      setTotal: r['全套價'] ? parseFloat(String(r['全套價'])) : undefined,
      note: String(r['備註'] ?? '') || undefined,
      source: { sheet: 'CSV', cell: `R${i + 2}` },
    }));
    const school = items[0]?.school ?? '', season = items[0]?.season ?? '';
    return { school, season, items, warnings: [], stats: { sheets: 1, blocks: 0, items: items.length, warnings: 0 } };
  }
  return analyzePriceWorkbook(new TextEncoder().encode(text).buffer as ArrayBuffer, layouts);
}

/* ================= Block 解析 ================= */

interface Ctx { school: string; season: string; }
interface SizeJob { size: string; extraNote?: string; replaceNote?: boolean; tailored?: boolean }

function resolveName(g: SheetGrid, b: BlockConfig): string {
  if (b.name) return b.name;
  if (b.nameCells) return b.nameCells.map((a) => cellText(g, a)).filter(Boolean).join('');
  return b.id;
}

function parseBlock(
  g: SheetGrid, b: BlockConfig, ctx: Ctx,
  items: AnalyzedItem[], warnings: ImportWarning[],
  layout?: SheetLayoutConfig,
): void {
  const marks = (b.unavailableMarks ?? ['x']).map((s) => s.toLowerCase());
  const baseName = resolveName(g, b);
  const surchargeValues = b.secondDim?.values.filter((value) => value.plus !== 0) ?? [];
  if (surchargeValues.length > 0) {
    warnings.push({
      sheet: g.name,
      code: 'SURCHARGE_REVIEW',
      severity: 'warn',
      message: `「${baseName}」含尺寸附加費（${surchargeValues.map((value) => `${value.label} +$${value.plus}`).join('、')}）；附加費不會作為獨立商品，請核對預覽價格。`,
    });
  }

  // R13：名格有數字、價錢格又有另一個數字
  if (b.nameCells && b.sizeCol == null && !b.nameCol) {
    const nameText = b.nameCells.map((a) => cellText(g, a)).join(' ');
    const numInName = nameText.match(/\d+(?:\.\d+)?/);
    const pc0 = b.priceCols[0];
    if (numInName && pc0) {
      const price = parsePriceText(cellText(g, `${pc0.col}${b.dataFirst}`));
      if (price !== null && Math.abs(parseFloat(numInName[0]) - price) > 0.01) {
        warnings.push({
          sheet: g.name, cell: b.nameCells[0], code: 'DUAL_PRICE', severity: 'warn',
          message: `「${baseName}」：名格寫住 ${numInName[0]}，但價錢格係 ${price}，已用價錢格`,
        });
      }
    }
  }

  const alias = (n: string) => layout?.nameAliases?.[n] ?? n;

  for (let r = b.dataFirst; r <= b.dataLast; r++) {
    const ri = r - 1;
    let rowName = alias(baseName);

    // 決定 logical entries：一般一行一個；multiLine 一行多個；sizeListCell 去別格攞
    interface LE { sizeRaw: string; getRaw: (col: string) => string; dateFlag: boolean; sizeCell: string; }
    const entries: LE[] = [];
    const cellRaw = (col: string) => cellText(g, `${col}${r}`);

    if (b.sizeListCell) {
      // R19：尺碼喺別格（換行分隔），按行號對應
      const allSizes = splitLines(cellText(g, b.sizeListCell));
      const sz = (allSizes[r - b.dataFirst] ?? '').trim();
      if (!sz) continue;
      entries.push({ sizeRaw: sz, getRaw: cellRaw, dateFlag: false, sizeCell: b.sizeListCell! });
    } else if (b.nameCol) {
      const t = ((g.grid[ri] && g.grid[ri][colToIdx(b.nameCol)]) ?? '').trim();
      if (!t) continue;
      rowName = b.packagePriceFromSourceCell ? baseName : alias(t);
      entries.push({
        sizeRaw: b.packagePriceFromSourceCell ? t : '__NOSIZE__',
        getRaw: cellRaw,
        dateFlag: false,
        sizeCell: `${b.nameCol}${r}`,
      });
    } else if (b.sizeCol) {
      const sr = ((g.grid[ri] && g.grid[ri][colToIdx(b.sizeCol)]) ?? '').trim();
      if (!sr) continue;
      const df = !!(g.isDate[ri] && g.isDate[ri][colToIdx(b.sizeCol)]);
      if (b.multiLine) {
        // R18：一格多值，拆開逐個對應
        const sizeLines = splitLines(sr);
        const colLines = new Map<string, string[]>();
        let n = sizeLines.length;
        for (const pc of b.priceCols) {
          const ls = splitLines(cellRaw(pc.col));
          colLines.set(pc.col, ls);
          n = Math.max(n, ls.length);
        }
        for (let i = 0; i < n; i++) {
          const m = new Map<string, string>();
          for (const pc of b.priceCols) {
            const ls = colLines.get(pc.col)!;
            m.set(pc.col, ls[Math.min(i, ls.length - 1)] ?? '');
          }
          entries.push({
            sizeRaw: sizeLines[Math.min(i, sizeLines.length - 1)] ?? '',
            getRaw: (col: string) => m.get(col) ?? '',
            dateFlag: df,
            sizeCell: `${b.sizeCol}${r}`,
          });
        }
      } else {
        entries.push({ sizeRaw: sr, getRaw: cellRaw, dateFlag: df, sizeCell: `${b.sizeCol}${r}` });
      }
    } else {
      entries.push({ sizeRaw: '__NOSIZE__', getRaw: cellRaw, dateFlag: false, sizeCell: '' });
    }

    for (const ent of entries) {
      let sizeRaw = ent.sizeRaw;
      if (!sizeRaw) continue;
      const unitPc = b.priceCols.find((p) => p.kind === 'unit');
      const packageSpec = b.packagePriceFromSourceCell
        ? parsePackagedSizePrice(sizeRaw)
        : null;
      if (b.packagePriceFromSourceCell && !packageSpec) {
        warnings.push({
          sheet: g.name, cell: ent.sizeCell, code: 'PACKAGED_SIZE_PARSE_FAIL', severity: 'error',
          message: `「${baseName}」包裝格「${sizeRaw}」格式無效，必須使用 $金額/數量單位（對、隻、包或盒）`,
        });
        continue;
      }
      if (packageSpec && !unitPc) {
        warnings.push({
          sheet: g.name, cell: ent.sizeCell, code: 'PACKAGED_SIZE_PARSE_FAIL', severity: 'error',
          message: `「${baseName}」包裝格已識別規格，但版面沒有單價欄設定`,
        });
        continue;
      }
      if (packageSpec) {
        rowName = baseName;
        sizeRaw = packageSpec.size;
      }
      if (ent.dateFlag) {
        warnings.push({
          sheet: g.name, cell: ent.sizeCell, code: 'DATE_AS_SIZE', severity: 'warn',
          message: `「${rowName}」尺碼格係日期格式，已用顯示文字「${sizeRaw}」`,
        });
      }

    // 尺碼展開（R10 / R14）
    const sizeJobs: SizeJob[] = [];
    if (packageSpec) {
      sizeJobs.push({ size: packageSpec.size });
    } else if (sizeRaw !== '__NOSIZE__') {
      if (sizeRaw === '裁碼' && unitPc?.customSizes?.length) {
        warnings.push({
          sheet: g.name, cell: ent.sizeCell, code: 'CUSTOM_SIZE_USED', severity: 'info',
          message: `「${rowName}」裁碼已按設定展開做 ${unitPc.customSizes.length} 個尺碼`,
        });
        for (const s of unitPc.customSizes)
          sizeJobs.push({
            size: s,
            extraNote: unitPc.customNote ?? '裁碼展開',
            replaceNote: !unitPc.customNoteAppend,
            tailored: true,
          });
      } else if (sizeRaw === '裁碼') {
        sizeJobs.push({ size: '裁碼', tailored: true });
        warnings.push({
          sheet: g.name, cell: ent.sizeCell, code: 'CUSTOM_SIZE_USED', severity: 'warn',
          message: `「${rowName}」有「裁碼」但冇大碼清單，已保留「裁碼」選項`,
        });
      } else if (b.expandRanges !== false && b.sizeKind !== 'pack') {
        const expanded = expandSizeRange(sizeRaw);
        if (expanded) for (const s of expanded) sizeJobs.push({ size: s });
        else sizeJobs.push({ size: sizeRaw });
      } else {
        sizeJobs.push({ size: sizeRaw });
      }
    } else {
      sizeJobs.push({ size: '__NOSIZE__' });
    }

    const getRaw = packageSpec
      ? (col: string) => col === unitPc?.col ? String(packageSpec.price) : ent.getRaw(col)
      : ent.getRaw;
    emitRowItems(g, b, r, rowName, sizeJobs, ctx, items, warnings, marks, getRaw);
    } // entries
  }

  // R15：細碼（跟最細碼價 = dataFirst 行單價）
  // 二維變體嘅 belowMinFirstDim：用第一個 unit 欄做基準
  if (b.secondDim?.belowMinFirstDim?.length) {
    const upc = b.priceCols.find((p) => p.kind === 'unit');
    if (upc) {
      const firstPrice = parsePriceText(cellText(g, `${upc.col}${b.dataFirst}`));
      if (firstPrice !== null) {
        emitBelowMin(g, b, { ...upc, belowMinSizes: b.secondDim.belowMinFirstDim },
          firstPrice, ctx, items, warnings);
      }
    }
  }
  for (const pc of b.priceCols) {
    if (pc.kind !== 'unit' || !pc.belowMinSizes?.length) continue;
    const firstRaw = b.multiLine
      ? (splitLines(cellText(g, `${pc.col}${b.dataFirst}`))[0] ?? '')
      : cellText(g, `${pc.col}${b.dataFirst}`);
    const firstPrice = parsePriceText(firstRaw);
    if (firstPrice === null) continue;
    emitBelowMin(g, b, pc, firstPrice, ctx, items, warnings);
  }

/** R15：細碼推斷行（跟最細碼價，bundle 直接計唔驗算） */
function emitBelowMin(
  g: SheetGrid, b: BlockConfig, pc: PriceColConfig, firstPrice: number,
  ctx: Ctx, items: AnalyzedItem[], warnings: ImportWarning[],
): void {
  const baseName = b.name ?? (b.nameCells ? b.nameCells.map((a) => cellText(g, a)).filter(Boolean).join('') : b.id);
  const label = pc.label ?? baseName;
  const labelBundles = b.priceCols.filter(
    (p) => p.kind === 'bundle' && p.bundleQty && (p.label ?? baseName) === label,
  );
  for (const s of pc.belowMinSizes ?? []) {
    if (b.secondDim) {
      const tpl = b.secondDim.sizeTemplate ?? ((d1, d2) => `${d1}／${d2}`);
      for (const lv of b.secondDim.values) {
        const price = firstPrice + lv.plus;
        const it = makeItem(ctx, g, b, label, tpl(s, lv.label), price,
          `${pc.col}${b.dataFirst}（推斷）`, INFERRED_NOTE, undefined, pc.note);
        for (const bp of labelBundles)
          it.bundles.push({ qty: bp.bundleQty!, unit: bp.bundleUnit ?? '', price: price * bp.bundleQty! });
        items.push(it);
        warnings.push({
          sheet: g.name, code: 'INFERRED_SIZE', severity: 'info',
          message: `「${label}」細碼 ${tpl(s, lv.label)} 係推斷加入（$${price}），可刪減`,
        });
      }
    } else {
      // 非二維：bundle 用 dataFirst 行嘅原價（可能有折扣，唔好自己計）
      const it = makeItem(ctx, g, b, label, s, firstPrice,
        `${pc.col}${b.dataFirst}（推斷）`, INFERRED_NOTE, undefined, pc.note);
      for (const bp of labelBundles) {
        const srcPrice = parsePriceText(cellText(g, `${bp.col}${b.dataFirst}`));
        it.bundles.push({ qty: bp.bundleQty!, unit: bp.bundleUnit ?? '', price: srcPrice ?? firstPrice * bp.bundleQty! });
      }
      items.push(it);
      warnings.push({
        sheet: g.name, code: 'INFERRED_SIZE', severity: 'info',
        message: `「${label}」細碼 ${s} 係推斷加入（跟最細碼價 $${firstPrice}），可刪減`,
      });
    }
  }
}

/** R7：setCheck（套裝 ≈ ratio × 單件）— 直接用當行讀到嘅價 */
  if (b.setCheck) {
    const { setLabel, singleLabel, ratio } = b.setCheck;
    for (let r = b.dataFirst; r <= b.dataLast; r++) {
      const setPc = b.priceCols.find((p) => (p.label ?? baseName) === setLabel);
      const singlePc = b.priceCols.find((p) => (p.label ?? baseName) === singleLabel);
      if (!setPc || !singlePc) continue;
      const sv = parsePriceText(cellText(g, `${setPc.col}${r}`));
      const gv = parsePriceText(cellText(g, `${singlePc.col}${r}`));
      if (sv !== null && gv !== null && Math.abs(sv - gv * ratio) > 0.01) {
        warnings.push({
          sheet: g.name, cell: `${setPc.col}${r}`, code: 'SET_TOTAL_MISMATCH', severity: 'warn',
          message: `「${setLabel}」$${sv} ≠ ${ratio}×「${singleLabel}」$${gv}`,
        });
      }
    }
  }
}

function makeItem(
  ctx: Ctx, g: SheetGrid, b: BlockConfig, label: string, size: string | null,
  unitPrice: number, cell: string, extraNote?: string, setTotal?: number,
  labelNote?: string, replaceNote?: boolean, tailored?: boolean,
): AnalyzedItem {
  const parts: string[] = [];
  if (!replaceNote) {
    if (labelNote ?? b.note) parts.push((labelNote ?? b.note)!);
  }
  if (extraNote) parts.push(extraNote);
  return {
    school: ctx.school, season: ctx.season, gender: b.gender,
    item: label, size, unitPrice, bundles: [],
    ...(tailored ? { tailored: true } : {}),
    setTotal,
    note: parts.length ? parts.join('；') : undefined,
    source: { sheet: g.name, cell, blockId: b.id, blockName: label },
  };
}

function emitRowItems(
  g: SheetGrid, b: BlockConfig, r: number, rowName: string,
  sizeJobs: SizeJob[], ctx: Ctx,
  items: AnalyzedItem[], warnings: ImportWarning[], marks: string[],
  getRaw: (col: string) => string = (col) => cellText(g, `${col}${r}`),
): void {
  const baseName = rowName;
  // 讀當行各欄
  const colVal = new Map<string, { price: number | null; unavailable: boolean }>();
  for (const pc of b.priceCols) {
    const raw = getRaw(pc.col);
    if (marks.includes(raw.toLowerCase())) {
      colVal.set(pc.col, { price: null, unavailable: true });
      warnings.push({
        sheet: g.name, cell: `${pc.col}${r}`, code: 'UNAVAILABLE_SIZE', severity: 'info',
        message: `「${pc.label ?? baseName}」：標示「${raw}」= 冇呢個碼，已跳過`,
      });
      continue;
    }
    if (!raw) { colVal.set(pc.col, { price: null, unavailable: false }); continue; }
    const price = parsePriceText(raw);
    if (price === null) {
      warnings.push({
        sheet: g.name, cell: `${pc.col}${r}`, code: 'PRICE_PARSE_FAIL', severity: 'error',
        message: `「${baseName}」${pc.col}${r} 讀唔到價錢：「${raw}」`,
      });
      colVal.set(pc.col, { price: null, unavailable: false });
      continue;
    }
    colVal.set(pc.col, { price, unavailable: false });
  }

  // labels（去重，setTotal 除外）
  const labels = [...new Set(
    b.priceCols.filter((p) => p.kind !== 'setTotal').map((p) => p.label ?? baseName),
  )];
  const setPc = b.priceCols.find((p) => p.kind === 'setTotal');

  // setTotal 驗算（R7）：全套 ≈ 各件相加
  let setTotal: number | undefined;
  if (setPc) {
    const sv = colVal.get(setPc.col);
    if (sv && sv.price !== null) {
      setTotal = sv.price;
      const unitSum = b.priceCols
        .filter((p) => p.kind === 'unit')
        .reduce((acc, p) => {
          const v = colVal.get(p.col);
          return acc + (v && v.price !== null ? v.price : NaN);
        }, 0);
      if (!isNaN(unitSum) && Math.abs(setTotal - unitSum) > 0.01) {
        warnings.push({
          sheet: g.name, cell: `${setPc.col}${r}`, code: 'SET_TOTAL_MISMATCH', severity: 'warn',
          message: `全套 $${setTotal} ≠ 各件相加 $${unitSum}`,
        });
      }
    }
  }

  for (const sj of sizeJobs) {
    const isNoSize = sj.size === '__NOSIZE__';
    const isTailor = sj.size === '裁碼'; // 冇 customSizes 展開先會剩低「裁碼」
    const tailorNote = isTailor ? b.secondDim?.tailorNote : undefined;

    if (b.secondDim && !isNoSize && !isTailor) {
      // R11：二維展開（腰圍 × 褲長）
      const tpl = b.secondDim.sizeTemplate ?? ((d1, d2) => `${d1}／${d2}`);
      for (const lv of b.secondDim.values) {
        for (const label of labels) {
          const upc = b.priceCols.find((p) => p.kind === 'unit' && (p.label ?? baseName) === label);
          if (!upc) continue;
          const uv = colVal.get(upc.col);
          if (!uv || uv.price === null || uv.unavailable) continue;
          const price = uv.price + lv.plus;
          const noteParts = [lv.note, b.secondDim.bundleNote].filter(Boolean).join('（') +
            (b.secondDim.bundleNote ? '）' : '');
          const it = makeItem(ctx, g, b, label, tpl(sj.size, lv.label), price,
            `${upc.col}${r}`, [sj.extraNote, noteParts].filter(Boolean).join('；') || undefined,
            undefined, upc.note, sj.replaceNote, sj.tailored);
          // 二維嘅 bundle：標準長度用原格驗算，其他長度直接計
          for (const pc of b.priceCols) {
            if (pc.kind !== 'bundle' || !pc.bundleQty || (pc.label ?? baseName) !== label) continue;
            const raw = getRaw(pc.col);
            const srcPrice = parsePriceText(raw);
            if (lv.plus === 0 && srcPrice !== null) {
              const expected = price * pc.bundleQty;
              if (Math.abs(srcPrice - expected) > 0.01) {
                warnings.push({
                  sheet: g.name, cell: `${pc.col}${r}`, code: 'BUNDLE_MISMATCH', severity: 'warn',
                  message: `「${label}」${tpl(sj.size, lv.label)}：${pc.bundleQty}${pc.bundleUnit ?? ''}價 $${srcPrice} ≠ ${pc.bundleQty}×$${price}`,
                });
              }
              it.bundles.push({ qty: pc.bundleQty, unit: pc.bundleUnit ?? '', price: srcPrice });
            } else {
              it.bundles.push({ qty: pc.bundleQty, unit: pc.bundleUnit ?? '', price: price * pc.bundleQty });
            }
          }
          items.push(it);
        }
      }
      continue;
    }

    // 一般（一維）
    for (const label of labels) {
      const upc = b.priceCols.find((p) => p.kind === 'unit' && (p.label ?? baseName) === label);
      if (!upc) continue;
      const uv = colVal.get(upc.col);
      if (!uv || uv.price === null || uv.unavailable) continue;
      const it = makeItem(ctx, g, b, label, isNoSize ? null : sj.size, uv.price,
        `${upc.col}${r}`,
        [sj.extraNote, tailorNote].filter(Boolean).join('；') || undefined,
        setTotal, upc.note, sj.replaceNote || !!tailorNote, sj.tailored);
      attachBundlesValidated(g, b, label, uv.price, r, it, warnings, getRaw);
      items.push(it);
    }
  }
}

/** 同行 bundle 驗算（非 secondDim） */
function attachBundlesValidated(
  g: SheetGrid, b: BlockConfig, label: string, unitPrice: number, row: number,
  it: AnalyzedItem, warnings: ImportWarning[],
  getRaw: (col: string) => string,
): void {
  for (const pc of b.priceCols) {
    if (pc.kind !== 'bundle' || !pc.bundleQty || (pc.label ?? it.item) !== label) continue;
    const raw = getRaw(pc.col);
    const srcPrice = parsePriceText(raw);
    if (srcPrice === null) continue;
    const expected = unitPrice * pc.bundleQty;
    if (Math.abs(srcPrice - expected) > 0.01) {
      warnings.push({
        sheet: g.name, cell: `${pc.col}${row}`, code: 'BUNDLE_MISMATCH', severity: 'warn',
        message: `「${label}」${it.size ?? ''}：${pc.bundleQty}${pc.bundleUnit ?? ''}價 $${srcPrice} ≠ ${pc.bundleQty}×$${unitPrice}，兩個價都保留`,
      });
    }
    it.bundles.push({ qty: pc.bundleQty, unit: pc.bundleUnit ?? '', price: srcPrice });
  }
}

/* ================= 雜訊檢查（R8） ================= */

function checkStrayCells(g: SheetGrid, layout: SheetLayoutConfig, warnings: ImportWarning[]): void {
  const covered = new Set<string>();
  const mark = (addr: string) => {
    const [r, c] = parseAddr(addr);
    covered.add(`${r},${c}`);
  };
  for (const a of layout.ignoreCells ?? []) mark(a);
  for (const b of layout.blocks) {
    for (const a of b.nameCells ?? []) mark(a);
    const cols = new Set<string>();
    if (b.sizeCol) cols.add(b.sizeCol);
    if (b.nameCol) cols.add(b.nameCol);
    for (const p of b.priceCols) cols.add(p.col);
    for (let r = b.dataFirst; r <= b.dataLast; r++) for (const c of cols) mark(`${c}${r}`);
    // header 行（dataFirst 上面嗰行）都唔係雜訊
    for (const c of cols) mark(`${c}${b.dataFirst - 1}`);
  }
  for (let r = 0; r < Math.min(TITLE_SCAN_ROWS, g.nRows); r++)
    for (let c = 0; c < g.nCols; c++)
      if (/學校|書院|學院|中學|小學/.test(g.grid[r][c])) covered.add(`${r},${c}`);

  for (let r = 0; r < g.nRows; r++)
    for (let c = 0; c < g.nCols; c++) {
      if (covered.has(`${r},${c}`)) continue;
      const t = g.grid[r][c];
      if (t && !isNumericText(t) && t.replace(/[$\s,，]/g, '').length >= 2) {
        warnings.push({
          sheet: g.name, cell: `${idxToCol(c)}${r + 1}`, code: 'STRAY_CELL', severity: 'info',
          message: `「${t}」唔屬於任何已知區塊，已忽略`,
        });
      }
    }
}

/* ================= 自動偵測（新版面半自動對位） ================= */

interface GenericDetectionWarning {
  code: string;
  message: string;
}

interface GenericNameCell {
  row: number;
  col: number;
  value: string;
}

interface NumericColumnStats {
  median: number;
  range: number;
  integerRatio: number;
  rangeSizeCount: number;
  currencyCount: number;
}

const GENERIC_HEADER_TEXT = /^(?:size|尺碼|碼數|價錢|價格|單價|售價|價|product|款式|產品|項目|男|女|男裝|女裝|男生|女生|裁碼|均碼|腰圍|上圍|褲長|長度|連章|\d+\s*(?:件|條|對))$/i;
const GENERIC_NOTE_PATTERNS = [/加\s*\$/, /或以上/, /同價/, /吋/, /寸/, /["”]/, /褲長/, /上圍|上圉/, /長度/];
const GENERIC_NOTE_TEXT = new RegExp(GENERIC_NOTE_PATTERNS.map((pattern) => pattern.source).join('|'), 'i');
const SIZE_HEADER_TEXT = /^(?:size|尺碼|碼數|腰圍|上圍|領圍)$/i;
const PRICE_HEADER_TEXT = /^(?:單價|售價|價錢|價格|價錢|price)$/i;

function isGenericNameCell(value: string): boolean {
  const text = value.trim();
  return text.length >= 2
    && !GENERIC_HEADER_TEXT.test(text)
    && !isSizeValue(text)
    && !/價目表|價目|price\s*list|(?:中學|小學|書院|學院|學校).*(?:夏|冬)/i.test(text);
}

function isGenericNumericCell(value: string): boolean {
  return isNumericText(value) && !GENERIC_NOTE_TEXT.test(value);
}

function numericColumnStats(g: SheetGrid, col: number, firstRow: number, lastRow: number): NumericColumnStats {
  const values: number[] = [];
  let rangeSizeCount = 0, currencyCount = 0;
  for (let row = firstRow; row <= lastRow; row++) {
    const text = g.grid[row]?.[col] ?? '';
    if (!isGenericNumericCell(text)) continue;
    const value = parsePriceText(text);
    if (value === null) continue;
    values.push(value);
    if (/^\s*\d+(?:\.\d+)?\s*[-–~]\s*\d+(?:\.\d+)?\s*$/.test(text)) rangeSizeCount++;
    if (/\$/.test(text)) currencyCount++;
  }
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const median = values.length === 0
    ? 0
    : values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  return {
    median,
    range: values.length > 0 ? values[values.length - 1] - values[0] : 0,
    integerRatio: values.length > 0 ? values.filter(Number.isInteger).length / values.length : 0,
    rangeSizeCount,
    currencyCount,
  };
}

function isSizeValue(value: string): boolean {
  return isTextSize(value)
    || /^\d+(?:\.\d+)?(?:寸|吋)(?:長)?$/i.test(value.trim())
    || expandSizeRange(value) !== null;
}

function findTextSizeColumn(g: SheetGrid, firstCol: number, lastCol: number, firstRow: number, lastRow: number): number | undefined {
  let bestCol: number | undefined, bestCount = 0;
  for (let col = firstCol; col <= lastCol; col++) {
    let count = 0;
    for (let row = firstRow; row <= lastRow; row++)
      if (isSizeValue(g.grid[row]?.[col] ?? '')) count++;
    if (count > bestCount) { bestCol = col; bestCount = count; }
  }
  return bestCount >= 3 ? bestCol : undefined;
}

function isColumnHeader(g: SheetGrid, col: number, firstRow: number, lastRow: number, pattern: RegExp): boolean {
  for (let row = firstRow; row <= lastRow; row++)
    if (pattern.test((g.grid[row]?.[col] ?? '').trim())) return true;
  return false;
}

function scoreGenericName(
  g: SheetGrid,
  candidate: GenericNameCell,
  priceCol: number,
  dataFirst: number,
  nameCandidates: GenericNameCell[],
): number {
  let score = candidate.row < dataFirst && dataFirst - candidate.row <= 3 ? 3 : 0;
  const nearestLeft = nameCandidates
    .filter((other) =>
      other.row === candidate.row
      && other.col <= priceCol
      && !GENERIC_NOTE_TEXT.test(other.value)
      && !isNumericText(other.value),
    )
    .sort((a, b) => b.col - a.col)[0];
  if (nearestLeft?.row === candidate.row && nearestLeft.col === candidate.col) score += 2;
  const headerStart = Math.max(0, candidate.row - 2);
  const headerEnd = Math.min(g.nRows - 1, dataFirst);
  const nearbyHeader = g.grid.slice(headerStart, headerEnd + 1).some((row) =>
    row.some((value, col) => /款式|產品|項目/i.test(value)
      && Math.min(Math.abs(col - candidate.col), Math.abs(col - priceCol)) <= 3),
  );
  if (nearbyHeader) score += 1;
  for (const pattern of GENERIC_NOTE_PATTERNS)
    if (pattern.test(candidate.value)) score -= 5;
  if (isNumericText(candidate.value)) score -= 3;
  if (candidate.value.includes('$')) score -= 2;
  return score;
}

function hasBlankColumnBetween(g: SheetGrid, firstCol: number, lastCol: number): boolean {
  const low = Math.min(firstCol, lastCol);
  const high = Math.max(firstCol, lastCol);
  for (let col = low + 1; col < high; col++)
    if (g.grid.every((row) => !row[col]?.trim())) return true;
  return false;
}

function hasCompetingNameBetween(
  candidate: GenericNameCell,
  targetCol: number,
  nameCandidates: GenericNameCell[],
): boolean {
  const low = Math.min(candidate.col, targetCol);
  const high = Math.max(candidate.col, targetCol);
  return nameCandidates.some((other) => {
    if (other.row < candidate.row - 1 || other.row > candidate.row + 3
      || other.col === candidate.col || GENERIC_NOTE_TEXT.test(other.value)) return false;
    const between = other.col >= low && other.col <= high
      && !(other.row === candidate.row && Math.abs(other.col - candidate.col) === 1);
    const adjacentLeftBlock = targetCol < candidate.col
      && other.col < targetCol
      && other.col >= targetCol - 1
      && (other.row === candidate.row || other.row === candidate.row - 1);
    return between || adjacentLeftBlock;
  });
}

function detectBundleColumn(g: SheetGrid, col: number, firstRow: number, headerStart: number): PriceColConfig | undefined {
  for (let row = firstRow - 1; row >= headerStart; row--) {
    const ownHeader = g.grid[row]?.[col] ?? '';
    const match = ownHeader.match(/(\d+)\s*([件條對])/);
    if (match) return {
      col: idxToCol(col), kind: 'bundle',
      bundleQty: Number(match[1]), bundleUnit: match[2],
    };
    const adjacentHeader = g.grid[row]?.[col - 1] ?? '';
    const adjacentMatch = adjacentHeader.match(/(\d+)\s*([件條對])/);
    if (adjacentMatch && !ownHeader.trim()) return {
      col: idxToCol(col), kind: 'bundle',
      bundleQty: Number(adjacentMatch[1]), bundleUnit: adjacentMatch[2],
    };
  }
  return undefined;
}

function detectGenericGender(g: SheetGrid, sizeCol: number, priceCols: number[]): string | undefined {
  const middleCol = priceCols.length
    ? (sizeCol + priceCols.reduce((sum, col) => sum + col, 0) / priceCols.length) / 2
    : sizeCol;
  const labels: { label: string; col: number }[] = [];
  for (let row = 0; row < Math.min(TITLE_SCAN_ROWS, g.nRows); row++) {
    for (let col = 0; col < g.nCols; col++) {
      const text = g.grid[row]?.[col]?.replace(/\s+/g, '') ?? '';
      if (/^(男女|男女生|男女裝)$/.test(text)) labels.push({ label: '男女', col });
      else if (/^(男|男生|男裝)$/.test(text)) labels.push({ label: '男', col });
      else if (/^(女|女生|女裝)$/.test(text)) labels.push({ label: '女', col });
    }
  }
  return labels.sort((a, b) => Math.abs(a.col - middleCol) - Math.abs(b.col - middleCol))[0]?.label;
}

function detectGenericBlocks(g: SheetGrid): { blocks: BlockConfig[]; warnings: GenericDetectionWarning[] } {
  const blocks: BlockConfig[] = [];
  const warnings: GenericDetectionWarning[] = [];
  const nameCandidates: GenericNameCell[] = [];
  for (let row = 0; row < Math.min(45, g.nRows); row++) {
    for (let col = 0; col < g.nCols; col++) {
      const value = g.grid[row]?.[col] ?? '';
      if (isGenericNameCell(value) && !isNumericText(value)) nameCandidates.push({ row, col, value });
    }
  }

  const proposed: {
    id: string;
    name: string;
    row: number;
    dataFirst: number;
    dataLast: number;
    sizeCol: number;
    priceCols: PriceColConfig[];
    reviewNotes: string[];
  }[] = [];
  const diagnosed = new Set<string>();
  const diagnose = (code: string, key: string, message: string) => {
    if (diagnosed.has(key)) return;
    diagnosed.add(key);
    warnings.push({ code, message });
  };

  for (const candidate of nameCandidates) {
    const minCol = Math.max(0, candidate.col - 2);
    const maxCol = Math.min(g.nCols - 1, candidate.col + 6);
    const scanLast = Math.min(g.nRows - 1, candidate.row + 13);
    const numericRuns: { col: number; start: number; end: number }[] = [];
    for (let col = minCol; col <= maxCol; col++) {
      let runStart = -1, runLength = 0, bestRun = { start: -1, end: -1, length: 0 };
      for (let row = candidate.row + 1; row <= scanLast; row++) {
        if (isGenericNumericCell(g.grid[row]?.[col] ?? '')) {
          if (runStart < 0) runStart = row;
          runLength++;
          if (runLength > bestRun.length) bestRun = { start: runStart, end: row, length: runLength };
        } else {
          runStart = -1;
          runLength = 0;
        }
      }
      if (bestRun.length >= 3 && !hasCompetingNameBetween(candidate, col, nameCandidates))
        numericRuns.push({ col, start: bestRun.start, end: bestRun.end });
    }
    if (numericRuns.length === 0) continue;

    const firstDataRow = Math.min(...numericRuns.map((run) => run.start));
    const activeRuns = numericRuns.filter((run) => run.start <= firstDataRow + 1);
    const numericCols = activeRuns.map((run) => run.col);
    const dataLastRow = Math.max(...activeRuns.map((run) => run.end));

    const textSizeCol = findTextSizeColumn(
      g,
      Math.max(0, candidate.col - 3),
      Math.max(0, numericCols[0] - 1),
      firstDataRow,
      dataLastRow,
    );
    let sizeCol = textSizeCol;
    let priceColumnIndexes = numericCols;
    const reviewNotes: string[] = [];

    if (sizeCol === undefined) {
      const stats = numericCols.map((col) => ({
        col,
        stats: numericColumnStats(g, col, firstDataRow, dataLastRow),
        sizeHeader: Math.abs(col - candidate.col) <= 2
          && isColumnHeader(g, col, Math.max(0, candidate.row - 1), firstDataRow - 1, SIZE_HEADER_TEXT),
        priceHeader: isColumnHeader(g, col, Math.max(0, candidate.row - 1), firstDataRow - 1, PRICE_HEADER_TEXT),
      }));
      const explicitSize = stats.find((entry) => entry.sizeHeader);
      if (explicitSize) {
        sizeCol = explicitSize.col;
        priceColumnIndexes = numericCols.filter((col) => col !== sizeCol);
      } else if (stats.length >= 2) {
        const first = stats[0];
        const next = stats.slice(1).find((entry) => entry.col > first.col);
        const sizeScore = Number(first.stats.median >= 10 && first.stats.median <= 60)
          + Number(first.stats.range <= 40)
          + Number(first.stats.integerRatio >= 0.75)
          + first.stats.rangeSizeCount * 2
          + Number(Boolean(next && next.stats.median > first.stats.median * 1.25)) * 2;
        const priceScore = Number(first.stats.median >= 30 && first.stats.median <= 500)
          + Number(first.stats.range > 30)
          + Number(first.stats.integerRatio < 1)
          + first.stats.currencyCount * 2
          + Number(first.priceHeader) * 4;
        if (sizeScore >= priceScore + 1 && next && first.stats.median < next.stats.median * 0.9) {
          sizeCol = first.col;
          priceColumnIndexes = numericCols.filter((col) => col !== sizeCol);
        } else {
          const summary = stats.map(({ col, stats: values }) =>
            `${idxToCol(col)}欄中位數 ${Number(values.median.toFixed(1))}、值域 ${Number(values.range.toFixed(1))}、整數 ${(values.integerRatio * 100).toFixed(0)}%`,
          ).join('；');
          diagnose(
            'NUMERIC_COLUMN_AMBIGUOUS',
            `numeric:${candidate.row}:${numericCols.join(',')}`,
            `款式候選「${candidate.value}」${idxToCol(candidate.col)}${candidate.row + 1}附近，未能確定 ${numericCols.map(idxToCol).join('／')} 欄係尺碼定價錢（${summary}），未以呢組數字建立商品。`,
          );
          continue;
        }
      } else {
        diagnose(
          'NUMERIC_COLUMN_AMBIGUOUS',
          `numeric:${candidate.row}:${numericCols.join(',')}`,
          `款式候選「${candidate.value}」${idxToCol(candidate.col)}${candidate.row + 1}附近，未能確定 ${numericCols.map(idxToCol).join('／')} 欄係尺碼定價錢，未以呢組數字建立商品。`,
        );
        continue;
      }
    }
    priceColumnIndexes = priceColumnIndexes.filter((col) => {
      const adjacentProductName = nameCandidates.some((name) =>
        name.col === col + 1
        && name.row >= candidate.row - 1
        && name.row <= candidate.row + 3
        && !GENERIC_NOTE_TEXT.test(name.value),
      );
      if (!adjacentProductName) return true;
      const stats = numericColumnStats(g, col, firstDataRow, dataLastRow);
      const bundle = detectBundleColumn(g, col, firstDataRow, candidate.row);
      const explicitPrice = isColumnHeader(g, col, Math.max(0, candidate.row - 1), firstDataRow - 1, PRICE_HEADER_TEXT);
      const likelySize = stats.median >= 10 && stats.median <= 60
        && stats.range <= 40 && stats.integerRatio >= 0.75;
      return !likelySize || Boolean(bundle) || explicitPrice;
    });
    if (sizeCol === undefined || priceColumnIndexes.length === 0) continue;

    const chosenNames = new Map<number, { name: GenericNameCell; score: number }>();
    for (const priceCol of priceColumnIndexes) {
      const nearby = nameCandidates
        .filter((name) =>
          Math.abs(name.col - priceCol) <= 6
          && name.row < firstDataRow
          && firstDataRow - name.row <= 3
          && !hasCompetingNameBetween(name, priceCol, nameCandidates),
        )
        .map((name) => ({ name, score: scoreGenericName(g, name, priceCol, firstDataRow, nameCandidates) }))
        .sort((a, b) => b.score - a.score);
      const best = nearby[0];
      if (!best || best.score < 0) {
        diagnose(
          'NO_PRODUCT_NAME',
          `name:${firstDataRow}:${priceCol}`,
          `${idxToCol(priceCol)} 欄附近搵唔到可信款式名稱，該價錢欄未匯入。`,
        );
        continue;
      }
      const tied = nearby.filter((entry) => entry.score === best.score && entry.name.value !== best.name.value);
      if (tied.length > 0) {
        diagnose(
          'BLOCK_BOUNDARY_UNCERTAIN',
          `boundary:${firstDataRow}:${priceCol}`,
          `${idxToCol(priceCol)} 欄附近有多個同分款式名稱（${[best.name, ...tied.map((entry) => entry.name)].map((entry) => entry.value).join('、')}），未硬切區塊，該欄不作自動配對。`,
        );
        continue;
      }
      chosenNames.set(priceCol, best);
    }

    const candidateScore = [...chosenNames.values()]
      .filter((entry) => entry.name.row === candidate.row && entry.name.col === candidate.col)
      .sort((a, b) => b.score - a.score)[0];
    if (!candidateScore) continue;

    const ownedPriceCols = [...chosenNames.entries()]
      .filter(([, entry]) => entry.name.row === candidate.row && entry.name.col === candidate.col);
    if (ownedPriceCols.length === 0) continue;
    const priceCols: PriceColConfig[] = ownedPriceCols.map(([col]) => {
      const bundle = detectBundleColumn(g, col, firstDataRow, candidate.row);
      return {
        ...(bundle ?? { col: idxToCol(col), kind: 'unit' as const }),
      };
    });
    if ([sizeCol, ...priceCols.map((price) => colToIdx(price.col))]
      .some((col) => hasBlankColumnBetween(g, candidate.col, col))) {
      reviewNotes.push('款式、尺碼與價錢之間有全空欄，系統按資料列對齊；請特別核對區塊邊界。');
    }
    const uniqueDataKey = `${candidate.row}:${firstDataRow}:${sizeCol}:${priceCols.map((price) => price.col).join(',')}`;
    if (proposed.some((block) => block.id === uniqueDataKey)) continue;
    if (candidateScore.score < 3) reviewNotes.push('款式名稱辨識信心偏低，請核對商品名稱。');
    proposed.push({
      id: uniqueDataKey,
      name: candidate.value,
      row: candidate.row,
      dataFirst: firstDataRow + 1,
      dataLast: dataLastRow + 1,
      sizeCol,
      priceCols,
      reviewNotes,
    });
  }

  const usedPriceRanges = new Set<string>();
  for (const item of proposed) {
    const available = item.priceCols.filter((price) => {
      const key = `${item.dataFirst}:${item.dataLast}:${price.col}`;
      if (usedPriceRanges.has(key)) {
        diagnose(
          'BLOCK_BOUNDARY_UNCERTAIN',
          `overlap:${key}`,
          `${price.col} 欄同時被多個候選區塊使用，未重複匯入；請核對區塊邊界。`,
        );
        return false;
      }
      usedPriceRanges.add(key);
      return true;
    });
    if (available.length === 0) continue;
    const index = blocks.length + 1;
    blocks.push({
      id: `auto-${index}`,
      name: item.name,
      gender: detectGenericGender(g, item.sizeCol, available.map((price) => colToIdx(price.col))),
      dataFirst: item.dataFirst,
      dataLast: item.dataLast,
      sizeCol: idxToCol(item.sizeCol),
      priceCols: available,
      reviewNotes: item.reviewNotes,
    });
  }
  return { blocks, warnings };
}

/** 冇設定檔時嘅啟發式偵測；結果只作預覽，必須人手核對。 */
export function suggestBlocks(g: SheetGrid): BlockConfig[] {
  return detectGenericBlocks(g).blocks;
}

/* ================= 每年格價：新舊價錢 diff（R22） ================= */

export interface PriceChange {
  school: string; item: string; size: string | null;
  oldPrice: number; newPrice: number; delta: number;
}
export interface PriceDiff {
  changed: PriceChange[];   // 加價/減價
  added: { school: string; item: string; size: string | null; price: number }[];
  removed: { school: string; item: string; size: string | null; price: number }[];
  unchanged: number;
  /** 摘要：加價幾多款、減價幾多款、新增幾多、停產幾多 */
  summary: string;
}

/** 每年更新價錢用：舊分析（或 DB 現價）vs 新檔分析，列出變動 */
export function diffPrices(
  oldItems: { school: string; item: string; size: string | null; unitPrice: number }[],
  newItems: { school: string; item: string; size: string | null; unitPrice: number }[],
): PriceDiff {
  const key = (o: { school: string; item: string; size: string | null }) =>
    `${o.school}|${o.item}|${o.size ?? ''}`;
  const oldMap = new Map(oldItems.map((o) => [key(o), o]));
  const newMap = new Map(newItems.map((o) => [key(o), o]));
  const changed: PriceChange[] = [];
  const added: PriceDiff['added'] = [];
  const removed: PriceDiff['removed'] = [];
  let unchanged = 0;
  for (const [k, n] of newMap) {
    const o = oldMap.get(k);
    if (!o) { added.push({ school: n.school, item: n.item, size: n.size, price: n.unitPrice }); continue; }
    if (Math.abs(o.unitPrice - n.unitPrice) > 0.01) {
      changed.push({
        school: n.school, item: n.item, size: n.size,
        oldPrice: o.unitPrice, newPrice: n.unitPrice, delta: n.unitPrice - o.unitPrice,
      });
    } else unchanged++;
  }
  for (const [k, o] of oldMap) {
    if (!newMap.has(k)) removed.push({ school: o.school, item: o.item, size: o.size, price: o.unitPrice });
  }
  const up = changed.filter((c) => c.delta > 0).length;
  const down = changed.filter((c) => c.delta < 0).length;
  return {
    changed, added, removed, unchanged,
    summary: `加價 ${up} 款、減價 ${down} 款、新增 ${added.length} 款、停產 ${removed.length} 款、不變 ${unchanged} 款`,
  };
}
