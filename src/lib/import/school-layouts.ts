/**
 * school-layouts.ts
 * ----------------------------------------
 * 已驗證嘅學校版面設定。analyzer 靠呢啲設定先識得精準解析。
 * 新學校／新學年：複製一份，改 sheet 名同 block 行列，
 * 用隨附嘅標準 CSV 做驗收（見 INTEGRATION.md）。
 */

import type { SheetLayoutConfig } from './uniform-import-analyzer';

/** 恤衫類裁碼大碼清單（用戶提供，兩間學校通用） */
export const SHIRT_CUSTOM_SIZES = ['16.5', '17', '17.5', '18', '18.5', '19', '19.5', '20', '21', '22'];
/** 小學恤衫裁碼（推斷：標準最大 12.5，0.5 一級向上；2026-10-06 用戶確認小學都要展開） */
export const PRIMARY_SHIRT_CUSTOM_SIZES = ['13', '13.5', '14', '14.5', '15', '15.5', '16'];
/** 恤衫類細碼（推斷，用戶可刪減） */
export const SHIRT_BELOW_MIN = ['10', '10.5', '11', '11.5'];

/* ================= 港青基信書院・冬 2026 ================= */

const YMCA_WINTER_2026: SheetLayoutConfig = {
  sheet: '冬 2026',
  school: '港青基信書院',
  season: '冬',
  ignoreCells: ['D2', 'P2', 'I3', 'I15', 'K15', 'I16', 'K16', 'I17', 'K17'],
  blocks: [
    // ---------- 男區 ----------
    {
      id: 'm-suit', gender: '男', name: '深炭灰色西裝褸配厚抓毛背心',
      dataFirst: 4, dataLast: 11, sizeCol: 'A',
      priceCols: [{ col: 'B', kind: 'unit', belowMinSizes: ['36', '38'] }],
    },
    {
      id: 'm-shirt', gender: '男', name: '白色長袖恤衫', note: '連章已包，唔洗加錢',
      dataFirst: 5, dataLast: 14, sizeCol: 'D',
      priceCols: [
        { col: 'E', kind: 'unit', customSizes: SHIRT_CUSTOM_SIZES, customNote: '裁碼展開（用戶提供清單）', customNoteAppend: true, belowMinSizes: SHIRT_BELOW_MIN },
        { col: 'F', kind: 'bundle', bundleQty: 2, bundleUnit: '件' },
        { col: 'G', kind: 'bundle', bundleQty: 3, bundleUnit: '件' },
      ],
    },
    {
      id: 'm-trousers', gender: '男', name: '深炭灰色長西褲',
      dataFirst: 5, dataLast: 13, sizeCol: 'I',
      priceCols: [
        { col: 'J', kind: 'unit' },
        { col: 'K', kind: 'bundle', bundleQty: 2, bundleUnit: '條' },
      ],
      secondDim: {
        label: '褲長',
        values: [
          { label: '34-38.5寸', plus: 0, note: '標準長度' },
          { label: '40寸', plus: 10, note: '另加$10已含' },
          { label: '41.5寸', plus: 20, note: '另加$20已含' },
          { label: '43寸或以上', plus: 30, note: '另加$30已含' },
        ],
        belowMinFirstDim: ['21', '22'],
        tailorNote: '度身訂做，長度加錢另計（待確認）',
        bundleNote: '2條價按每條加錢計',
        sizeTemplate: (w, l) => `腰${w}／${l}`,
      },
    },
    {
      id: 'm-tie', gender: '男', name: '男生領呔', nameCells: ['A14'],
      note: '原格附帶數字44，用戶確認售價$38',
      dataFirst: 14, dataLast: 14, sizeCol: null,
      priceCols: [{ col: 'B', kind: 'unit' }],
    },
    {
      id: 'm-socks', gender: '男', name: '男生藍色襪', nameCells: ['A15'],
      dataFirst: 15, dataLast: 15, sizeCol: null,
      priceCols: [{ col: 'B', kind: 'unit' }],
    },
    {
      id: 'm-undershirt', gender: '男', name: '底衫',
      dataFirst: 17, dataLast: 18, sizeCol: 'D',
      priceCols: [
        { col: 'E', kind: 'unit', belowMinSizes: ['14', '15'] },
        { col: 'F', kind: 'bundle', bundleQty: 2, bundleUnit: '件' },
      ],
    },
    {
      id: 'm-overcoat', gender: '男', name: '黑色長大衣連帽（配活動可拆厚棉背心）',
      dataFirst: 21, dataLast: 29, sizeCol: 'A',
      priceCols: [{ col: 'B', kind: 'unit', belowMinSizes: ['6'] }],
    },
    {
      id: 'm-vest', gender: '男',
      dataFirst: 21, dataLast: 27, sizeCol: 'D',
      priceCols: [
        { col: 'E', kind: 'unit', label: 'V領背心冷衫', belowMinSizes: ['32'] },
        { col: 'F', kind: 'unit', label: 'V領長袖毛衣', belowMinSizes: ['32'] },
      ],
    },
    {
      id: 'm-tracksuit', gender: '男',
      dataFirst: 21, dataLast: 25, sizeCol: 'I',
      priceCols: [
        { col: 'J', kind: 'unit', label: '運動套裝（外套及長褲）', belowMinSizes: ['32'] },
        { col: 'K', kind: 'unit', label: '運動套裝（單件：外套／長褲）', belowMinSizes: ['32'] },
      ],
      setCheck: { setLabel: '運動套裝（外套及長褲）', singleLabel: '運動套裝（單件：外套／長褲）', ratio: 2 },
    },
    {
      id: 'm-sportspants', gender: '男', name: '運動短褲',
      dataFirst: 29, dataLast: 35, sizeCol: 'I',
      priceCols: [
        { col: 'J', kind: 'unit' },
        { col: 'K', kind: 'bundle', bundleQty: 2, bundleUnit: '條' },
      ],
    },
    {
      id: 'm-teeshirt', gender: '男', name: '小企領短袖運動衣（四社色）',
      dataFirst: 30, dataLast: 35, sizeCol: 'E',
      priceCols: [
        { col: 'F', kind: 'unit', belowMinSizes: ['30'] },
        { col: 'G', kind: 'bundle', bundleQty: 2, bundleUnit: '件' },
      ],
    },
    // ---------- 女區 ----------
    {
      id: 'f-suit', gender: '女', name: '深炭灰色西裝褸配厚抓毛背心',
      dataFirst: 5, dataLast: 12, sizeCol: 'M',
      priceCols: [{ col: 'N', kind: 'unit', belowMinSizes: ['28', '30'] }],
    },
    {
      id: 'f-shirt', gender: '女', name: '白色長袖恤衫', note: '連章已包，唔洗加錢',
      dataFirst: 5, dataLast: 13, sizeCol: 'P',
      priceCols: [
        { col: 'Q', kind: 'unit', customSizes: SHIRT_CUSTOM_SIZES, customNote: '裁碼展開（用戶提供清單）', customNoteAppend: true, belowMinSizes: SHIRT_BELOW_MIN },
        { col: 'R', kind: 'bundle', bundleQty: 2, bundleUnit: '件' },
        { col: 'S', kind: 'bundle', bundleQty: 3, bundleUnit: '件' },
      ],
    },
    {
      id: 'f-skirt', gender: '女', name: '深炭灰色半截校裙',
      dataFirst: 5, dataLast: 10, sizeCol: 'U',
      priceCols: [
        { col: 'V', kind: 'unit', belowMinSizes: ['20', '21'] },
        { col: 'W', kind: 'bundle', bundleQty: 2, bundleUnit: '條' },
      ],
    },
    {
      id: 'f-tie', gender: '女', name: '女生校呔', nameCells: ['M15'],
      dataFirst: 15, dataLast: 15, sizeCol: null,
      priceCols: [{ col: 'N', kind: 'unit' }],
    },
    {
      id: 'f-socks', gender: '女', name: '女生灰色襪', nameCells: ['P15'],
      dataFirst: 15, dataLast: 15, sizeCol: null,
      priceCols: [{ col: 'Q', kind: 'unit' }],
    },
    {
      id: 'f-undershirt', gender: '女', name: '底衫',
      dataFirst: 14, dataLast: 15, sizeCol: 'U',
      priceCols: [
        { col: 'V', kind: 'unit', belowMinSizes: ['14', '15'] },
        { col: 'W', kind: 'bundle', bundleQty: 2, bundleUnit: '件' },
      ],
    },
    {
      id: 'f-overcoat', gender: '女', name: '黑色長大衣連帽（配活動可拆厚棉背心）',
      dataFirst: 18, dataLast: 26, sizeCol: 'M',
      priceCols: [{ col: 'N', kind: 'unit', belowMinSizes: ['6'] }],
    },
    {
      id: 'f-vest', gender: '女',
      dataFirst: 18, dataLast: 24, sizeCol: 'P',
      priceCols: [
        { col: 'Q', kind: 'unit', label: 'V領背心冷衫', belowMinSizes: ['32'] },
        { col: 'R', kind: 'unit', label: 'V領長袖毛衣', belowMinSizes: ['32'] },
      ],
    },
    {
      id: 'f-tracksuit', gender: '女',
      dataFirst: 18, dataLast: 22, sizeCol: 'U',
      priceCols: [
        { col: 'V', kind: 'unit', label: '運動套裝（外套及長褲）', belowMinSizes: ['32'] },
        { col: 'W', kind: 'unit', label: '運動套裝（單件：外套／長褲）', belowMinSizes: ['32'] },
      ],
      setCheck: { setLabel: '運動套裝（外套及長褲）', singleLabel: '運動套裝（單件：外套／長褲）', ratio: 2 },
    },
    {
      id: 'f-sportspants', gender: '女', name: '運動短褲',
      dataFirst: 26, dataLast: 32, sizeCol: 'U',
      priceCols: [
        { col: 'V', kind: 'unit' },
        { col: 'W', kind: 'bundle', bundleQty: 2, bundleUnit: '條' },
      ],
    },
    {
      id: 'f-teeshirt', gender: '女', name: '小企領短袖運動衣（四社色）',
      dataFirst: 27, dataLast: 32, sizeCol: 'Q',
      priceCols: [
        { col: 'R', kind: 'unit', belowMinSizes: ['30'] },
        { col: 'S', kind: 'bundle', bundleQty: 2, bundleUnit: '件' },
      ],
    },
  ],
};

/* ================= 聖安多尼學校・冬 2026 ================= */

const ANTHONY_WINTER_2026: SheetLayoutConfig = {
  sheet: '冬 2026',
  school: '聖安多尼學校',
  season: '冬',
  ignoreCells: [],
  blocks: [
    {
      id: 'skirt', name: '灰裙',
      dataFirst: 5, dataLast: 12, sizeCol: 'A',
      priceCols: [
        { col: 'B', kind: 'unit', belowMinSizes: ['26'] },
        { col: 'C', kind: 'bundle', bundleQty: 2, bundleUnit: '條' },
      ],
    },
    {
      id: 'shirt', name: '白長恤', note: '連章$4（字面似另加$4，待確認；港青基信嘅連章係包咗）',
      dataFirst: 5, dataLast: 12, sizeCol: 'E',
      priceCols: [
        { col: 'F', kind: 'unit', customSizes: SHIRT_CUSTOM_SIZES, customNote: '套用恤衫裁碼清單（推斷）；15.5/16暫缺；連章$4待確認', belowMinSizes: SHIRT_BELOW_MIN },
        { col: 'G', kind: 'bundle', bundleQty: 2, bundleUnit: '件' },
      ],
    },
    {
      id: 'trousers', name: '長西褲（灰）',
      dataFirst: 5, dataLast: 12, sizeCol: 'I',
      priceCols: [
        { col: 'J', kind: 'unit', belowMinSizes: ['22'] },
        { col: 'K', kind: 'bundle', bundleQty: 2, bundleUnit: '條' },
      ],
    },
    {
      id: 'jacket', name: '棉褸+長袖抓毛',
      dataFirst: 15, dataLast: 20, sizeCol: 'A',
      priceCols: [{ col: 'B', kind: 'unit', belowMinSizes: ['8'] }],
    },
    {
      id: 'accessories', nameCol: 'E', // 校呔 / 黑膠帶 / 女白長襪（無尺碼）
      dataFirst: 14, dataLast: 16, sizeCol: null,
      priceCols: [{ col: 'F', kind: 'unit' }],
    },
    {
      id: 'undershirt', name: '底衫',
      dataFirst: 19, dataLast: 21, sizeCol: 'E', // E19/E20 係日期格式（R1 陷阱）
      priceCols: [
        { col: 'F', kind: 'unit' },
        { col: 'G', kind: 'bundle', bundleQty: 2, bundleUnit: '件' }, // 有折扣 → BUNDLE_MISMATCH
      ],
    },
    {
      id: 'cardigan', name: '3/7 啡開胸長袖',
      dataFirst: 15, dataLast: 21, sizeCol: 'J',
      priceCols: [{ col: 'K', kind: 'unit', belowMinSizes: ['4'] }],
    },
    {
      id: 'sweatshirt', name: '衛衣',
      dataFirst: 23, dataLast: 30, sizeCol: 'A',
      priceCols: [
        { col: 'B', kind: 'unit', belowMinSizes: ['28'] },
        { col: 'C', kind: 'bundle', bundleQty: 2, bundleUnit: '件' },
      ],
    },
    {
      id: 'socks', name: '白短襪', // 3對/6對/12對（包裝單位，唔展開）
      dataFirst: 24, dataLast: 26, sizeCol: 'E', sizeKind: 'pack',
      priceCols: [{ col: 'F', kind: 'unit' }],
    },
    {
      id: 'tracksuit', name: '冬運全套',
      dataFirst: 24, dataLast: 31, sizeCol: 'G',
      priceCols: [
        { col: 'J', kind: 'unit', label: '運動外套（冬運）' }, // J24='x' → UNAVAILABLE
        { col: 'K', kind: 'unit', label: '運動長褲（冬運）', belowMinSizes: ['22'] },
        { col: 'I', kind: 'setTotal' }, // I = J + K，全套價
      ],
    },
  ],
};


/** =====================================================================
 * 英皇書院同學會小學・冬2026（Sheet1）
 * 通告：英皇書院同學會小學第二校 2026年8月 冬季價目表（已交叉驗證）
 * 新 pattern：
 *  R18：一格多值（換行分隔），如 G19「24\n26\n28\n30\n32\n裁碼」
 *  R19：尺碼唔喺自己欄（單衫/單褲去 G19 攞），sizeListCell
 * 注意：頸巾 通告$21 vs Excel$22（用 Excel $22，已標註）
 *       掛呔 = 校呔（同價 $19，名變體）
 * ===================================================================== */
const KINGS_WINTER_2026: SheetLayoutConfig = {
  sheet: 'Sheet1',
  school: '英皇書院同學會小學',
  season: '冬',
  ignoreCells: ['G2', 'I18'],   // G2「男」（冇性別分區，殘留）；I18「單衫」表頭
  nameAliases: { '掛呔': '校呔', '頸巾': '繡校名頸巾' },
  cellOverrides: { 'G13': '21' }, // 頸巾：Excel $22，通告 $21，用戶 2026-10-06 確認跟通告
  blocks: [
    // 灰裙 2條（A3:C3 表頭）
    {
      id: 'skirt', name: '炭灰色背心裙', dataFirst: 4, dataLast: 9, sizeCol: 'A',
      priceCols: [
        { col: 'B', kind: 'unit', belowMinSizes: ['22'] },
        { col: 'C', kind: 'bundle', bundleQty: 2, bundleUnit: '條' },
      ],
    },
    // 長袖恤 連章 2件（F3:H3 表頭；連章已包，通告註明）
    {
      id: 'shirt', name: '白色長袖恤衫', note: '連章已包',
      dataFirst: 4, dataLast: 9, sizeCol: 'F',
      priceCols: [
        {
          col: 'G', kind: 'unit', belowMinSizes: ['9.5', '10'],
          customSizes: PRIMARY_SHIRT_CUSTOM_SIZES, customNote: '套用小學恤衫裁碼清單（推斷）',
        },
        { col: 'H', kind: 'bundle', bundleQty: 2, bundleUnit: '件' },
      ],
    },
    // 灰長西褲 2條（J3:L3 表頭）
    {
      id: 'trousers', name: '炭灰色長西褲', dataFirst: 4, dataLast: 9, sizeCol: 'J',
      priceCols: [
        { col: 'K', kind: 'unit', belowMinSizes: ['22'] },
        { col: 'L', kind: 'bundle', bundleQty: 2, bundleUnit: '條' },
      ],
    },
    // 棉褸（A11 表頭）
    {
      id: 'overcoat', name: '二合一棉褸繡校徽', note: '連抓毛背心',
      dataFirst: 12, dataLast: 16, sizeCol: 'A',
      priceCols: [{ col: 'B', kind: 'unit', belowMinSizes: ['2'] }],
    },
    // 配件（F12:F16）
    {
      id: 'accessories', nameCol: 'F', dataFirst: 12, dataLast: 16,
      priceCols: [{ col: 'G', kind: 'unit' }],
    },
    // V背 / 長袖（K11/L11 表頭；J16 一格兩值）
    {
      id: 'knit', name: '背心冷衫／長袖冷衫', dataFirst: 12, dataLast: 16, sizeCol: 'J', multiLine: true,
      priceCols: [
        { col: 'K', kind: 'unit', label: '背心冷衫', note: '連繡章', belowMinSizes: ['2'] },
        { col: 'L', kind: 'unit', label: '長袖冷衫', note: '連繡章', belowMinSizes: ['2'] },
      ],
    },
    // 衛衣 2件（B18/D18 表頭）
    {
      id: 'sweatshirt', name: '長袖運動衛衣', note: '連印章',
      dataFirst: 19, dataLast: 24, sizeCol: 'A',
      priceCols: [
        { col: 'B', kind: 'unit', belowMinSizes: ['22'] },
        { col: 'D', kind: 'bundle', bundleQty: 2, bundleUnit: '件' },
      ],
    },
    // 冬運全套（G19/H19 一格六值；裁碼$220 = 2×$110）
    {
      id: 'sport-set', name: '運動套裝', note: '運動外套及運動長褲，連繡章',
      dataFirst: 19, dataLast: 19, sizeCol: 'G', multiLine: true,
      priceCols: [{ col: 'H', kind: 'unit', belowMinSizes: ['22'] }],
    },
    // 單衫 / 單褲（尺碼去 G19 攞；30碼：96+95=191 = 全套價 ✓）
    {
      id: 'sport-singles', name: '運動外套／長褲（單件）', dataFirst: 19, dataLast: 24, sizeListCell: 'G19',
      priceCols: [
        { col: 'J', kind: 'unit', label: '運動外套（單件）', belowMinSizes: ['22'] },
        { col: 'K', kind: 'unit', label: '運動長褲（單件）', belowMinSizes: ['22'] },
      ],
    },
  ],
};

export const SCHOOL_LAYOUTS: SheetLayoutConfig[] = [YMCA_WINTER_2026, ANTHONY_WINTER_2026, KINGS_WINTER_2026];

