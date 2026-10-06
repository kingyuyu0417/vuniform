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
  source: { sheet: string; cell: string };
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
  multiLine?: boolean;             // R18：一格多值（換行分隔），拆開對應
  sizeListCell?: string;           // R19：尺碼唔喺自己欄，去指定格攞（換行分隔）
  priceCols: PriceColConfig[];
  expandRanges?: boolean;          // R10，預設 true
  secondDim?: SecondDimConfig;     // R11 二維變體
  setCheck?: { setLabel: string; singleLabel: string; ratio: number }; // R7
  unavailableMarks?: string[];     // 預設 ['x']
}

export interface SheetLayoutConfig {
  sheet: string;
  school?: string;
  season?: string;
  blocks: BlockConfig[];
  ignoreCells?: string[];          // 已知備註格，唔當雜訊
  nameAliases?: Record<string, string>; // 內部名 → 官方名（如 掛呔 → 校呔）
  cellOverrides?: Record<string, string>; // 個別格覆寫（如通告價唔同 Excel：{ 'G13': '21' }）
}

export interface AnalyzeResult {
  school: string;
  season: string;
  items: AnalyzedItem[];
  warnings: ImportWarning[];
  stats: { sheets: number; blocks: number; items: number; warnings: number };
}

/* ================= 小工具 ================= */

const INFERRED_NOTE = '細碼推斷：跟最細碼價（待用戶刪減）';

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
  const cleaned = t.replace(/[$\s,，]/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}
const isNumericText = (t: string) =>
  t !== '' && /[0-9]/.test(t) && !isNaN(parseFloat(t.replace(/[$\s,，]/g, '')));

/** 將換行分隔嘅多值格拆開（R18） */
export function splitLines(t: string): string[] {
  return t.split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== '');
}
const LETTER_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
/** R10：範圍尺碼展開（16-18 → 16,17,18；S-XL → S,M,L,XL） */
export function expandSizeRange(raw: string): string[] | null {
  const t = raw.trim();
  let m = t.match(/^(\d+(?:\.\d+)?)\s*[-–~]\s*(\d+(?:\.\d+)?)$/);
  if (m) {
    const a = parseFloat(m[1]), b = parseFloat(m[2]);
    if (b <= a || b - a > 40) return null;
    const step = Number.isInteger(a) && Number.isInteger(b) ? 1 : 0.5;
    const out: string[] = [];
    for (let v = a; v <= b + 1e-9; v += step) out.push(String(Number(v.toFixed(2))));
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
    nRows = r2 - r1 + 1; nCols = c2 - c1 + 1;
    for (let r = 0; r < nRows; r++) {
      grid.push([]); isDate.push([]);
      for (let c = 0; c < nCols; c++) {
        const v = (json[r1 + r] && json[r1 + r][c1 + c]) ?? '';
        grid[r].push(String(v).trim());
        const cell = (ws as any)[idxToCol(c1 + c) + (r1 + r + 1)];
        isDate[r].push(!!cell && cell.t === 'd');
      }
    }
  }
  return { name, grid, isDate, nRows, nCols };
}

function cellText(g: SheetGrid, addr: string): string {
  const [r, c] = parseAddr(addr);
  return (g.grid[r] && g.grid[r][c]) ?? '';
}

function detectTitle(g: SheetGrid, knownSchools: string[] = []): { school: string; season: string } {
  let school = '', season = '';
  const titleCells = g.grid.slice(0, Math.min(3, g.nRows)).flat();
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

/* ================= 主入口 ================= */

export function analyzePriceWorkbook(
  buffer: ArrayBuffer,
  layouts: SheetLayoutConfig[] = [],
  opts: { strict?: boolean } = {},
): AnalyzeResult {
  const strict = opts.strict ?? true; // 預設：冇設定嘅 sheet 唔出 items，只 warning（寧缺勿錯）
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const items: AnalyzedItem[] = [];
  const warnings: ImportWarning[] = [];
  let school = '', season = '';
  let blockCount = 0;

  for (const sheetName of wb.SheetNames) {
    const g = sheetToGrid(sheetName, wb.Sheets[sheetName]);
    const title = detectTitle(g, [...new Set(layouts.map((layout) => layout.school).filter((name): name is string => Boolean(name)))]);
    if (title.school && !school) { school = title.school; season = title.season; }

    // 同一名嘅 sheet（如兩間學校都有「冬 2026」）要連學校一齊配對；
    // 有多個候選但學校對唔上 → 唔估，skip + warning（寧缺勿錯，唔好攞錯別校價錢）
    const detectedSchool = title.school || school;
    const cands = layouts.filter((l) => l.sheet === sheetName);
    const layout = cands.find((l) => l.school === detectedSchool)
      ?? cands.find((l) => !l.school);
    let layoutMismatch = false;
    if (!layout && cands.length > 0) {
      layoutMismatch = true;
      const configuredSchools = [...new Set(cands.map((candidate) => candidate.school).filter(Boolean))];
      const message = configuredSchools.length === 1
        ? `版面設定屬於「${configuredSchools[0]}」，但${detectedSchool ? `Excel 偵測到「${detectedSchool}」` : '無法從 Excel 標題辨識學校'}`
        : `有多個版面設定（${configuredSchools.join('、') || '未指定學校'}），但偵測到嘅學校「${detectedSchool || '（未知）'}」無法配對`;
      warnings.push({
        sheet: sheetName,
        code: 'SCHOOL_LAYOUT_MISMATCH',
        severity: 'error',
        message: `「${sheetName}」${message}，已跳過唔分析，避免套用錯誤價目版面。`,
      });
    }
    if (layoutMismatch) {
      // 已出錯誤提示，直接跳過呢個 sheet。
    } else if (layout) {
      if (layout.school && !school) school = layout.school;
      if (layout.season && !season) season = layout.season;
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
      warnings.push({
        sheet: sheetName, code: 'NO_LAYOUT_CONFIG', severity: 'warn',
        message: `搵唔到「${sheetName}」嘅版面設定，已用自動偵測，結果需人手確認`,
      });
      const guessed = suggestBlocks(g);
      blockCount += guessed.length;
      const ctx = { school, season };
      for (const b of guessed) parseBlock(g, b, ctx, items, warnings);
    } else {
      warnings.push({
        sheet: sheetName, code: 'NO_LAYOUT_CONFIG', severity: 'info',
        message: `「${sheetName}」冇版面設定，已跳過（如需分析請加設定或用人手對位）`,
      });
    }
  }
  return {
    school, season, items, warnings,
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
      rowName = alias(t);
      entries.push({ sizeRaw: '__NOSIZE__', getRaw: cellRaw, dateFlag: false, sizeCell: `${b.nameCol}${r}` });
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
      const sizeRaw = ent.sizeRaw;
      if (!sizeRaw) continue;
      if (ent.dateFlag) {
        warnings.push({
          sheet: g.name, cell: ent.sizeCell, code: 'DATE_AS_SIZE', severity: 'warn',
          message: `「${rowName}」尺碼格係日期格式，已用顯示文字「${sizeRaw}」`,
        });
      }

    // 尺碼展開（R10 / R14）
    const sizeJobs: SizeJob[] = [];
    const unitPc = b.priceCols.find((p) => p.kind === 'unit');
    if (sizeRaw !== '__NOSIZE__') {
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

    emitRowItems(g, b, r, rowName, sizeJobs, ctx, items, warnings, marks, ent.getRaw);
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
    source: { sheet: g.name, cell },
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
  for (let r = 0; r < Math.min(3, g.nRows); r++)
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

/**
 * 冇設定檔時嘅啟發式偵測。回傳建議 BlockConfig（需人手確認）。
 */
export function suggestBlocks(g: SheetGrid): BlockConfig[] {
  const blocks: BlockConfig[] = [];
  const used = new Set<string>();
  let n = 0;

  for (let r = 0; r < Math.min(45, g.nRows); r++) {
    let c = 0;
    while (c < g.nCols) {
      const t = g.grid[r][c];
      const isHeader = t && !isNumericText(t) && t.replace(/[$\s,，]/g, '').length >= 2 && !used.has(`${r},${c}`);
      if (isHeader) {
        const numCols: number[] = [];
        for (let cc = c; cc < Math.min(g.nCols, c + 6); cc++) {
          let cnt = 0;
          for (let rr = r + 1; rr < Math.min(g.nRows, r + 13); rr++)
            if (isNumericText(g.grid[rr][cc])) cnt++;
          if (cnt >= 3) numCols.push(cc);
        }
        if (numCols.length >= 1) {
          let last = r;
          for (let rr = r + 1; rr < g.nRows; rr++) {
            if (numCols.some((cc) => isNumericText(g.grid[rr][cc]))) last = rr;
            else break;
          }
          if (last > r + 1) {
            const priceCols: PriceColConfig[] = numCols.slice(1).map((cc) => {
              const h = `${g.grid[r][cc - 1] ?? ''} ${g.grid[r][cc] ?? ''} ${t}`;
              const bm = h.match(/(\d+)\s*[件條對]/);
              return {
                col: idxToCol(cc), kind: bm ? 'bundle' as const : 'unit' as const,
                bundleQty: bm ? parseInt(bm[1], 10) : undefined,
                bundleUnit: bm ? bm[0].replace(/\d+\s*/, '') : undefined,
              };
            });
            blocks.push({
              id: `auto-${++n}`, name: t,
              dataFirst: r + 2, dataLast: last + 1,
              sizeCol: idxToCol(numCols[0]), priceCols,
            });
            for (let cc = c; cc <= numCols[numCols.length - 1]; cc++) used.add(`${r},${cc}`);
            c = numCols[numCols.length - 1] + 1;
            continue;
          }
        }
      }
      c++;
    }
  }
  return blocks;
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
