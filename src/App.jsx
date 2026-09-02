import React, { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import qrcode from "qrcode-generator";
import { useLocation, useNavigate, Routes, Route } from "react-router-dom";
import { Plus, Minus, Trash2, Printer, Bluetooth, ChevronDown, ChevronUp, ChevronLeft, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, X, ShoppingCart, Settings, ClipboardList, Check, AlertCircle, QrCode, Upload, Download, School, Users, Eye, EyeOff, MapPin, GraduationCap, Search } from "lucide-react";
import { isSupabaseConfigured, isSupabaseAuthEnabled, supabase } from "./supabaseClient";
import CustomerCheckinPage from "./pages/CustomerCheckinPage";
import QueuePage from "./pages/QueuePage";
import FittingPage from "./pages/FittingPage";
import PickupPage from "./pages/PickupPage";
import CashierVerifyPage from "./pages/CashierVerifyPage";
import SchoolQRCodePage from "./pages/SchoolQRCodePage";
import GuestPortalPage from "./pages/GuestPortalPage";
import GuestQueueStatusPage from "./pages/GuestQueueStatusPage";
import StaffOrderTracking from "./pages/StaffOrderTracking";
import { queueOrderService } from "./services/queueOrderService";
import baseSchoolCatalog from "./schoolCatalog.json";
import workbookSchoolCatalog from "./workbookSchoolCatalog.json";
import workbookSchoolOutlets from "./workbookSchoolOutlets.json";
import { loadProducts, saveProducts as saveProductsToStore } from "./data/productsStore";

const DEFAULT_SCHOOL = "示範學校（可刪除）";
const DESIGNATED_SCHOOL = "香港中國婦女會馮堯敬紀念中學";
const EXTRA_SCHOOL_CATALOG = {
  "香港中國婦女會馮堯敬紀念中學": { category: "資助中學", level: "中學", region: "新界區", district: "沙田區" },
};
const EXTRA_SCHOOL_OUTLETS = {
  "香港中國婦女會馮堯敬紀念中學": "沙田分店",
};

const DEFAULT_PRODUCTS = [
  {
    id: "p1",
    school: DEFAULT_SCHOOL,
    name: "白色恤衫（短袖）",
    sizes: [
      { size: "24", price: 60 }, { size: "26", price: 60 }, { size: "28", price: 65 },
      { size: "30", price: 65 }, { size: "32", price: 70 }, { size: "34", price: 70 },
      { size: "36", price: 75 }, { size: "38", price: 80 }, { size: "40", price: 85 },
    ],
  },
  {
    id: "p2",
    school: DEFAULT_SCHOOL,
    name: "白色恤衫（長袖）",
    sizes: [
      { size: "24", price: 70 }, { size: "26", price: 70 }, { size: "28", price: 75 },
      { size: "30", price: 75 }, { size: "32", price: 80 }, { size: "34", price: 80 },
      { size: "36", price: 85 }, { size: "38", price: 90 }, { size: "40", price: 95 },
    ],
  },
  {
    id: "p3",
    school: DEFAULT_SCHOOL,
    name: "藏青色短褲",
    sizes: [
      { size: "24", price: 65 }, { size: "26", price: 65 }, { size: "28", price: 70 },
      { size: "30", price: 70 }, { size: "32", price: 75 }, { size: "34", price: 75 },
    ],
  },
  {
    id: "p4",
    school: DEFAULT_SCHOOL,
    name: "校裙",
    sizes: [
      { size: "XS", price: 90 }, { size: "S", price: 90 }, { size: "M", price: 95 },
      { size: "L", price: 100 }, { size: "XL", price: 105 },
    ],
  },
  {
    id: "p5",
    school: DEFAULT_SCHOOL,
    name: "PE運動套裝",
    sizes: [
      { size: "XS", price: 110 }, { size: "S", price: 110 }, { size: "M", price: 115 },
      { size: "L", price: 120 }, { size: "XL", price: 125 },
    ],
  },
];

const fmt = (n) => `$${Math.round(n).toLocaleString("en-HK")}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
const sizeLabel = (size) => size.length ? `${size.length}／${size.size}` : size.size;
const hasLengthOptions = (product) => product.sizes.some((size) => size.length);
const sizeDimensionLabel = (product) => {
  if (!product || !product.name) return "尺碼";
  const name = product.name || "";
  return /(褲|短褲|長褲|西褲|運動褲|裙)/.test(name) ? "腰圍" : "尺碼";
};
// 用於電子銷售單中的清晰尺碼顯示
const formatSizeForReceipt = (itemName, size, length) => {
  const isDimensioned = /(褲|短褲|長褲|西褲|運動褲|裙)/.test(itemName);
  const dimensionLabel = isDimensioned ? "腰圍" : "尺碼";
  const sizeStr = String(size || "");
  const lengthStr = String(length || "");
  
  if (lengthStr && sizeStr) {
    return `${dimensionLabel}：${lengthStr}（${sizeStr}）`;
  } else if (lengthStr) {
    return `${dimensionLabel}：${lengthStr}`;
  } else if (sizeStr) {
    return `${dimensionLabel}：${sizeStr}`;
  } else {
    return `${dimensionLabel}：-`;
  }
};
const naturalSizeSort = (first, second) => {
  const firstNumber = Number.parseFloat(first);
  const secondNumber = Number.parseFloat(second);
  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber) && firstNumber !== secondNumber) return firstNumber - secondNumber;
  return String(first).localeCompare(String(second), "zh-Hant", { numeric: true });
};
const localReceiptId = (salesLog) => {
  const prefix = `VU-${todayStr().replaceAll("-", "")}-`;
  const numbers = salesLog
    .filter((order) => order.id && order.id.startsWith(prefix))
    .map((order) => Number(order.id.slice(prefix.length)))
    .filter(Number.isInteger);
  const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
};

const buildOrderInsertPayload = (order, receiptId) => {
  const payload = {
    id: receiptId,
    school: order.school || "",
    total: Number(order.total || 0),
    item_count: Number(order.itemCount || 0),
    created_at: new Date().toISOString(),
  };

  if (order.outletName) payload.outlet_name = order.outletName;
  if (order.outletAddress) payload.outlet_address = order.outletAddress;
  if (order.outletPhone) payload.outlet_phone = order.outletPhone;
  if (order.cashierId !== undefined) payload.cashier_id = order.cashierId || null;
  if (order.cashierName) payload.cashier_name = order.cashierName;

  return payload;
};

const buildOrderItemInsertPayload = (orderId, item) => {
  const payload = {
    order_id: orderId,
    name: item.name,
    size: item.size || "",
    price: Number(item.price || 0),
    qty: Number(item.qty || 1),
  };

  if (item.length) payload.length = item.length;
  return payload;
};

const insertSalesOrderRecord = async (order, salesLog) => {
  if (!isSupabaseAuthEnabled || !supabase) {
    return { savedOrder: { ...order, id: localReceiptId(salesLog) } };
  }

  const requestedReceiptId = localReceiptId(salesLog);
  const orderPayload = buildOrderInsertPayload(order, requestedReceiptId);
  const itemPayload = (order.items || []).map((item) => buildOrderItemInsertPayload(requestedReceiptId, item));

  try {
    const { error } = await supabase.from("orders").insert(orderPayload);
    if (error) {
      const message = String(error.message || "");
      const missingColumn = /column .* does not exist|42703/i.test(message);
      if (missingColumn) {
        const fallbackPayload = Object.fromEntries(
          Object.entries(orderPayload).filter(([key]) => !["cashier_id", "cashier_name", "outlet_name", "outlet_address", "outlet_phone"].includes(key))
        );
        const { error: fallbackError } = await supabase.from("orders").insert(fallbackPayload);
        if (fallbackError) throw fallbackError;
      } else {
        throw error;
      }
    }

    const { error: itemError } = await supabase.from("order_items").insert(itemPayload);
    if (itemError) {
      const message = String(itemError.message || "");
      const missingLengthColumn = /column .*length.* does not exist|42703/i.test(message);
      if (missingLengthColumn) {
        const fallbackItems = itemPayload.map(({ length, ...item }) => item);
        const { error: fallbackItemsError } = await supabase.from("order_items").insert(fallbackItems);
        if (fallbackItemsError) throw fallbackItemsError;
      } else {
        throw itemError;
      }
    }

    return { savedOrder: { ...order, id: requestedReceiptId } };
  } catch (error) {
    if (error?.message && /row-level security policy|policy/i.test(error.message)) {
      throw new Error("Supabase public sales policy/schema 未同步，請先執行 supabase/fix-public-orders-rls.sql");
    }
    throw error;
  }
};

// 攞晒目前所有學校名（去重、排序），未有分類嘅商品歸類做「未分類」
const UNASSIGNED = "（未分類）";
let deletedSchoolsRuntime = new Set();
const schoolOf = (p) => (p.school && p.school.trim()) || UNASSIGNED;
const PRODUCT_GENDER_OVERRIDES = {
  "藍／紫色短袖恤衫": "男裝",
  "黑色短西褲": "男裝",
  "藍／紫色連身校裙": "女裝",
  "男生長西褲": "男裝",
  "女生背心校裙": "女裝",
  "男生黑色短襪（3對）": "男裝",
  "女生黑色長襪": "女裝",
};
const cleanProductName = (name) => {
  if (name === "男生黑色短襪（3對）") return name;
  const cleaned = name.replace(/（(?!冬季|夏季)[^）]*）|\((?!冬季|夏季)[^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (cleaned.length > 50) {
    const matches = [...cleaned.matchAll(/(?:男生|女生|男女生|Boy[`'’]s|Girl[`'’]s)/g)];
    if (matches.length > 1) return cleaned.slice(matches[matches.length - 1].index).trim();
  }
  return cleaned;
};
const normalizeProductSizes = (sizes = []) => sizes.map((size) => {
  if (size.length || typeof size.size !== "string") return size;
  const match = size.size.trim().match(/^([^/／]+)[/／]([^/／]+)$/);
  return match ? { ...size, size: match[1].trim(), length: match[2].trim() } : size;
});
const productIdentityParts = (school, name) => {
  const cleaned = cleanProductName(name);
  const genderMatch = cleaned.match(/^(男生|女生|男女生)\s*[-–—:：]?\s*/);
  const gender = genderMatch ? genderMatch[1] : "";
  const cleanedName = cleaned
    .replace(/^(?:男生|女生|男女生)\s*[-–—:：]?\s*/, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[／/、，,\s]/g, "")
    .trim();
  return { school, name: cleanedName, gender };
};
const productIdentityKey = (school, name) => {
  const { school: schoolName, name: productName } = productIdentityParts(school, name);
  return `${schoolName}\u0000${productName}`;
};
const compatibleProductGenders = (first, second) => !first || !second || first === second || first === "男女生" || second === "男女生";
const SCHOOL_NAME_ALIASES = {
  "保良局董玉梯紀念中學": "保良局董玉娣中學",
};
const canonicalSchoolName = (name) => SCHOOL_NAME_ALIASES[name] || name;
const displayProductName = (name) => name
  .replace(/(?:【)?(?:男生|女生|男女生)(?:】)?\s*[-–—:：]?\s*/g, "")
  .replace(/\b(?:Boy|Girl)[`'’]s\b\s*[-–—:：]?\s*/gi, "")
  .replace(/\s+/g, " ")
  .replace(/校\s+褸/g, "校褸")
  .trim();
const genderOf = (product) => {
  if (PRODUCT_GENDER_OVERRIDES[product.name]) return PRODUCT_GENDER_OVERRIDES[product.name];
  const name = product.name;
  const hasUnisexLabel = /(?:男女生|男女通用|【男女生】)/.test(name);
  const hasMaleLabel = /男生|\bBoy[`'’]s\b/i.test(name);
  const hasFemaleLabel = /女生|\bGirl[`'’]s\b/i.test(name);
  if (hasUnisexLabel || (hasMaleLabel && hasFemaleLabel)) return "男女通用";
  if (hasFemaleLabel) return "女裝";
  if (hasMaleLabel) return "男裝";
  if (name.includes("運動")) return "男女通用";
  return "男女通用";
};
const seasonOf = (product) => {
  const name = product.name.replace(/\s+/g, "");
  if (/四季|全年/.test(name)) return "四季";
  if (product.school === "中華廚藝學院") return "四季";
  if (/夏季|夏裝/.test(name)) return "夏季";
  if (/冬季|冬裝/.test(name)) return "冬季";
  if (/灰色長(?:西)?褲/.test(name)) return "夏季";
  if (/長袖|冷衫|校褸|棉褸|衛衣|外套|長褲|長西褲|頸巾/.test(name)) return "冬季";
  if (/短袖|短褲|短西褲|校裙/.test(name)) return "夏季";
  return "全年";
};
const listSchools = (products) => {
  const set = new Set([...products.map(schoolOf), ...Object.keys(workbookSchoolCatalog)].filter((school) => !deletedSchoolsRuntime.has(school)));
  return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hant"));
};

const normalizeProductState = (products) => {
  const normalizedProducts = (Array.isArray(products) ? products : []).map((product) => ({
    ...product,
    school: canonicalSchoolName(product.school),
    name: cleanProductName(product.name),
    sizes: normalizeProductSizes(product.sizes),
  }));

  return normalizedProducts.reduce((result, product) => {
    const productParts = productIdentityParts(schoolOf(product), product.name);
    const duplicate = result.find((item) => {
      const itemParts = productIdentityParts(schoolOf(item), item.name);
      return productIdentityKey(itemParts.school, item.name) === productIdentityKey(productParts.school, product.name)
        && compatibleProductGenders(itemParts.gender, productParts.gender);
    });

    if (!duplicate) {
      result.push(product);
      return result;
    }

    const sizes = [...(duplicate.sizes || [])];
    (product.sizes || []).forEach((size) => {
      const exists = sizes.some((item) => item.size === size.size && (item.length || "") === (size.length || ""));
      if (!exists) sizes.push(size);
    });
    duplicate.sizes = sizes;
    return result;
  }, []);
};

const enforceAuthoritativeProducts = (products) => {
  const normalized = normalizeProductState(products);
  const demoOnly = normalized.length > 0 && normalized.every((product) => product.id?.startsWith("p") && schoolOf(product) === DEFAULT_SCHOOL);
  if (demoOnly && normalized.length <= 5) {
    console.warn("[App] Refusing to accept demo fallback products as authoritative product data.");
    return [];
  }
  return normalized;
};

// ===================== 香港學校分類（教育階段 → 地區 → 18區） =====================
// 用嚟優化「揀學校」介面：學校太多嘅時候，一層層篩選好過成頁滾動搵
const SCHOOL_LEVELS = ["幼稚園", "小學", "中學", "其他"];

const HK_REGIONS = ["港島區", "九龍區", "新界區"];

// 香港18區，按三大地區分組
const HK_DISTRICTS = {
  "港島區": ["中西區", "灣仔區", "東區", "南區"],
  "九龍區": ["油尖旺區", "深水埗區", "九龍城區", "黃大仙區", "觀塘區"],
  "新界區": ["葵青區", "荃灣區", "屯門區", "元朗區", "北區", "大埔區", "沙田區", "西貢區", "離島區"],
};

const OUTLETS = [
  { name: "上環分店", address: "上環文咸東街79-85號文咸中心8樓全層（近上環港鐵站A2出口）", phone: "2815 2673", region: "港島區", districts: ["中西區"] },
  { name: "炮台山分店", address: "炮台山屈臣道4-6號海景大廈B座14樓1403B室（近炮台山港鐵站A出口）", phone: "2802 6887", region: "港島區", districts: ["東區", "灣仔區"] },
  { name: "太子分店", address: "太子長沙灣道恒滿樓38號地舖（近太子港鐵站A／D／E出口）", phone: "3188 9762", region: "九龍區", districts: ["油尖旺區", "深水埗區"] },
  { name: "彩虹分店", address: "九龍彩虹邨青楊路金碧樓32號地舖（近彩虹港鐵站C4出口）", phone: "2321 1733", region: "九龍區", districts: ["黃大仙區", "觀塘區"] },
  { name: "九龍城分店", address: "九龍城城南道3號地舖（近宋皇臺港鐵站B2／B3出口）", phone: "2382 2407", region: "九龍區", districts: ["九龍城區"] },
  { name: "荃灣分店", address: "荃灣福來邨海壩街永嘉樓9號地舖（近荃灣港鐵站A出口）", phone: "2437 9997", region: "新界區", districts: ["荃灣區"] },
  { name: "大埔分店", address: "大埔大元邨泰榮樓3號地舖（近大埔廣場對面）", phone: "2662 3819", region: "新界區", districts: ["大埔區"] },
  { name: "元朗分店", address: "元朗媽橫路51-53號褔順樓6號地舖（近西鐵朗屏站B2出口）", phone: "2321 9282", region: "新界區", districts: ["元朗區"] },
  { name: "屯門（蝴蝶）分店", address: "屯門湖翠路1號蝴蝶邨蝴蝶廣場R165號地舖", phone: "2404 0177", region: "新界區", districts: ["屯門區"] },
  { name: "屯門（鳴琴）分店", address: "屯門建群街3號永發工業大廈4樓B室（近輕鐵鳴琴站／建安站）", phone: "3691 9897", region: "新界區", districts: ["屯門區"] },
  { name: "沙田分店", address: "沙田石門安群街3號京瑞廣場一期5樓A室（近屯馬線石門站C出口）", phone: "2637 3313", region: "新界區", districts: ["沙田區", "北區", "西貢區", "葵青區", "離島區"] },
];

const outletForSchool = (school, schoolMeta = {}) => {
  const meta = metaOf(schoolMeta, school);
  const candidates = OUTLETS.filter((outlet) => outlet.districts.includes(meta.district));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1 && school.includes("屯門")) return candidates[0];
  return candidates[0] || OUTLETS.find((outlet) => outlet.region === meta.region) || null;
};
const outletNameForSchool = (school, schoolMeta = {}) => schoolMeta[school]?.outletName || workbookSchoolOutlets[school] || EXTRA_SCHOOL_OUTLETS[school] || outletForSchool(school, schoolMeta)?.name || "未指定門店";

const UNCLASSIFIED = "未分類";
const schoolCatalog = { ...baseSchoolCatalog, ...workbookSchoolCatalog, ...EXTRA_SCHOOL_CATALOG };
const SCHOOL_CATEGORIES = Array.from(new Set(Object.values(schoolCatalog).map((entry) => entry.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hant"));

// 學校分類資料表：{ 學校名稱: { level, region, district } }
// 冇分類嘅學校（例如舊資料、CSV匯入未指定）一律歸入「未分類」，唔會令佢消失
const metaOf = (schoolMeta, name) => ({ ...(schoolCatalog[name] || {}), ...(schoolMeta[name] || {}) });

// 將學校名單按 階段 → 地區 → 18區 分組成樹狀結構，方便逐層渲染
const groupSchoolsByCategory = (schools, schoolMeta) => {
  const tree = {}; // level -> region -> district -> [school names]
  schools.forEach((sc) => {
    const m = metaOf(schoolMeta, sc);
    const level = m.level || UNCLASSIFIED;
    const region = m.region || UNCLASSIFIED;
    const district = m.district || UNCLASSIFIED;
    tree[level] = tree[level] || {};
    tree[level][region] = tree[level][region] || {};
    tree[level][region][district] = tree[level][region][district] || [];
    tree[level][region][district].push(sc);
  });
  return tree;
};

// 將商品陣列（多間學校）攤平做CSV：一行 = 一個碼數
const productsToCSV = (products) => {
  const rows = [["學校", "款式名稱", "長度", "尺碼", "價錢"]];
  products.forEach((p) => {
    p.sizes.forEach((s) => {
      rows.push([schoolOf(p), p.name, s.length || "", s.size, s.price]);
    });
  });
  return Papa.unparse(rows);
};

const downloadCSV = (csvText, filename) => {
  const blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8;" }); // 加BOM，Excel開中文唔亂碼
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 將CSV文字解析並「合併」入現有商品清單：
// 相同「學校+款式名稱」歸做同一件商品；相同「學校+款式名稱+碼數」就更新價錢，冇就新增碼數
const mergeCSVIntoProducts = (csvText, existingProducts) => {
  const parsed = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true });
  const errors = [];
  if (parsed.errors && parsed.errors.length) {
    parsed.errors.forEach((e) => errors.push(`第${e.row + 2}行：${e.message}`));
  }
  const next = existingProducts.map((p) => ({ ...p, sizes: p.sizes.map((s) => ({ ...s })) }));
  let addedProducts = 0;
  let addedSizes = 0;
  let updatedSizes = 0;

  parsed.data.forEach((row, idx) => {
    const school = (row["學校"] || "").trim();
    const name = (row["款式名稱"] || "").trim();
    const size = (row["尺碼"] || row["腰圍"] || row["碼數"] || "").toString().trim();
    const length = (row["長度"] || row["褲長"] || row["裙長"] || "").toString().trim();
    const price = Number(row["價錢"]);
    if (!name || !size) return; // 缺款式名或碼數嘅行略過
    if (Number.isNaN(price)) {
      errors.push(`第${idx + 2}行：「${name}」價錢「${row["價錢"]}」唔係有效數字，已略過`);
      return;
    }
    const schoolKey = school || UNASSIGNED;
    let product = next.find((p) => schoolOf(p) === schoolKey && p.name === name);
    if (!product) {
      product = { id: uid(), school: schoolKey === UNASSIGNED ? "" : schoolKey, name, sizes: [] };
      next.push(product);
      addedProducts++;
    }
    const sizeEntry = product.sizes.find((s) => s.size === size && (s.length || "") === length);
    if (sizeEntry) {
      if (sizeEntry.price !== price) updatedSizes++;
      sizeEntry.price = price;
    } else {
      product.sizes.push({ size, length, price });
      addedSizes++;
    }
  });

  return { next, summary: { addedProducts, addedSizes, updatedSizes }, errors };
};

const BT_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
const BT_CHAR = "00002af1-0000-1000-8000-00805f9b34fb";

// ===================== 員工權限 =====================
// 四種角色：admin（全權限）、manager（店長/當日負責人）、staff（店員）、guest（客人登記）
const ROLES = { ADMIN: "admin", MANAGER: "manager", STAFF: "staff", GUEST: "guest" };
const ROLE_LABEL = { admin: "管理員 ADMIN", manager: "店長／當日負責人", staff: "店員", guest: "客人" };

// 每個角色嘅權限表：邊啲分頁見到、邊啲操作准許
const PERMISSIONS = {
  [ROLES.ADMIN]: {
    tabs: ["sale", "products", "records", "staff", "qrcode", "track"],
    canEditProducts: true, // 改價/改碼數
    canManageSchools: true, // 新增/刪除學校、款式
    canImportExport: true, // CSV 匯入匯出
    canViewAllDates: true, // 記錄可以睇晒所有日期
    canExportSales: true,
  },
  [ROLES.MANAGER]: {
    tabs: ["sale", "products", "records"],
    canEditProducts: true,
    canManageSchools: false,
    canImportExport: false,
    canViewAllDates: false, // 只可以睇「當日／即時」
    canExportSales: false,
  },
  [ROLES.STAFF]: {
    tabs: ["sale"],
    canEditProducts: false,
    canManageSchools: false,
    canImportExport: false,
    canViewAllDates: false,
    canExportSales: false,
  },
  [ROLES.GUEST]: {
    tabs: ["guest"],
    canEditProducts: false,
    canManageSchools: false,
    canImportExport: false,
    canViewAllDates: false,
    canExportSales: false,
  },
};

// 預設帳號（首次使用；ADMIN可以之後喺「員工」分頁改晒佢哋）
const DEFAULT_ACCOUNTS = [
  { id: "acc-admin", name: "管理員", role: ROLES.ADMIN, pin: "0000" },
  { id: "acc-mgr", name: "店長", role: ROLES.MANAGER, pin: "1111" },
  { id: "acc-staff1", name: "店員A", role: ROLES.STAFF, pin: "2222" },
  { id: "acc-staff2", name: "店員B", role: ROLES.STAFF, pin: "3333" },
];

// 每張單獨立嘅收據文字（用嚟印藍牙收據，亦係 QR code 嘅內容）
// 加入學校名、單號短碼、負責開單員工，令收據睇落更似正式商業收據
const buildReceiptLines = (order, shopName) => {
  const lines = [];
  lines.push("Victoria Uniform 校服銷售");
  lines.push("電子銷售單 ELECTRONIC RECEIPT");
  lines.push("================================");
  lines.push(`收據編號：#${(order.id || "").toUpperCase()}`);
  lines.push(`交易日期：${order.date || "-"} ${order.time || ""}`);
  lines.push(`學校：${order.school || shopName || "-"}`);
  if (order.outletName) {
    lines.push(`最近門店：${order.outletName}`);
    lines.push(`門店地址：${order.outletAddress}`);
    lines.push(`門店電話：${order.outletPhone}`);
  }
  if (order.cashierName) lines.push(`服務員：${order.cashierName}`);
  lines.push("--------------------------------");
  lines.push("商品明細");
  order.items.forEach((it) => {
    lines.push(`${it.name}`);
    lines.push(`  ${formatSizeForReceipt(it.name, it.size, it.length)}`);
    lines.push(`  數量 ${it.qty} x ${fmt(it.price)} = ${fmt(it.price * it.qty)}`);
  });
  lines.push("--------------------------------");
  lines.push(`商品件數：${order.itemCount || 0}`);
  lines.push(`應付總額：${fmt(order.total)}`);
  if (typeof order.cashReceived === "number") lines.push(`實收現金：${fmt(order.cashReceived)}`);
  if (typeof order.changeDue === "number") lines.push(`找續：${fmt(order.changeDue)}`);
  lines.push("交易狀態：已完成");
  lines.push("--------------------------------");
  lines.push("多謝惠顧，歡迎重臨");
  lines.push("此 QR Code 內容為本單電子收據");
  return lines;
};

const buildReceiptUrl = (order) => {
  const json = JSON.stringify(order);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const encoded = btoa(binary);
  const publicUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, "");
  return `${publicUrl}/receipt.html?data=${encodeURIComponent(encoded)}`;
};

// ===================== 儲存層 =====================
// 有 Supabase 設定時使用雲端；未設定時保留 localStorage，方便本機試用。
if (!window.storage) {
  const localStorageKey = (key, shared = false) => (shared ? `shared:${key}` : key);

  window.storage = {
    get: async (key, shared = false) => {
      const localKey = localStorageKey(key, shared);
      if (shared && isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("app_storage")
            .select("value")
            .eq("key", key)
            .maybeSingle();
          if (error) throw error;
          if (data?.value !== undefined) return { value: data.value };
        } catch (error) {
          console.warn(`cloud storage read failed for ${key}, falling back to localStorage`, error);
        }
      }
      const value = localStorage.getItem(localKey);
      return value ? { value } : null;
    },
    set: async (key, value, shared = false) => {
      const localKey = localStorageKey(key, shared);
      if (shared && isSupabaseConfigured) {
        try {
          const { error } = await supabase.from("app_storage").upsert({
            key,
            value,
            updated_at: new Date().toISOString(),
          });
          if (!error) {
            localStorage.setItem(localKey, value);
            return true;
          }
          throw error;
        } catch (error) {
          console.warn(`cloud storage write failed for ${key}, saved to localStorage instead`, error);
        }
      }
      localStorage.setItem(localKey, value);
      return true;
    },
    delete: async (key, shared = false) => {
      const localKey = localStorageKey(key, shared);
      if (shared && isSupabaseConfigured) {
        try {
          const { error } = await supabase.from("app_storage").delete().eq("key", key);
          if (!error) {
            localStorage.removeItem(localKey);
            return true;
          }
          throw error;
        } catch (error) {
          console.warn(`cloud storage delete failed for ${key}, cleaned localStorage instead`, error);
        }
      }
      localStorage.removeItem(localKey);
      return true;
    },
  };
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App error boundary caught a runtime error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f8fafc",
          color: "#1f2937",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
          <div style={{
            maxWidth: 520,
            width: "100%",
            background: "#fff",
            border: "1px solid #fecaca",
            borderRadius: 18,
            boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
            padding: 28,
            display: "grid",
            gap: 12,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#7f1d1d" }}>頁面發生異常</div>
            <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
              目前頁面無法正常載入，系統已自動切換到安全提示頁。請重新整理，若問題持續請檢查資料來源與網絡連線。
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                border: "none",
                background: "#b91c1c",
                color: "#fff",
                borderRadius: 10,
                padding: "11px 16px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              重新整理
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function UniformPOS() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loaded, setLoaded] = useState(false); // 啟用正確的初始化以從 Supabase 加載產品
  const [products, setProducts] = useState(() => enforceAuthoritativeProducts(DEFAULT_PRODUCTS));
  const [deletedSchools, setDeletedSchools] = useState([]);
  const [salesLog, setSalesLog] = useState([]);
  const [tab, setTab] = useState("sale");
  const [queueVisits, setQueueVisits] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [pickupTickets, setPickupTickets] = useState([]);
  const [paymentOrders, setPaymentOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [cashReceived, setCashReceived] = useState("");
  const [btStatus, setBtStatus] = useState({ state: "idle", msg: "" });
  const printAreaRef = useRef(null);

  const [importResult, setImportResult] = useState(null); // { summary, errors } | null
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [productsSaveError, setProductsSaveError] = useState("");
  const [productsSaveState, setProductsSaveState] = useState("saved");
  const [sourceIntegrityWarning, setSourceIntegrityWarning] = useState("");
  const productsSaveTimerRef = useRef(null);
  const productsPersistQueueRef = useRef(Promise.resolve());
  const productsSavePendingRef = useRef(false);
  const productsRef = useRef(products);
  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  const [selectedSchool, setSelectedSchool] = useState(DESIGNATED_SCHOOL);
  const [schoolPanelOpen, setSchoolPanelOpen] = useState(false);
  const schools = listSchools(products);

  // 學校分類資料（階段/地區/18區），共用儲存，全部裝置見到同一份
  const [schoolMeta, setSchoolMeta] = useState({});
  const saveSchoolMeta = async (next) => {
    setSchoolMeta(next);
    try {
      await window.storage.set("school-meta", JSON.stringify(next), true);
    } catch (e) {
      console.error("儲存學校分類失敗", e);
    }
  };

  // 員工帳號（共用，ADMIN可管理）同目前呢部裝置嘅登入狀態（個人，唔跨裝置）
  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS);
  const [session, setSession] = useState(null); // { id, name, role } | null
  const [authReady, setAuthReady] = useState(true); // Always ready for offline mode
  const [passwordSetupRequired, setPasswordSetupRequired] = useState(false);
  const perms = session ? PERMISSIONS[session.role] : null;

  const isPasswordSetupLink = () => /(?:^|&)type=(?:invite|recovery)(?:&|$)/.test(window.location.hash.slice(1));

  useEffect(() => {
    if (!isSupabaseAuthEnabled || !supabase) return undefined;
    let active = true;
    const loadAuthSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (isPasswordSetupLink() && data.session && active) {
          setPasswordSetupRequired(true);
          return;
        }
        if (data.session && active) {
          const { data: profile } = await supabase
            .from("staff_profiles")
            .select("id, display_name, role")
            .eq("id", data.session.user.id)
            .maybeSingle();
          if (profile) setSession({ id: profile.id, name: profile.display_name, role: profile.role });
        }
      } catch (e) {
        console.error("讀取驗證登入狀態失敗", e);
      } finally {
        if (active) setAuthReady(true);
      }
    };
    loadAuthSession();
    // 超時防護：5秒後強制設為已就緒，防止無限等待
    const timeoutId = setTimeout(() => {
      if (active) {
        console.warn("Supabase 認證初始化超時，強制繼續");
        setAuthReady(true);
      }
    }, 5000);
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if ((event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") && isPasswordSetupLink()) {
        setPasswordSetupRequired(true);
      }
      loadAuthSession();
    });
    return () => {
      active = false;
      clearTimeout(timeoutId);
      listener.subscription.unsubscribe();
    };
  }, []);

  // 目前登入角色見唔到嘅分頁，自動跳去佢見到嘅第一個（例如店員唔應停留喺「商品」）
  useEffect(() => {
    const newTabsAlwaysAllowed = ["guest", "queue", "fitting", "pickup", "cashier"];
    if (session && !newTabsAlwaysAllowed.includes(tab) && !PERMISSIONS[session.role].tabs.includes(tab)) {
      setTab(PERMISSIONS[session.role].tabs[0]);
    }
  }, [session, tab]);

  // 讀返呢部裝置上次揀嘅學校（個人儲存，唔係共用）
  useEffect(() => {
    (async () => {
      try {
        const saved = await window.storage.get("last-school", false).catch(() => null);
        if (saved && saved.value) {
          const previousSchool = String(saved.value || "").trim();
          if (previousSchool) setSelectedSchool(previousSchool);
        }
      } catch (e) {
        console.error("讀取上次學校選擇失敗", e);
      }
    })();
  }, []);

  // 讀返呢部裝置上次登入嘅員工（個人儲存）
  useEffect(() => {
    if (isSupabaseAuthEnabled) return;
    (async () => {
      try {
        const saved = await window.storage.get("current-session", false).catch(() => null);
        if (saved && saved.value) setSession(JSON.parse(saved.value));
      } catch (e) {
        console.error("讀取登入狀態失敗", e);
      }
    })();
  }, []);

  // 檢查 URL 是否包含 school 參數，如果有則自動進入客人登記頁面
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const schoolIdFromUrl = params.get("school_id");
    const schoolFromUrl = schoolIdFromUrl || params.get("school");

    if (schoolFromUrl) {
      setSession({ id: "guest-session", name: "遊客", role: ROLES.GUEST });
      setSelectedSchool(schoolFromUrl);
      setTab("guest");
      console.log("檢測到 QR CODE 訪問，校名:", schoolFromUrl);
    }
  }, []);

  const login = (account) => {
    const s = { id: account.id, name: account.name, role: account.role };
    setSession(s);
    window.storage.set("current-session", JSON.stringify(s), false).catch((e) => console.error("記住登入狀態失敗", e));
  };

  const loginWithAuth = async (email, password) => {
    if (!supabase) return { error: "Supabase 未設定" };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "登入失敗，請檢查電郵及密碼。" };
    const { data: profile, error: profileError } = await supabase
      .from("staff_profiles")
      .select("id, display_name, role")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError || !profile) {
      await supabase.auth.signOut();
      return { error: "帳戶尚未設定員工角色，請聯絡管理員。" };
    }
    setSession({ id: profile.id, name: profile.display_name, role: profile.role });
    if (profile.role === ROLES.ADMIN) {
      const { data: migrationResult, error: migrationError } = await supabase.rpc("migrate_legacy_data");
      if (!migrationError) {
        console.info("舊資料自動遷移完成", migrationResult);
        await refreshFromCloud({ skipProductsWhileEditing: false });
      } else {
        console.error("舊資料自動遷移失敗", migrationError);
      }
    }
    return { error: "" };
  };

  const finishPasswordSetup = async (password) => {
    if (!supabase || password.length < 8) return { error: "密碼最少需要 8 個字元。" };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: "設定密碼失敗，請重新開啟邀請連結。" };
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("staff_profiles")
      .select("id, display_name, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) return { error: "找不到員工角色，請聯絡管理員。" };
    setSession({ id: profile.id, name: profile.display_name, role: profile.role });
    window.history.replaceState({}, document.title, window.location.pathname);
    setPasswordSetupRequired(false);
    return { error: "" };
  };

  const logout = () => {
    setSession(null);
    if (isSupabaseAuthEnabled && supabase) supabase.auth.signOut().catch(() => {});
    window.storage.delete("current-session", false).catch(() => {});
  };

  const manageStaff = async (payload) => {
    if (!supabase) return { error: "Supabase 未設定" };
    const { data, error } = await supabase.functions.invoke("manage-staff", { body: payload });
    let functionError = data?.error || "";
    if (!functionError && error?.context) {
      try {
        const body = await error.context.clone().json();
        functionError = body?.error || "";
      } catch {
        // The response may not contain JSON when the platform rejects the request.
      }
    }
    return { data, error: functionError || error?.message || "" };
  };

  const saveAccounts = async (next) => {
    setAccounts(next);
    try {
      await window.storage.set("staff-accounts", JSON.stringify(next), true);
    } catch (e) {
      console.error("儲存員工帳號失敗", e);
    }
  };

  useEffect(() => {
    if (!selectedSchool || !schools.includes(selectedSchool)) {
      setSelectedSchool((prev) => prev || DESIGNATED_SCHOOL);
    }
  }, [schools, selectedSchool]);

  useEffect(() => {
    if (!products.some((product) => product.id === selectedProduct)) {
      setSelectedProduct(null);
    }
  }, [products, selectedProduct]);

  const pickSchool = (sc) => {
    const nextSchool = sc || DESIGNATED_SCHOOL;
    setSelectedSchool(nextSchool);
    setSelectedProduct(null);
    setSchoolPanelOpen(false);
    window.storage.set("last-school", nextSchool, false).catch((e) => console.error("記住學校選擇失敗", e));
  };

  // 由雲端（共用儲存）攞返最新一份 products / sales-log
  const refreshFromCloud = async ({ skipProductsWhileEditing = true } = {}) => {
    setSyncing(true);
    try {
      const skipProducts = skipProductsWhileEditing && (tabRef.current === "products" || productsSavePendingRef.current);
      const [p, s, a, sm] = await Promise.all([
        skipProducts ? Promise.resolve(null) : loadProducts({
          storage: window.storage,
          supabase,
          isSupabaseAuthEnabled,
          fallbackProducts: DEFAULT_PRODUCTS,
        }),
        isSupabaseAuthEnabled ? loadSecureOrders() : window.storage.get("sales-log", true).catch(() => null),
        window.storage.get("staff-accounts", true).catch(() => null),
        window.storage.get("school-meta", true).catch(() => null),
      ]);
      if (p && !productsSavePendingRef.current) {
        const authoritative = enforceAuthoritativeProducts(p);
        setSourceIntegrityWarning(authoritative.length === 0 && p.length > 0 ? "產品資料來源不完整：目前只檢測到示範資料，已阻止當作正式產品庫。" : "");
        setProducts(authoritative);
      }
      if (s) setSalesLog(isSupabaseAuthEnabled ? s : JSON.parse(s.value));
      if (a && a.value) setAccounts(JSON.parse(a.value));
      if (sm && sm.value) setSchoolMeta(JSON.parse(sm.value));
      setLastSync(new Date());
    } catch (e) {
      console.error("同步失敗", e);
    } finally {
      setSyncing(false);
    }
  };

  const loadSecureOrders = async () => {
    if (!supabase) return [];
    let { data, error } = await supabase
      .from("orders")
      .select("id, school, outlet_name, outlet_address, outlet_phone, cashier_id, cashier_name, total, item_count, created_at, order_items(name, size, length, price, qty)")
      .order("created_at", { ascending: false });
    if (error?.code === "42703") {
      ({ data, error } = await supabase
        .from("orders")
        .select("id, school, cashier_id, cashier_name, total, item_count, created_at, order_items(name, size, price, qty)")
        .order("created_at", { ascending: false }));
    }
    if (error) throw error;
    return (data || []).map((order) => {
      const created = new Date(order.created_at);
      return {
        id: order.id,
        date: created.toISOString().slice(0, 10),
        time: created.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" }),
        items: (order.order_items || []).map((item) => ({ ...item, length: item.length || "" })),
        total: order.total,
        itemCount: order.item_count,
        cashierId: order.cashier_id,
        cashierName: order.cashier_name,
        school: order.school,
        outletName: order.outlet_name,
        outletAddress: order.outlet_address,
        outletPhone: order.outlet_phone,
      };
    });
  };

  const loadSecureProducts = async () => {
    if (!supabase) return [];
    const { data, error } = await supabase.from("products").select("id, school, name, sizes, display_order").order("display_order", { ascending: true, nullsFirst: false }).order("name");
    if (error) throw error;
    return data || [];
  };

  useEffect(() => {
    if (!authReady) return; // Only run when authReady is true
    
    (async () => {
      try {
        const deleted = await window.storage.get("deleted-schools", false).catch(() => null);
        const deletedList = deleted && deleted.value ? JSON.parse(deleted.value) : [];
        deletedSchoolsRuntime = new Set(Array.isArray(deletedList) ? deletedList : []);
        setDeletedSchools([...deletedSchoolsRuntime]);
        const p = await loadProducts({
          storage: window.storage,
          supabase,
          isSupabaseAuthEnabled,
          fallbackProducts: DEFAULT_PRODUCTS,
        });
        const s = isSupabaseAuthEnabled ? await loadSecureOrders() : await window.storage.get("sales-log", true).catch(() => null);
        const a = await window.storage.get("staff-accounts", true).catch(() => null);
        const sm = await window.storage.get("school-meta", true).catch(() => null);
        if (p) {
          const authoritative = enforceAuthoritativeProducts(p);
          setSourceIntegrityWarning(authoritative.length === 0 && p.length > 0 ? "產品資料來源不完整：目前只檢測到示範資料，已阻止當作正式產品庫。" : "");
          setProducts(authoritative);
        }
        if (s) setSalesLog(isSupabaseAuthEnabled ? s : JSON.parse(s.value));
        if (a && a.value) {
          setAccounts(JSON.parse(a.value));
        } else {
          await window.storage.set("staff-accounts", JSON.stringify(DEFAULT_ACCOUNTS), true).catch(() => {});
        }
        if (sm && sm.value) setSchoolMeta(JSON.parse(sm.value));
        setLastSync(new Date());
      } catch (e) {
        console.error("載入資料失敗", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, [authReady]);

  // 第一次加載時自動刷新以確保從 Supabase 加載產品
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loaded && products.length <= 20) {
        // 如果只有默認產品或很少的產品，嘗試從 Supabase 重新加載
        refreshFromCloud({ skipProductsWhileEditing: false });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [loaded]);

  // 每30秒自動由雲端拉一次最新資料
  useEffect(() => {
    const timer = setInterval(() => {
      refreshFromCloud();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const persistProducts = async (next, { orderOnly = false } = {}) => {
    try {
      if (isSupabaseAuthEnabled && supabase) {
        if (orderOnly) {
          const results = await Promise.all(next.map((product, index) =>
            supabase.from("products").update({ display_order: index }).eq("id", product.id)
          ));
          const orderError = results.find(({ error }) => error)?.error;
          if (orderError) throw orderError;
          return;
        }

        await saveProductsToStore({
          products: next,
          storage: window.storage,
          supabase,
          isSupabaseAuthEnabled,
        });
        return;
      }

      await window.storage.set("products", JSON.stringify(next), true);
    } catch (e) {
      console.error("儲存商品失敗", e);
      throw e;
    }
  };

  const saveProducts = (next, options = {}) => {
    productsRef.current = next;
    setProducts(next);
    setProductsSaveError("");
    setProductsSaveState("pending");
    productsSavePendingRef.current = true;
    if (productsSaveTimerRef.current) clearTimeout(productsSaveTimerRef.current);
    productsSaveTimerRef.current = setTimeout(() => {
      productsPersistQueueRef.current = productsPersistQueueRef.current
        .catch(() => {})
        .then(() => persistProducts(next, options))
        .catch((error) => {
          const detail = error?.message || error?.code || "未知錯誤";
          setProductsSaveError(`商品未能保存：${detail}`);
          setProductsSaveState("error");
          throw error;
        })
        .then(() => setProductsSaveState("saved"))
        .finally(() => { productsSavePendingRef.current = false; });
      productsSaveTimerRef.current = null;
    }, 500);
  };

  const saveProductsNow = async () => {
    if (productsSaveTimerRef.current) {
      clearTimeout(productsSaveTimerRef.current);
      productsSaveTimerRef.current = null;
    }
    const next = productsRef.current;
    productsSavePendingRef.current = true;
    setProductsSaveError("");
    setProductsSaveState("saving");
    productsPersistQueueRef.current = productsPersistQueueRef.current
      .catch(() => {})
      .then(() => persistProducts(next));
    try {
      await productsPersistQueueRef.current;
      setProductsSaveState("saved");
    } catch (error) {
      const detail = error?.message || error?.code || "未知錯誤";
      setProductsSaveError(`商品未能保存：${detail}`);
      setProductsSaveState("error");
    } finally {
      productsSavePendingRef.current = false;
    }
  };

  useEffect(() => () => {
    if (productsSaveTimerRef.current) clearTimeout(productsSaveTimerRef.current);
  }, []);

  const saveSalesLog = async (next) => {
    try {
      const order = next[0];
      let savedOrder = order;

      if (isSupabaseAuthEnabled && supabase) {
        const requestedReceiptId = localReceiptId(salesLog);
        const { data: receiptId, error } = await supabase.rpc("create_order_with_items", {
          order_data: {
            ...order,
            id: requestedReceiptId,
            cashier_id: order.cashierId,
            cashier_name: order.cashierName,
            item_count: order.itemCount,
            outlet_name: order.outletName,
            outlet_address: order.outletAddress,
            outlet_phone: order.outletPhone,
            created_at: new Date().toISOString(),
          },
        });

        if (!error) {
          savedOrder = { ...order, id: receiptId || requestedReceiptId };
        } else if (error.code === "42702" || error.code === "23505") {
          const fallbackOrder = { ...order, id: `${requestedReceiptId}-${uid()}` };
          const fallbackResult = await insertSalesOrderRecord(fallbackOrder, salesLog);
          savedOrder = fallbackResult.savedOrder;
        } else if (error.message && /row-level security policy|policy|cashier_id|column .* does not exist/i.test(error.message)) {
          const fallbackResult = await insertSalesOrderRecord(order, salesLog);
          savedOrder = fallbackResult.savedOrder;
        } else {
          throw error;
        }
      } else {
        savedOrder = { ...order, id: localReceiptId(salesLog) };
      }

      const savedLog = [savedOrder, ...salesLog];
      if (!isSupabaseAuthEnabled || !supabase) await window.storage.set("sales-log", JSON.stringify(savedLog), true);
      setSalesLog(savedLog);
      setStorageError("");
      return savedOrder;
    } catch (e) {
      console.error("儲存記錄失敗", e);
      const detail = e?.code ? `（${e.code}${e?.details ? `：${e.details}` : ""}）` : "";
      setStorageError(`交易未能儲存${detail}，請檢查網絡或聯絡管理員更新 Supabase；購物車資料仍然保留。`);
      return null;
    }
  };

  const addToCart = (product, sizeObj) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.productId === product.id && c.size === sizeObj.size && c.length === (sizeObj.length || ""));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { key: uid(), productId: product.id, name: product.name, size: sizeObj.size, length: sizeObj.length || "", price: sizeObj.price, qty: 1 }];
    });
  };

  const changeQty = (key, delta) => {
    setCart((prev) =>
      prev
        .map((c) => (c.key === key ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const removeItem = (key) => setCart((prev) => prev.filter((c) => c.key !== key));

  useEffect(() => {
    let isMounted = true;

    const trackableStatuses = ["PENDING", "PREPARING", "READY"];

    const syncQueueVisitsFromSupabase = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setQueueVisits([]);
        return;
      }

      try {
        const data = await queueOrderService.listOrders();
        if (!isMounted || !Array.isArray(data)) return;

        const normalized = data
          .filter((visit) => trackableStatuses.includes(visit.status))
          .map((visit) => ({
            id: visit.id,
            queueNo: visit.queue_number || visit.queueNumber || "",
            guestName: visit.customer_info?.guestName || visit.guestName || "",
            className: visit.customer_info?.className || visit.className || "",
            heightCm: visit.customer_info?.heightCm || visit.heightCm || "",
            weightKg: visit.customer_info?.weightKg || visit.weightKg || "",
            phone: visit.customer_info?.phone || visit.phone || "",
            notes: visit.customer_info?.notes || visit.notes || "",
            status: visit.status || "waiting",
            school: visit.school_id || visit.schoolId || "",
            createdAt: visit.created_at || visit.createdAt || new Date().toISOString(),
          }));

        setQueueVisits(normalized.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
      } catch (error) {
        console.error("同步排隊資料失敗", error);
        if (isMounted) setQueueVisits([]);
      }
    };

    syncQueueVisitsFromSupabase();

    if (!isSupabaseConfigured || !supabase) return () => { isMounted = false; };

    const channel = supabase
      .channel("customer-orders-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_orders" }, async () => {
        if (!isMounted) return;
        const data = await queueOrderService.listOrders();
        const normalized = (data || [])
          .filter((visit) => ["PENDING", "PREPARING", "READY"].includes(visit.status))
          .map((visit) => ({
            id: visit.id,
            queueNo: visit.queue_number || visit.queueNumber || "",
            guestName: visit.customer_info?.guestName || visit.guestName || "",
            className: visit.customer_info?.className || visit.className || "",
            heightCm: visit.customer_info?.heightCm || visit.heightCm || "",
            weightKg: visit.customer_info?.weightKg || visit.weightKg || "",
            phone: visit.customer_info?.phone || visit.phone || "",
            notes: visit.customer_info?.notes || visit.notes || "",
            status: visit.status || "waiting",
            school: visit.school_id || visit.schoolId || "",
            createdAt: visit.created_at || visit.createdAt || new Date().toISOString(),
          }));
        setQueueVisits(normalized.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const handleGuestSubmit = (guest) => {
    setQueueVisits((prev) => [guest, ...prev]);
    setSelectedGuest(null);
    setTab("queue");
    navigate("/queue", { replace: true });
  };

  const handleFittingStatusChange = (updatedOrder) => {
    if (!updatedOrder?.id) return;
    setQueueVisits((prev) => {
      const existing = prev.find((item) => item.id === updatedOrder.id);
      if (existing) {
        return prev.map((item) => item.id === updatedOrder.id ? {
          ...item,
          queueNo: updatedOrder.queue_number || updatedOrder.queueNumber || item.queueNo || "",
          guestName: updatedOrder.customer_info?.guestName || updatedOrder.guestName || item.guestName || "",
          className: updatedOrder.customer_info?.className || updatedOrder.className || item.className || "",
          phone: updatedOrder.customer_info?.phone || updatedOrder.phone || item.phone || "",
          status: updatedOrder.status || item.status,
          school: updatedOrder.school_id || updatedOrder.schoolId || item.school || "",
          createdAt: updatedOrder.created_at || updatedOrder.createdAt || item.createdAt || new Date().toISOString(),
        } : item);
      }
      return [
        {
          id: updatedOrder.id,
          queueNo: updatedOrder.queue_number || updatedOrder.queueNumber || "",
          guestName: updatedOrder.customer_info?.guestName || updatedOrder.guestName || "",
          className: updatedOrder.customer_info?.className || updatedOrder.className || "",
          heightCm: updatedOrder.customer_info?.heightCm || updatedOrder.heightCm || "",
          weightKg: updatedOrder.customer_info?.weightKg || updatedOrder.weightKg || "",
          phone: updatedOrder.customer_info?.phone || updatedOrder.phone || "",
          notes: updatedOrder.customer_info?.notes || updatedOrder.notes || "",
          status: updatedOrder.status || "PENDING",
          school: updatedOrder.school_id || updatedOrder.schoolId || "",
          createdAt: updatedOrder.created_at || updatedOrder.createdAt || new Date().toISOString(),
        },
        ...prev,
      ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    });
    setSelectedGuest((prev) => (prev && prev.id === updatedOrder.id ? null : prev));
  };

  const handleAssignGuest = (guest) => {
    setSelectedGuest(guest);
    setTab("fitting");
    const guestId = guest?.id || guest?.queueNo || "";
    navigate(`/fitting?id=${encodeURIComponent(guestId)}`);
  };

  const handleGenerateTicket = (ticket) => {
    setPickupTickets((prev) => [{ ...ticket, status: "ready_for_pickup" }, ...prev]);
    setQueueVisits((prev) => prev.map((item) => item.id === ticket.guestId ? { ...item, status: "selected" } : item));
    setSelectedGuest(null);
    setTab("pickup");
  };

  const handleMarkReady = (ticket) => {
    setPickupTickets((prev) => prev.map((item) => item.id === ticket.id ? { ...item, status: "ready_for_pickup" } : item));
  };

  const handleHandover = (ticket) => {
    const orderItems = ticket.items.map((item) => {
      const product = products.find((p) => p.name === item.productName);
      const sizeEntry = product?.sizes?.find((s) => String(s.size) === String(item.size));
      const price = Number(sizeEntry?.price || 0);
      return {
        productName: item.productName,
        size: item.size,
        quantity: item.quantity,
        price,
      };
    });
    const totalPrice = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = {
      id: `order-${Date.now()}`,
      ticketId: ticket.id,
      guestName: ticket.guestName,
      queueNo: ticket.queueNo,
      items: orderItems,
      totalPrice,
      status: "ready_for_payment",
    };

    setPaymentOrders((prev) => [order, ...prev]);
    setPickupTickets((prev) => prev.filter((item) => item.id !== ticket.id));
    setTab("cashier");
  };

  const handleReadyForSale = (order) => {
    if (!order) return;
    const readyItems = (order.tailor_info?.items || []).map((item, index) => {
      const productName = item.product_name || item.productName || "未知產品";
      const product = products.find((p) => p.name === productName) || null;
      const size = item.size || "";
      const length = item.length || "";
      const matchedSize = product?.sizes?.find((s) => String(s.size) === String(size) && String(s.length || "") === String(length));
      const price = Number(item.price || matchedSize?.price || 0);
      const qty = Number(item.quantity || item.qty || 1);
      return {
        key: `${order.id || "ready-order"}-${index}`,
        productId: product?.id || `ready-${index}`,
        name: productName,
        size,
        length,
        price,
        qty,
        sourceOrderId: order.id || "",
        sourceQueueNo: order.queue_number || order.queueNo || "",
        sourceGuestName: order.customer_info?.guestName || order.guestName || "",
      };
    });

    if (!readyItems.length) return;
    setCart(readyItems);
    setCashReceived("");
    setSelectedProduct(null);
    setTab("sale");
    navigate("/sale", { replace: true });
  };

  const handleConfirmPayment = async (payment) => {
    const paidOrder = paymentOrders.find((order) => order.id === payment.orderId) || null;
    const localRecord = paidOrder
      ? {
          id: payment.orderId || `receipt-${Date.now()}`,
          date: todayStr(),
          time: new Date().toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" }),
          items: (paidOrder.items || []).map((item) => ({
            name: item.productName,
            size: item.size,
            length: item.length || "",
            price: Number(item.price || 0),
            qty: Number(item.quantity || item.qty || 1),
          })),
          total: Number(payment.totalPrice || paidOrder.totalPrice || 0),
          cashReceived: Number(payment.cashReceived || payment.totalPrice || 0),
          changeDue: Number(payment.changeDue || 0),
          itemCount: (paidOrder.items || []).reduce((sum, item) => sum + Number(item.quantity || item.qty || 1), 0),
          cashierId: session ? session.id : null,
          cashierName: session ? session.name : "",
          school: paidOrder.school || selectedSchool || "",
          outletName: paidOrder.outletName || outletNameForSchool(paidOrder.school || selectedSchool || "", schoolMeta),
          outletAddress: paidOrder.outletAddress || "",
          outletPhone: paidOrder.outletPhone || "",
        }
      : null;

    if (localRecord) {
      setSalesLog((prev) => [localRecord, ...prev]);
      if (!isSupabaseConfigured || !supabase) {
        try {
          await window.storage.set("sales-log", JSON.stringify([localRecord, ...salesLog]), true);
        } catch (error) {
          console.error("保存本地付款記錄失敗", error);
        }
      }
    }

    setPaymentOrders((prev) => prev.map((order) => order.id === payment.orderId ? { ...order, status: "paid" } : order));
    setTab("records");
    navigate("/records", { replace: true });
    try {
      await refreshFromCloud({ skipProductsWhileEditing: false });
    } catch (error) {
      console.error("同步支付後記錄失敗", error);
    }
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);
  const cartSourceMeta = cart.find((item) => item.sourceQueueNo || item.sourceGuestName) || {};
  const cashAmount = cashReceived === "" ? cartTotal : Number(cashReceived || 0);
  const changeDue = cashAmount - cartTotal;

  const checkout = async () => {
    if (cart.length === 0) return;
    const now = new Date();
    const received = cashReceived === "" ? cartTotal : Number(cashReceived || 0);
    const sourceMeta = cart.find((item) => item.sourceQueueNo || item.sourceGuestName) || {};
    const order = {
      id: "",
      date: todayStr(),
      time: now.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" }),
      items: cart.map(({ name, size, length, price, qty }) => ({ name, size, length, price, qty })),
      total: cartTotal,
      cashReceived: received,
      changeDue: Math.max(received - cartTotal, 0),
      itemCount: cartCount,
      cashierId: session ? session.id : null,
      cashierName: session ? session.name : "",
      school: selectedSchool || "",
      queueNo: sourceMeta.sourceQueueNo || "",
      guestName: sourceMeta.sourceGuestName || "",
    };
    const outlet = outletForSchool(order.school, schoolMeta);
    if (outlet) {
      order.outletName = outlet.name;
      order.outletAddress = outlet.address;
      order.outletPhone = outlet.phone;
    }

    const sourceOrderIds = [...new Set(cart.filter((item) => item.sourceOrderId).map((item) => item.sourceOrderId))];
    const savedOrder = await saveSalesLog([order, ...salesLog]);
    if (!savedOrder) return;

    if (sourceOrderIds.length > 0 && isSupabaseConfigured && supabase) {
      await Promise.all(sourceOrderIds.map(async (sourceOrderId) => {
        try {
          const { error } = await supabase
            .from("customer_orders")
            .update({
              status: "COMPLETED",
              tailor_info: { paid_at: new Date().toISOString(), source_sale_id: savedOrder.id, payment: { method: "cash", cashReceived: received, changeDue: Math.max(received - cartTotal, 0) } },
            })
            .eq("id", sourceOrderId);
          if (error) {
            console.error("同步已支付客戶訂單失敗", error);
          } else {
            window.dispatchEvent(new CustomEvent("customer-order-paid", { detail: { orderId: sourceOrderId } }));
          }
        } catch (error) {
          console.error("同步已支付客戶訂單執行失敗", error);
        }
      }));
    }

    setReceipt(savedOrder);
    setCart([]);
    setSelectedProduct(null);
  };

  const printBrowser = () => {
    window.print();
  };

  const printBluetooth = async (order) => {
    if (!navigator.bluetooth) {
      setBtStatus({ state: "error", msg: "呢部裝置／瀏覽器唔支援藍牙列印，請用「瀏覽器列印」或裝RawBT等打印橋接App。" });
      return;
    }
    setBtStatus({ state: "connecting", msg: "揀選印表機中…" });
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [BT_SERVICE],
      });
      setBtStatus({ state: "connecting", msg: "連接緊 " + (device.name || "印表機") + "…" });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BT_SERVICE);
      const characteristic = await service.getCharacteristic(BT_CHAR);

      const lines = buildReceiptLines(order, order.school || "校服銷售收據");
      const text = lines.join("\n") + "\n\n\n";

      const ESC = 0x1b, GS = 0x1d;
      const encoder = new TextEncoder();
      const bodyBytes = encoder.encode(text);
      const payload = new Uint8Array([ESC, 0x40, ...bodyBytes, GS, 0x56, 0x00]);

      const chunkSize = 20;
      for (let i = 0; i < payload.length; i += chunkSize) {
        await characteristic.writeValue(payload.slice(i, i + chunkSize));
        await new Promise((r) => setTimeout(r, 25));
      }
      setBtStatus({ state: "success", msg: "已傳送去印表機。" });
    } catch (e) {
      console.error(e);
      setBtStatus({
        state: "error",
        msg: "藍牙列印失敗（唔同印表機牌子連線方式可能唔一樣）。建議改用「瀏覽器列印」配合RawBT等打印橋接App，兼容性會高好多。",
      });
    }
  };

  useEffect(() => {
    if (cart.length === 0) {
      setCashReceived("");
    }
  }, [cart.length]);

  const publicQueueParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("queue") : null;
  const publicRouteSchool = new URLSearchParams(location.search).get("school_id") || new URLSearchParams(location.search).get("school") || "";
  const routeId = new URLSearchParams(location.search).get("id");

  useEffect(() => {
    if (location.pathname === "/" && publicRouteSchool) {
      navigate(`/checkin?school_id=${encodeURIComponent(publicRouteSchool)}`);
    }
  }, [location.pathname, publicRouteSchool, navigate]);

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    const routeMap = {
      guest: "/checkin",
      queue: "/queue",
      fitting: "/fitting",
      pickup: "/pickup",
      cashier: "/cashier",
      sale: "/sale",
      track: "/track",
      qrcode: "/qrcode",
      products: "/products",
      records: "/records",
      staff: "/staff",
    };
    if (routeMap[nextTab]) {
      navigate(routeMap[nextTab]);
    }
  };

  if (location.pathname === "/checkin") {
    return <CustomerCheckinPage school={publicRouteSchool} onSubmit={handleGuestSubmit} />;
  }

  if (location.pathname === "/queue-status") {
    return <GuestQueueStatusPage queueNo={routeId || publicQueueParam || ""} schoolName={publicRouteSchool || ""} />;
  }

  if (!loaded) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary, #666)" }}>
        載入緊…
      </div>
    );
  }

  if (!authReady) {
    return <div style={{ padding: 40, textAlign: "center", color: "#666" }}>驗證登入狀態中…</div>;
  }

  if (passwordSetupRequired) {
    return <PasswordSetupScreen onComplete={finishPasswordSetup} />;
  }

  if (publicQueueParam) {
    return <GuestQueueStatusPage queueNo={publicQueueParam} schoolName={selectedSchool || ""} />;
  }

  if (location.pathname === "/" || location.pathname === "") {
    return <PublicHomePage schools={schools} schoolMeta={schoolMeta} onStaffLogin={() => navigate("/staff")} />;
  }

  if (!session) {
    return <LoginScreen accounts={accounts} onLogin={login} onAuthLogin={loginWithAuth} useSupabaseAuth={isSupabaseAuthEnabled} />;
  }

  return (
    <AppErrorBoundary>
      <div style={{ maxWidth: 460, margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-receipt, #print-receipt * { visibility: visible; }
          #print-receipt { position: absolute; top: 0; left: 0; width: 58mm; font-family: monospace; }
        }
        .pos-btn { cursor: pointer; border: none; outline: none; }
        .pos-btn:active { transform: scale(0.97); }
      `}</style>

      <div style={{ background: "#1F3A5F", color: "#fff", padding: "16px 20px", borderRadius: schoolPanelOpen ? "0" : "0 0 16px 16px", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          {session.role === ROLES.GUEST ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{selectedSchool}</div>
                <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>客人登記系統</div>
              </div>
            </div>
          ) : schools.length > 0 ? (
            <button
              className="pos-btn"
              onClick={() => setSchoolPanelOpen((v) => !v)}
              style={{ background: "none", color: "#fff", textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {selectedSchool || "校服銷售"}
                  {schoolPanelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
                <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>{todayStr()}</div>
              </div>
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>校服銷售</div>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>{todayStr()}</div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            {session.role !== ROLES.GUEST && (
              <button
                className="pos-btn"
                onClick={() => refreshFromCloud({ skipProductsWhileEditing: false })}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, opacity: 0.9, background: "rgba(255,255,255,0.12)", color: "#fff", padding: "4px 8px", borderRadius: 8 }}
                title="㩒一下即刻同步"
              >
                <Users size={12} />
                {syncing ? "同步緊…" : lastSync ? `已同步 ${lastSync.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "多裝置同步中"}
              </button>
            )}
            <button
              className="pos-btn"
              onClick={logout}
              style={{ fontSize: 11, opacity: 0.9, background: "rgba(255,255,255,0.12)", color: "#fff", padding: "4px 8px", borderRadius: 8 }}
              title="登出"
            >
              {session.name}（{ROLE_LABEL[session.role].split("／")[0].replace(" ADMIN", "")}）· 登出
            </button>
          </div>
        </div>

        {schoolPanelOpen && schools.length > 0 && session.role !== ROLES.GUEST && (
          <StoreSchoolSwitcher
            schools={schools}
            schoolMeta={schoolMeta}
            selectedSchool={selectedSchool}
            onPick={pickSchool}
          />
        )}
      </div>
      {schoolPanelOpen && <div style={{ height: 16, background: "#1F3A5F", borderRadius: "0 0 16px 16px" }} />}

      {session.role !== ROLES.GUEST && (
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 0" }}>
        {[
          { id: "sale", label: "銷售", icon: ShoppingCart },
          { id: "guest", label: "客人登記", icon: Users },
          { id: "queue", label: "排隊", icon: ClipboardList },
          { id: "track", label: "查單", icon: Search },
          { id: "fitting", label: "度身", icon: Users },
          { id: "pickup", label: "取貨", icon: ClipboardList },
          { id: "cashier", label: "收銀", icon: ShoppingCart },
          { id: "qrcode", label: "QR碼", icon: QrCode },
          { id: "products", label: "商品", icon: Settings },
          { id: "records", label: "記錄", icon: ClipboardList },
          { id: "staff", label: "員工", icon: Users },
        ]
          .filter((t) => (perms?.tabs?.includes(t.id)) || ["guest", "queue", "fitting", "pickup", "cashier", "qrcode", "track"].includes(t.id))
          .map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className="pos-btn"
            onClick={() => handleTabChange(id)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 0",
              borderRadius: 10,
              background: tab === id ? "#1F3A5F" : "#EEF1F5",
              color: tab === id ? "#fff" : "#333",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      )}

      {(() => {
        const queueParam = new URLSearchParams(window.location.search).get("queue");
        if (queueParam) {
          return <GuestQueueStatusPage queueNo={queueParam} schoolName={selectedSchool || ""} />;
        }
        return null;
      })()}

      <div style={{ padding: "16px" }}>
        <Routes>
          <Route
            path="/checkin"
            element={<CustomerCheckinPage school={publicRouteSchool} onSubmit={handleGuestSubmit} />}
          />
          <Route
            path="/queue-status"
            element={<GuestQueueStatusPage queueNo={routeId || publicQueueParam || ""} schoolName={publicRouteSchool || ""} />}
          />
          <Route
            path="/fitting"
            element={
              <FittingPage
                guest={selectedGuest}
                currentSchoolId={selectedSchool || publicRouteSchool}
                selectedOrderId={routeId || selectedGuest?.id || ""}
                products={selectedSchool ? products.filter((p) => schoolOf(p) === selectedSchool) : products}
                schoolName={selectedSchool}
                onGenerateTicket={handleGenerateTicket}
                onStatusChange={handleFittingStatusChange}
              />
            }
          />
          <Route
            path="/queue"
            element={<QueuePage visits={queueVisits} onViewGuest={(guest) => setSelectedGuest(guest)} onAssign={handleAssignGuest} />}
          />
          <Route
            path="/pickup"
            element={<PickupPage currentSchoolId={selectedSchool || publicRouteSchool} onReadyForSale={handleReadyForSale} />}
          />
          <Route
            path="/cashier"
            element={<CashierVerifyPage currentSchoolId={selectedSchool || publicRouteSchool} products={products} onConfirmPayment={handleConfirmPayment} />}
          />
          <Route
            path="/track"
            element={
              <StaffOrderTracking visits={queueVisits} onStatusUpdate={(id, status) => {
                setQueueVisits(queueVisits.map(v => v.id === id ? {...v, status} : v));
              }} />
            }
          />
          <Route
            path="/qrcode"
            element={<SchoolQRCodePage schoolName="香港中國婦女會馮堯敬紀念中學" onSchoolChange={setSelectedSchool} />}
          />
          <Route
            path="/products"
            element={
              <ProductsTab
                products={products}
                saveProducts={saveProducts}
                importResult={importResult}
                setImportResult={setImportResult}
                productsSaveError={productsSaveError}
                productsSaveState={productsSaveState}
                saveProductsNow={saveProductsNow}
                canManageSchools={perms.canManageSchools}
                canImportExport={perms.canImportExport}
                schoolMeta={schoolMeta}
                saveSchoolMeta={saveSchoolMeta}
                setDeletedSchools={setDeletedSchools}
                selectedSchool={selectedSchool}
                setSelectedSchool={setSelectedSchool}
              />
            }
          />
          <Route
            path="/records"
            element={
              <RecordsTab
                salesLog={salesLog}
                onReprint={(o) => setReceipt(o)}
                canViewAllDates={perms.canViewAllDates}
                canExportSales={perms.canExportSales}
                schoolMeta={schoolMeta}
              />
            }
          />
          <Route
            path="/staff"
            element={isSupabaseAuthEnabled ? <AuthStaffTab manageStaff={manageStaff} currentId={session.id} /> : <StaffTab accounts={accounts} saveAccounts={saveAccounts} currentId={session.id} />}
          />
          <Route
            path="/sale"
            element={
              <SaleTab
                products={products}
                selectedProduct={selectedProduct}
                setSelectedProduct={setSelectedProduct}
                addToCart={addToCart}
                cart={cart}
                cartSourceMeta={cartSourceMeta}
                changeQty={changeQty}
                removeItem={removeItem}
                cartTotal={cartTotal}
                cartCount={cartCount}
                checkout={checkout}
                selectedSchool={selectedSchool}
                storageError={storageError}
                cashReceived={cashReceived}
                setCashReceived={setCashReceived}
                changeDue={changeDue}
                cashAmount={cashAmount}
              />
            }
          />
          <Route
            path="*"
            element={
              <>
                {tab === "sale" && (
                  <SaleTab
                    products={products}
                    selectedProduct={selectedProduct}
                    setSelectedProduct={setSelectedProduct}
                    addToCart={addToCart}
                    cart={cart}
                    cartSourceMeta={cartSourceMeta}
                    changeQty={changeQty}
                    removeItem={removeItem}
                    cartTotal={cartTotal}
                    cartCount={cartCount}
                    checkout={checkout}
                    selectedSchool={selectedSchool}
                    storageError={storageError}
                    cashReceived={cashReceived}
                    setCashReceived={setCashReceived}
                    changeDue={changeDue}
                    cashAmount={cashAmount}
                  />
                )}
                {tab === "guest" && (
                  <CustomerCheckinPage school={publicRouteSchool} onSubmit={handleGuestSubmit} />
                )}
                {tab === "queue" && (
                  <QueuePage visits={queueVisits} onViewGuest={(guest) => setSelectedGuest(guest)} onAssign={handleAssignGuest} />
                )}
                {tab === "fitting" && (
                  <FittingPage
                    guest={selectedGuest}
                    currentSchoolId={selectedSchool || publicRouteSchool}
                    products={selectedSchool ? products.filter((p) => schoolOf(p) === selectedSchool) : products}
                    schoolName={selectedSchool}
                    onGenerateTicket={handleGenerateTicket}
                    onStatusChange={handleFittingStatusChange}
                  />
                )}
                {tab === "pickup" && (
                  <PickupPage currentSchoolId={selectedSchool || publicRouteSchool} onReadyForSale={handleReadyForSale} />
                )}
                {tab === "cashier" && (
                  <CashierVerifyPage currentSchoolId={selectedSchool || publicRouteSchool} products={products} onConfirmPayment={handleConfirmPayment} />
                )}
                {tab === "track" && (
                  <StaffOrderTracking visits={queueVisits} onStatusUpdate={(id, status) => {
                    setQueueVisits(queueVisits.map(v => v.id === id ? {...v, status} : v));
                  }} />
                )}
                {tab === "qrcode" && (
                  <SchoolQRCodePage schoolName="香港中國婦女會馮堯敬紀念中學" onSchoolChange={setSelectedSchool} />
                )}
                {tab === "products" && (
                  <ProductsTab
                    products={products}
                    saveProducts={saveProducts}
                    importResult={importResult}
                    setImportResult={setImportResult}
                    productsSaveError={productsSaveError}
                    productsSaveState={productsSaveState}
                    saveProductsNow={saveProductsNow}
                    canManageSchools={perms.canManageSchools}
                    canImportExport={perms.canImportExport}
                    schoolMeta={schoolMeta}
                    saveSchoolMeta={saveSchoolMeta}
                    setDeletedSchools={setDeletedSchools}
                    selectedSchool={selectedSchool}
                    setSelectedSchool={setSelectedSchool}
                  />
                )}
                {tab === "records" && (
                  <RecordsTab
                    salesLog={salesLog}
                    onReprint={(o) => setReceipt(o)}
                    canViewAllDates={perms.canViewAllDates}
                    canExportSales={perms.canExportSales}
                    schoolMeta={schoolMeta}
                  />
                )}
                {tab === "staff" && (isSupabaseAuthEnabled ? <AuthStaffTab manageStaff={manageStaff} currentId={session.id} /> : <StaffTab accounts={accounts} saveAccounts={saveAccounts} currentId={session.id} />)}
              </>
            }
          />
        </Routes>
      </div>

      {receipt && (
        <ReceiptModal
          order={receipt}
          onClose={() => {
            setReceipt(null);
            setBtStatus({ state: "idle", msg: "" });
          }}
          onPrintBrowser={printBrowser}
          onPrintBluetooth={() => printBluetooth(receipt)}
          btStatus={btStatus}
        />
      )}

      <div id="print-receipt" ref={printAreaRef} style={{ display: "none" }}>
        {receipt && (
          <div style={{ padding: 8, fontSize: 12, lineHeight: 1.5 }}>
            <div style={{ textAlign: "center", fontWeight: 700 }}>Victoria Uniform 校服銷售</div>
            <div style={{ textAlign: "center" }}>電子銷售單 ELECTRONIC RECEIPT</div>
            <div>收據編號：#{(receipt.id || "").toUpperCase()}</div>
            <div>交易日期：{receipt.date} {receipt.time}</div>
            <div>學校：{receipt.school || "-"}</div>
            <div>--------------------------------</div>
            <div>商品明細</div>
            {receipt.items.map((it, i) => (
              <div key={i}>
                <div>{it.name}</div>
                <div>  {formatSizeForReceipt(it.name, it.size, it.length)}</div>
                <div>  數量 {it.qty} x {fmt(it.price)} = {fmt(it.price * it.qty)}</div>
              </div>
            ))}
            <div>--------------------------------</div>
            <div>商品件數：{receipt.itemCount}</div>
            <div style={{ fontWeight: 700 }}>應付總額：{fmt(receipt.total)}</div>
            <div>交易狀態：已完成</div>
            <div style={{ marginTop: 8, color: "#555", whiteSpace: "pre-line" }}>
              換貨條款：全新校服可於購買日起一個月內到指定門店換貨。{String.fromCharCode(10)}不設退款；貨品必須未經洗滌、未曾使用，並保留完整吊牌及剪牌，否則恕不接受換貨。
            </div>
            <div style={{ textAlign: "center", marginTop: 8 }}>多謝惠顧，歡迎重臨</div>
          </div>
        )}
      </div>
    </div>
    </AppErrorBoundary>
  );
}

function SaleTab({
  products,
  selectedProduct,
  setSelectedProduct,
  addToCart,
  cart,
  cartSourceMeta,
  changeQty,
  removeItem,
  cartTotal,
  cartCount,
  checkout,
  selectedSchool,
  storageError,
  cashReceived,
  setCashReceived,
  changeDue,
  cashAmount,
}) {
  const [genderFilter, setGenderFilter] = useState("全部");
  const [selectedLength, setSelectedLength] = useState("");
  const schools = listSchools(products);
  const visibleProducts = selectedSchool ? products.filter((p) => schoolOf(p) === selectedSchool) : products;
  const filteredProducts = visibleProducts.filter((product) =>
    (genderFilter === "全部" || genderOf(product) === genderFilter || genderOf(product) === "男女通用")
  );
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const aIndex = products.findIndex((p) => p.id === a.id);
    const bIndex = products.findIndex((p) => p.id === b.id);
    return aIndex - bIndex;
  });

  useEffect(() => {
    if (selectedProduct && !filteredProducts.some((product) => product.id === selectedProduct)) setSelectedProduct(null);
  }, [genderFilter, selectedSchool, products, selectedProduct]);

  useEffect(() => {
    setSelectedLength("");
  }, [selectedProduct]);

  return (
    <div>
      {(cartSourceMeta.sourceQueueNo || cartSourceMeta.sourceGuestName) && (
        <div style={{ background: "#EAF4FF", border: "1px solid #CFE0F9", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 13, color: "#1F3A5F" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>轉入單據</div>
          <div>單號：{cartSourceMeta.sourceQueueNo || "未分配"}</div>
          <div>客人：{cartSourceMeta.sourceGuestName || "未填寫"}</div>
        </div>
      )}
      {schools.length > 1 && (
        <div style={{ fontSize: 12, color: "#999", marginBottom: 10 }}>
          㩒返上面標題「{selectedSchool || "校服銷售"}」可以切換學校
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, padding: 4, background: "#F7F7F5", borderRadius: 10 }}>
        {["全部", "男裝", "女裝"].map((gender) => (
          <button
            key={gender}
            className="pos-btn"
            onClick={() => setGenderFilter(gender)}
            style={{ flex: 1, padding: "9px 4px", borderRadius: 8, background: genderFilter === gender ? "#1F3A5F" : "transparent", color: genderFilter === gender ? "#fff" : "#555", fontSize: 13, fontWeight: 600 }}
          >
            {gender}
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "#999", padding: "8px 2px" }}>
            此分類未有商品，請選擇其他分類或到「商品」分頁新增／匯入。
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#2F6F68", padding: "8px 2px", borderBottom: "1px solid #DDE8E5", marginBottom: 8 }}>
          商品列表
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {sortedProducts.map((p) => (
            <button
              key={p.id}
              className="pos-btn"
              onClick={() => {
                setSelectedProduct(p.id === selectedProduct ? null : p.id);
                setSelectedLength("");
              }}
              style={{
                padding: "12px 10px",
                borderRadius: 10,
                background: selectedProduct === p.id ? "#D97757" : "#fff",
                color: selectedProduct === p.id ? "#fff" : "#222",
                border: "1px solid " + (selectedProduct === p.id ? "#D97757" : "#ddd"),
                fontSize: 14,
                fontWeight: 500,
                textAlign: "left",
              }}
            >
              {displayProductName(p.name)}
            </button>
          ))}
        </div>
      </div>

      {selectedProduct && (
        <div key={selectedProduct} style={{ marginBottom: 16 }}>
          {(() => {
            const product = products.find((p) => p.id === selectedProduct);
            const categoryLabel = hasLengthOptions(product) ? `先揀長度，再揀${sizeDimensionLabel(product)}：` : "揀尺碼：";
            return <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>{categoryLabel}</div>;
          })()}
          {(() => {
            const product = products.find((p) => p.id === selectedProduct);
            if (!product) return null;
            if (!product) return null;
            const hasLengths = hasLengthOptions(product);
            if (!hasLengths) return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {product.sizes.map((s) => (
                  <button
                    key={`${selectedProduct}-${s.size}`}
                    className="pos-btn"
                    onClick={() => addToCart(product, s)}
                    style={{ padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1px solid #ccc", fontSize: 14 }}
                  >
                    <div style={{ fontWeight: 600 }}>{sizeLabel(s)}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{fmt(s.price)}</div>
                  </button>
                ))}
              </div>
            );
            const lengths = [...new Set(product.sizes.map((size) => size.length))].sort(naturalSizeSort);
            if (!selectedLength) return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {lengths.map((length) => (
                  <button
                    key={`${selectedProduct}-length-${length}`}
                    className="pos-btn"
                    onClick={() => setSelectedLength(length)}
                    style={{ minWidth: 100, padding: "11px 14px", borderRadius: 10, background: "#fff", border: "1px solid #1F3A5F", color: "#1F3A5F", fontSize: 14, fontWeight: 600 }}
                  >
                    長度 {length}
                  </button>
                ))}
              </div>
            );
            const selectedLengthSizes = product.sizes
              .filter((size) => size.length === selectedLength)
              .sort((a, b) => naturalSizeSort(a.size, b.size));
            return (
              <div>
                <button className="pos-btn" onClick={() => setSelectedLength("")} style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 8, background: "#F0F0EC", border: "1px solid #ddd", fontSize: 12 }}>
                  更改長度（目前：{selectedLength}）
                </button>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedLengthSizes.map((s) => (
                    <button
                      key={`${selectedProduct}-${s.size}-${s.length}`}
                      className="pos-btn"
                      onClick={() => addToCart(product, s)}
                      style={{ minWidth: 76, padding: "8px 7px", borderRadius: 8, background: "#fff", border: "1px solid #ccc", fontSize: 12 }}
                    >
                      <div style={{ fontWeight: 600 }}>{sizeDimensionLabel(product)} {s.size} 吋</div>
                      <div style={{ color: "#888", marginTop: 2 }}>{fmt(s.price)}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div style={{ background: "#F7F7F5", borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>購物車</div>
        {cart.length === 0 && <div style={{ fontSize: 13, color: "#999" }}>未揀任何貨品</div>}
        {cart.map((c) => (
          <div key={c.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #E5E5E0" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}（{sizeLabel(c)}）</div>
              <div style={{ fontSize: 12, color: "#888" }}>{fmt(c.price)} x {c.qty} = {fmt(c.price * c.qty)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button className="pos-btn" onClick={() => changeQty(c.key, -1)} style={{ width: 26, height: 26, borderRadius: 6, background: "#fff", border: "1px solid #ccc" }}>
                <Minus size={13} style={{ margin: "auto" }} />
              </button>
              <span style={{ fontSize: 13, minWidth: 16, textAlign: "center" }}>{c.qty}</span>
              <button className="pos-btn" onClick={() => changeQty(c.key, 1)} style={{ width: 26, height: 26, borderRadius: 6, background: "#fff", border: "1px solid #ccc" }}>
                <Plus size={13} style={{ margin: "auto" }} />
              </button>
              <button className="pos-btn" onClick={() => removeItem(c.key)} style={{ width: 26, height: 26, borderRadius: 6, background: "#fff", border: "1px solid #eee", color: "#c33" }}>
                <Trash2 size={13} style={{ margin: "auto" }} />
              </button>
            </div>
          </div>
        ))}
        {cart.length > 0 && (
          <>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700 }}>
              <span>總計（{cartCount}件）</span>
              <span>{fmt(cartTotal)}</span>
            </div>

            <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 10, borderTop: "1px solid #E5E5E0" }}>
              <label htmlFor="cash-received" style={{ fontSize: 13, fontWeight: 600, color: "#45515F" }}>實收現金</label>
              <input
                id="cash-received"
                type="number"
                min="0"
                step="1"
                value={cashReceived}
                onFocus={(e) => {
                  e.target.select();
                  if (cashReceived === "" || Number(cashReceived || 0) === 0) {
                    setCashReceived("");
                  }
                }}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCashReceived(raw === "" ? "" : raw.replace(/^0+(?=\d)/, ""));
                }}
                placeholder=""
                style={{ width: 120, padding: "8px 10px", borderRadius: 8, border: "1px solid #cfd6dd", fontSize: 14, textAlign: "right" }}
              />
            </div>

            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: changeDue >= 0 ? "#1F3A5F" : "#B42318" }}>
              <span>{changeDue >= 0 ? "找續" : "尚欠"}</span>
              <span>{fmt(Math.abs(changeDue))}</span>
            </div>

            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666" }}>
              <span>已收</span>
              <span>{fmt(cashAmount)}</span>
            </div>
          </>
        )}
      </div>

      <button
        className="pos-btn"
        onClick={checkout}
        disabled={cart.length === 0}
        style={{
          width: "100%",
          marginTop: 14,
          padding: "14px 0",
          borderRadius: 12,
          background: cart.length === 0 ? "#ddd" : "#1F3A5F",
          color: "#fff",
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        完成交易並開單
      </button>
      {storageError && (
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "#FFF1F0", color: "#B42318", fontSize: 12, display: "flex", gap: 6, alignItems: "flex-start" }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{storageError}</span>
        </div>
      )}
    </div>
  );
}

function ProductsTab({ products, saveProducts, saveProductsNow, importResult, setImportResult, productsSaveError = "", productsSaveState = "saved", sourceIntegrityWarning = "", canManageSchools = true, canImportExport = true, schoolMeta = {}, saveSchoolMeta = async () => {}, setDeletedSchools = () => {}, selectedSchool = null, setSelectedSchool = () => {} }) {
  const [expanded, setExpanded] = useState(null);
  const [importing, setImporting] = useState(false);
  const [lengthPromptProductId, setLengthPromptProductId] = useState(null);
  const [lengthDraft, setLengthDraft] = useState("");
  const activeSchool = selectedSchool;

  const fileInputRef = useRef(null);
  const [addingSchool, setAddingSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newSchoolError, setNewSchoolError] = useState("");
  const [newSchoolCategory, setNewSchoolCategory] = useState("");
  const [newSchoolLevel, setNewSchoolLevel] = useState(SCHOOL_LEVELS[0]);
  const [newSchoolRegion, setNewSchoolRegion] = useState(HK_REGIONS[0]);
  const [newSchoolDistrict, setNewSchoolDistrict] = useState(HK_DISTRICTS[HK_REGIONS[0]][0]);
  const [newSchoolOutlet, setNewSchoolOutlet] = useState(OUTLETS[0].name);
  const newSchoolInputRef = useRef(null);
  const [showClassifyPanel, setShowClassifyPanel] = useState(false);
  const productsRef = useRef(products);

  const schools = listSchools(products);
  const schoolSuggestions = newSchoolName.trim().length >= 2
    ? Object.keys(schoolCatalog)
      .filter((school) => {
        const query = newSchoolName.trim();
        return school.includes(query) || [...new Set(query)].every((character) => school.includes(character));
      })
      .sort((first, second) => {
        const query = newSchoolName.trim();
        const firstExact = first.includes(query) ? 0 : 1;
        const secondExact = second.includes(query) ? 0 : 1;
        return firstExact - secondExact || first.localeCompare(second, "zh-Hant");
      })
      .slice(0, 8)
    : [];

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  const saveProductChanges = (next, options = {}) => {
    productsRef.current = next;
    saveProducts(next, options);
  };

  const updateProduct = (id, next) => {
    saveProducts(products.map((p) => (p.id === id ? next : p)));
  };

  const addProductLength = (product, suppliedLength) => {
    const rawLength = (suppliedLength ?? "").toString().trim();
    if (!rawLength) return;
    const normalizedLength = rawLength.replace(/["']/g, "");
    const hasLengths = hasLengthOptions(product);
    let sizes;
    if (!hasLengths) {
      sizes = product.sizes.map((size) => ({ ...size, length: normalizedLength }));
    } else {
      const existingKeys = new Set(product.sizes.map((size) => `${size.size}\u0000${size.length || ""}`));
      const existingSizes = [...new Set(product.sizes.map((size) => size.size))];
      const additions = existingSizes
        .filter((size) => !existingKeys.has(`${size}\u0000${normalizedLength}`))
        .map((size) => ({ size, length: normalizedLength, price: product.sizes.find((item) => item.size === size)?.price || 0 }));
      sizes = [...product.sizes, ...additions];
    }
    updateProduct(product.id, { ...product, sizes });
    setLengthPromptProductId(null);
    setLengthDraft("");
  };

  const addProduct = (school) => {
    const np = { id: uid(), school: school || "", name: "新款式", sizes: [{ size: "M", price: 0 }] };
    saveProducts([...products, np]);
    setExpanded(np.id);
  };

  const moveProduct = (id, direction) => {
    const currentProducts = productsRef.current;
    const currentIndex = currentProducts.findIndex((product) => product.id === id);
    if (currentIndex < 0) return;
    const currentSchool = schoolOf(currentProducts[currentIndex]);
    const schoolIndexes = currentProducts
      .map((product, index) => (schoolOf(product) === currentSchool ? index : -1))
      .filter((index) => index >= 0);
    const schoolPosition = schoolIndexes.indexOf(currentIndex);
    const nextPosition = schoolPosition + direction;
    if (schoolPosition < 0 || nextPosition < 0 || nextPosition >= schoolIndexes.length) return;
    const next = [...currentProducts];
    const nextIndex = schoolIndexes[nextPosition];
    [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
    saveProductChanges(next, { orderOnly: true });
  };

  const moveProductToBoundary = (id, boundary) => {
    const currentProducts = productsRef.current;
    const currentIndex = currentProducts.findIndex((product) => product.id === id);
    if (currentIndex < 0) return;
    const currentSchool = schoolOf(currentProducts[currentIndex]);
    const schoolIndexes = currentProducts
      .map((product, index) => (schoolOf(product) === currentSchool ? index : -1))
      .filter((index) => index >= 0);
    const schoolPosition = schoolIndexes.indexOf(currentIndex);
    const targetPosition = boundary === "start" ? 0 : schoolIndexes.length - 1;
    if (schoolPosition < 0 || schoolPosition === targetPosition) return;
    const next = [...currentProducts];
    const [selectedProduct] = next.splice(currentIndex, 1);
    const targetIndex = schoolIndexes[targetPosition] - (currentIndex < schoolIndexes[targetPosition] ? 1 : 0);
    next.splice(targetIndex, 0, selectedProduct);
    saveProductChanges(next, { orderOnly: true });
  };

  const openAddSchool = () => {
    setNewSchoolName("");
    setNewSchoolError("");
    setNewSchoolCategory("");
    setNewSchoolLevel(SCHOOL_LEVELS[0]);
    setNewSchoolRegion(HK_REGIONS[0]);
    setNewSchoolDistrict(HK_DISTRICTS[HK_REGIONS[0]][0]);
    setNewSchoolOutlet(OUTLETS[0].name);
    setAddingSchool(true);
    setTimeout(() => newSchoolInputRef.current && newSchoolInputRef.current.focus(), 0);
  };

  const applyCatalogToNewSchool = (value) => {
    const match = schoolCatalog[value.trim()];
    if (!match) return;
    setNewSchoolCategory(match.category || "");
    setNewSchoolLevel(match.level || SCHOOL_LEVELS[0]);
    if (match.region && HK_REGIONS.includes(match.region)) {
      setNewSchoolRegion(match.region);
      setNewSchoolDistrict(match.district || HK_DISTRICTS[match.region][0]);
    }
    setNewSchoolOutlet(outletNameForSchool(value.trim(), { [value.trim()]: match }));
  };

  const selectSchoolSuggestion = (school) => {
    setNewSchoolName(school);
    setNewSchoolError("");
    applyCatalogToNewSchool(school);
  };

  const confirmAddSchool = () => {
    const name = newSchoolName.trim();
    if (!name) {
      setNewSchoolError("請輸入正確的學校名稱");
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(schoolCatalog, name)) {
      setNewSchoolError("請輸入正確的學校名稱");
      return;
    }
    // 防止重複學校名（唔理大小寫同前後空格）
    const dup = schools.find((sc) => sc.toLowerCase() === name.toLowerCase());
    if (dup) {
      alert(`「${dup}」已經存在，唔可以重複新增。`);
      return;
    }
    const catalogEntry = schoolCatalog[name];
    const schoolMetaEntry = catalogEntry
      ? { category: catalogEntry.category || "", level: catalogEntry.level || newSchoolLevel, region: catalogEntry.region || newSchoolRegion, district: catalogEntry.district || newSchoolDistrict }
      : { category: newSchoolCategory, level: newSchoolLevel, region: newSchoolRegion, district: newSchoolDistrict };
    schoolMetaEntry.outletName = newSchoolOutlet;
    addProduct(name);
    saveSchoolMeta({ ...schoolMeta, [name]: schoolMetaEntry });
    setSelectedSchool(name);
    setAddingSchool(false);
    setNewSchoolName("");
    setNewSchoolError("");
  };

  const deleteProduct = (id) => {
    const target = products.find((p) => p.id === id);
    if (target && !window.confirm(`確定要刪除「${target.name}」呢個款式？呢個動作唔可以復原。`)) return;
    saveProducts(products.filter((p) => p.id !== id));
  };

  const deleteSchool = () => {
    if (!activeSchool) return;
    const schoolProductCount = visibleProducts.length;
    const confirmed = window.confirm(`確定要刪除學校「${activeSchool}」？\n\n將會刪除 ${schoolProductCount} 個款式及該校分類資料。\n此動作不能復原，請先確認。`);
    if (!confirmed) return;
    saveProducts(products.filter((p) => schoolOf(p) !== activeSchool));
    const nextMeta = { ...schoolMeta };
    delete nextMeta[activeSchool];
    saveSchoolMeta(nextMeta);
    deletedSchoolsRuntime.add(activeSchool);
    const nextDeletedSchools = [...deletedSchoolsRuntime];
    setDeletedSchools(nextDeletedSchools);
    window.storage.set("deleted-schools", JSON.stringify(nextDeletedSchools), false).catch((e) => console.error("儲存已刪除學校清單失敗", e));
    setSelectedSchool(null);
    setExpanded(null);
  };

  const handleExport = () => {
    downloadCSV(productsToCSV(products), `校服資料_${todayStr()}.csv`);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const { next, summary, errors } = mergeCSVIntoProducts(text, products);
      await saveProducts(next);
      setImportResult({ summary, errors });
    } catch (err) {
      console.error(err);
      setImportResult({ summary: null, errors: ["讀取檔案失敗，請確認係CSV格式。"] });
    } finally {
      setImporting(false);
    }
  };

  const visibleProducts = activeSchool ? products.filter((p) => schoolOf(p) === activeSchool) : [];

  return (
    <div>
      {productsSaveError && (
        <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, background: "#FFF1F0", color: "#B42318", fontSize: 12, display: "flex", gap: 6, alignItems: "flex-start" }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{productsSaveError}</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <button
          className="pos-btn"
          onClick={saveProductsNow}
          disabled={productsSaveState === "saving"}
          style={{ padding: "8px 14px", borderRadius: 8, background: productsSaveState === "error" ? "#B42318" : "#1F3A5F", color: "#fff", fontSize: 13, fontWeight: 600 }}
        >
          {productsSaveState === "saving" ? "保存緊…" : "儲存商品資料"}
        </button>
        {productsSaveState === "pending" && <span style={{ fontSize: 12, color: "#9A6700" }}>有未保存修改</span>}
        {productsSaveState === "saved" && <span style={{ fontSize: 12, color: "#28784B" }}>已保存</span>}
      </div>
      {/* 匯入 / 匯出 CSV（只有ADMIN先見到，管理員先可以做批量價格調整） */}
      {canImportExport && (
      <div style={{ background: "#F7F7F5", borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>批量匯入 / 匯出</div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 10, lineHeight: 1.5 }}>
          CSV欄位：學校、款式名稱、長度、尺碼、價錢。褲／裙每個長度及尺碼輸入一行；其他款式只填尺碼。同一組合再匯入會更新價錢，唔會重複。
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="pos-btn"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            disabled={importing}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "#1F3A5F", color: "#fff", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Upload size={14} /> {importing ? "匯入緊…" : "匯入 CSV"}
          </button>
          <button
            className="pos-btn"
            onClick={handleExport}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "#fff", border: "1px solid #1F3A5F", color: "#1F3A5F", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Download size={14} /> 匯出 CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} style={{ display: "none" }} />
        </div>

        {importResult && (
          <div style={{ marginTop: 10, fontSize: 12, background: "#fff", borderRadius: 8, padding: 10, border: "1px solid #E5E5E0" }}>
            {importResult.summary && (
              <div style={{ color: "#1F3A5F", marginBottom: importResult.errors.length ? 6 : 0, display: "flex", alignItems: "flex-start", gap: 6 }}>
                <Check size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  完成：新增 {importResult.summary.addedProducts} 個款式、新增 {importResult.summary.addedSizes} 個碼數、更新 {importResult.summary.updatedSizes} 個價錢。
                </span>
              </div>
            )}
            {importResult.errors.length > 0 && (
              <div style={{ color: "#c33" }}>
                {importResult.errors.map((er, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: i ? 3 : 0 }}>
                    <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{er}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="pos-btn" onClick={() => setImportResult(null)} style={{ fontSize: 11, color: "#999", background: "none", marginTop: 6 }}>
              關閉提示
            </button>
          </div>
        )}
      </div>
      )}

      <div style={{ background: "#1F3A5F", color: "#fff", borderRadius: 10, padding: "4px 12px", marginBottom: 12 }}>
        <StoreSchoolSwitcher
          schools={schools}
          schoolMeta={schoolMeta}
          selectedSchool={selectedSchool}
          onPick={(school) => {
            if (school && school !== "all") setSelectedSchool(school);
          }}
        />
      </div>

      {/* 學校分類管理：幫每間學校設定 階段/地區/18區，令「銷售」分頁揀學校更好搵 */}
      {canManageSchools && schools.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button
            className="pos-btn"
            onClick={() => setShowClassifyPanel((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#1F3A5F", background: "#EEF1F5", padding: "8px 12px", borderRadius: 8, width: "100%", justifyContent: "space-between" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={13} /> 學校分類設定（階段／地區／18區）
            </span>
            {showClassifyPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showClassifyPanel && (
            <div style={{ background: "#fff", border: "1px solid #E5E5E0", borderRadius: 10, marginTop: 6, padding: 10 }}>
              <div style={{ fontSize: 11, color: "#999", marginBottom: 8, lineHeight: 1.5 }}>
                幫每間學校揀返教育階段同所屬18區，「銷售」分頁揀學校時就可以逐層篩選，唔使成頁滾動搵。未設定嘅學校會歸類做「未分類」。
              </div>
              {schools.map((sc) => {
                const m = metaOf(schoolMeta, sc);
                const region = m.region && HK_REGIONS.includes(m.region) ? m.region : "";
                return (
                  <div key={sc} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) repeat(3, minmax(0, 1fr))", gap: 6, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F0F0EC" }}>
                    <div style={{ minWidth: 0, fontSize: 12, fontWeight: 500, overflowWrap: "anywhere" }}>{sc}</div>
                    <select
                      value={m.level || ""}
                      onChange={(e) => saveSchoolMeta({ ...schoolMeta, [sc]: { ...m, level: e.target.value } })}
                      style={{ width: "100%", minWidth: 0, padding: 5, borderRadius: 6, border: "1px solid #ccc", fontSize: 11, boxSizing: "border-box" }}
                    >
                      <option value="">階段？</option>
                      {SCHOOL_LEVELS.map((lv) => (
                        <option key={lv} value={lv}>{lv}</option>
                      ))}
                    </select>
                    <select
                      value={region}
                      onChange={(e) => {
                        const r = e.target.value;
                        saveSchoolMeta({ ...schoolMeta, [sc]: { ...m, region: r, district: HK_DISTRICTS[r] ? HK_DISTRICTS[r][0] : "" } });
                      }}
                      style={{ width: "100%", minWidth: 0, padding: 5, borderRadius: 6, border: "1px solid #ccc", fontSize: 11, boxSizing: "border-box" }}
                    >
                      <option value="">地區？</option>
                      {HK_REGIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <select
                      value={m.district || ""}
                      onChange={(e) => saveSchoolMeta({ ...schoolMeta, [sc]: { ...m, district: e.target.value } })}
                      disabled={!region}
                      style={{ width: "100%", minWidth: 0, padding: 5, borderRadius: 6, border: "1px solid #ccc", fontSize: 11, boxSizing: "border-box", background: region ? "#fff" : "#F0F0EC" }}
                    >
                      <option value="">18區？</option>
                      {(HK_DISTRICTS[region] || []).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {visibleProducts.map((p, productIndex) => (
        <div key={p.id} style={{ background: "#fff", border: "1px solid #E5E5E0", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <button
              className="pos-btn"
              onClick={() => setExpanded(expanded === p.id ? null : p.id)}
              style={{ flex: 1, minWidth: 0, padding: "12px 14px", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
            <span style={{ textAlign: "left" }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</span>
              <span style={{ fontSize: 11, color: "#999", marginLeft: 6 }}>{schoolOf(p)}</span>
            </span>
            {expanded === p.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <div style={{ display: "flex", flexDirection: "column", borderLeft: "1px solid #E5E5E0" }}>
              <button className="pos-btn" onClick={() => moveProductToBoundary(p.id, "start")} disabled={productIndex === 0} title="移到最前" style={{ flex: 1, padding: "4px 8px", background: "#fff", color: "#1F3A5F" }}><ChevronsUp size={14} /></button>
              <button className="pos-btn" onClick={() => moveProduct(p.id, -1)} disabled={productIndex === 0} title="向上移動" style={{ flex: 1, padding: "4px 8px", background: "#fff", color: "#1F3A5F" }}><ArrowUp size={14} /></button>
              <button className="pos-btn" onClick={() => moveProduct(p.id, 1)} disabled={productIndex === visibleProducts.length - 1} title="向下移動" style={{ flex: 1, padding: "4px 8px", background: "#fff", color: "#1F3A5F" }}><ArrowDown size={14} /></button>
              <button className="pos-btn" onClick={() => moveProductToBoundary(p.id, "end")} disabled={productIndex === visibleProducts.length - 1} title="移到最後" style={{ flex: 1, padding: "4px 8px", background: "#fff", color: "#1F3A5F" }}><ChevronsDown size={14} /></button>
            </div>
          </div>
          {expanded === p.id && (
            <div style={{ padding: "0 14px 14px" }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>所屬學校{!canManageSchools && "（只有管理員可以改）"}</div>
              <input
                value={p.school || ""}
                onChange={(e) => updateProduct(p.id, { ...p, school: e.target.value })}
                placeholder="例如：聖X小學"
                list="school-suggestions"
                disabled={!canManageSchools}
                style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box", background: canManageSchools ? "#fff" : "#F0F0EC", color: canManageSchools ? "#000" : "#888" }}
              />
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{hasLengthOptions(p) ? `款式名稱（長度 → ${sizeDimensionLabel(p)} → 價錢）` : "款式名稱（尺碼 → 價錢）"}</div>
              <input
                value={p.name}
                onChange={(e) => updateProduct(p.id, { ...p, name: e.target.value })}
                placeholder="款式名稱"
                style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }}
              />
              {p.sizes.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  {hasLengthOptions(p) && (
                    <input
                      value={s.length || ""}
                      onChange={(e) => {
                        const sizes = [...p.sizes];
                        sizes[i] = { ...sizes[i], length: e.target.value };
                        updateProduct(p.id, { ...p, sizes });
                      }}
                      placeholder="長度"
                      style={{ width: 70, padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 }}
                    />
                  )}
                  <input
                    value={s.size}
                    onChange={(e) => {
                      const sizes = [...p.sizes];
                      sizes[i] = { ...sizes[i], size: e.target.value };
                      updateProduct(p.id, { ...p, sizes });
                    }}
                    placeholder={hasLengthOptions(p) ? sizeDimensionLabel(p) : "尺碼"}
                    style={{ width: 70, padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 }}
                  />
                  <input
                    type="number"
                    value={s.price}
                    onChange={(e) => {
                      const sizes = [...p.sizes];
                      sizes[i] = { ...sizes[i], price: Number(e.target.value) };
                      updateProduct(p.id, { ...p, sizes });
                    }}
                    placeholder="價錢"
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 }}
                  />
                  <button
                    className="pos-btn"
                    onClick={() => {
                      const sizes = p.sizes.filter((_, idx) => idx !== i);
                      updateProduct(p.id, { ...p, sizes });
                    }}
                    style={{ width: 34, borderRadius: 8, background: "#fff", border: "1px solid #eee", color: "#c33" }}
                  >
                    <X size={14} style={{ margin: "auto" }} />
                  </button>
                </div>
              ))}
              <button
                className="pos-btn"
                onClick={() => updateProduct(p.id, { ...p, sizes: [...p.sizes, { size: "", length: "", price: 0 }] })}
                style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, background: "#F0F0EC", border: "1px solid #ddd", marginTop: 2 }}
              >
                + 加碼數
              </button>
              <button
                className="pos-btn"
                onClick={() => {
                  setLengthPromptProductId(p.id);
                  setLengthDraft("");
                }}
                style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, background: "#F0F0EC", border: "1px solid #ddd", marginTop: 2, marginLeft: 8 }}
              >
                + 新增長度
              </button>
              {lengthPromptProductId === p.id && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                  <input
                    value={lengthDraft}
                    onChange={(e) => setLengthDraft(e.target.value)}
                    placeholder="例如 33"
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 }}
                  />
                  <button
                    className="pos-btn"
                    onClick={() => addProductLength(p, lengthDraft)}
                    style={{ padding: "8px 10px", borderRadius: 8, background: "#1F3A5F", color: "#fff", fontSize: 12 }}
                  >
                    確定
                  </button>
                  <button
                    className="pos-btn"
                    onClick={() => {
                      setLengthPromptProductId(null);
                      setLengthDraft("");
                    }}
                    style={{ padding: "8px 10px", borderRadius: 8, background: "#fff", border: "1px solid #ddd", color: "#555", fontSize: 12 }}
                  >
                    取消
                  </button>
                </div>
              )}
              {canManageSchools && (
                <button
                  className="pos-btn"
                  onClick={() => deleteProduct(p.id)}
                  style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, background: "#fff", border: "1px solid #f0c0c0", color: "#c33", marginTop: 2, marginLeft: 8 }}
                >
                  刪除呢個款式
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {addingSchool && (
        <div style={{ marginBottom: 10, background: "#F7F7F5", padding: 12, borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>學校名稱</div>
          <input
            ref={newSchoolInputRef}
            value={newSchoolName}
            onChange={(e) => {
              setNewSchoolName(e.target.value);
              setNewSchoolError("");
            }}
            onBlur={(e) => {
              window.setTimeout(() => applyCatalogToNewSchool(e.target.value), 0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmAddSchool();
              if (e.key === "Escape") setAddingSchool(false);
            }}
            placeholder="輸入新學校 / 幼稚園 / 中學名稱"
            style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }}
          />
          {schoolSuggestions.length > 0 && (
            <div style={{ display: "grid", gap: 4, marginTop: -6, marginBottom: 8 }}>
              {schoolSuggestions.map((school) => (
                <button
                  key={school}
                  type="button"
                  className="pos-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSchoolSuggestion(school)}
                  style={{ padding: "7px 9px", textAlign: "left", background: "#fff", border: "1px solid #DDE8E5", borderRadius: 6, fontSize: 13 }}
                >
                  {school}
                </button>
              ))}
            </div>
          )}
          {newSchoolError && <div style={{ color: "#B42318", fontSize: 12, marginTop: -4, marginBottom: 8 }}>{newSchoolError}</div>}

          <div style={{ fontSize: 11, color: "#28784B", minHeight: 16, marginBottom: 6 }}>
            {newSchoolCategory ? `已匹配官方資料：${newSchoolCategory}` : "輸入完整學校名稱後會自動匹配官方資料"}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>教育階段</div>
              <select
                value={newSchoolLevel}
                onChange={(e) => setNewSchoolLevel(e.target.value)}
                style={{ width: "100%", padding: 7, borderRadius: 8, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
              >
                {SCHOOL_LEVELS.map((lv) => (
                  <option key={lv} value={lv}>{lv}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>地區</div>
              <select
                value={newSchoolRegion}
                onChange={(e) => {
                  const r = e.target.value;
                  setNewSchoolRegion(r);
                  setNewSchoolDistrict(HK_DISTRICTS[r][0]);
                }}
                style={{ width: "100%", padding: 7, borderRadius: 8, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
              >
                {HK_REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>所屬門店</div>
              <select
                value={newSchoolOutlet}
                onChange={(e) => setNewSchoolOutlet(e.target.value)}
                style={{ width: "100%", padding: 7, borderRadius: 8, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
              >
                {OUTLETS.map((outlet) => <option key={outlet.name} value={outlet.name}>{outlet.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>18區</div>
              <select
                value={newSchoolDistrict}
                onChange={(e) => setNewSchoolDistrict(e.target.value)}
                style={{ width: "100%", padding: 7, borderRadius: 8, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
              >
                {HK_DISTRICTS[newSchoolRegion].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="pos-btn"
              onClick={confirmAddSchool}
              style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "#1F3A5F", color: "#fff", fontSize: 13, fontWeight: 500 }}
            >
              確定新增
            </button>
            <button
              className="pos-btn"
              onClick={() => setAddingSchool(false)}
              style={{ padding: "0 16px", borderRadius: 8, background: "#fff", border: "1px solid #ccc", color: "#666", fontSize: 13 }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          className="pos-btn"
          onClick={() => addProduct(activeSchool || "")}
          style={{ flex: 1, padding: "12px 0", borderRadius: 10, background: "#1F3A5F", color: "#fff", fontSize: 14, fontWeight: 500 }}
        >
          + 新增款式
        </button>
        {canManageSchools && (
          <button
            className="pos-btn"
            onClick={openAddSchool}
            style={{ flex: 1, padding: "12px 0", borderRadius: 10, background: "#fff", border: "1px solid #1F3A5F", color: "#1F3A5F", fontSize: 14, fontWeight: 500 }}
          >
            + 新增學校
          </button>
        )}
      </div>
      {canManageSchools && activeSchool && (
        <button
          className="pos-btn"
          onClick={deleteSchool}
          style={{ width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 10, background: "#FFF1F0", border: "1px solid #F0B8B5", color: "#B42318", fontSize: 13, fontWeight: 500 }}
        >
          刪除目前學校
        </button>
      )}
    </div>
  );
}

function RecordsTab({ salesLog, onReprint, canViewAllDates, canExportSales, schoolMeta = {} }) {
  const [date, setDate] = useState(todayStr());
  const [outletFilter, setOutletFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const effectiveDate = canViewAllDates ? date : todayStr();
  const dateOrders = salesLog.filter((o) => o.date === effectiveDate);
  const schoolNames = Array.from(new Set(dateOrders.map((o) => o.school).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  const outletForOrder = (order) => order.outletName || outletNameForSchool(order.school, schoolMeta);
  const availableSchools = schoolNames.filter((school) => !outletFilter || outletForOrder({ school }) === outletFilter);
  const dayOrders = dateOrders.filter((o) => (!outletFilter || outletForOrder(o) === outletFilter) && (!schoolFilter || o.school === schoolFilter));
  const dayTotal = dayOrders.reduce((s, o) => s + o.total, 0);
  const dayItems = dayOrders.reduce((s, o) => s + o.itemCount, 0);

  const byOutlet = {};
  const bySchool = {};
  dayOrders.forEach((o) => {
    const outlet = outletForOrder(o);
    const school = o.school || "（未指定學校）";
    if (!byOutlet[outlet]) byOutlet[outlet] = { total: 0, count: 0 };
    if (!bySchool[school]) bySchool[school] = { total: 0, count: 0 };
    byOutlet[outlet].total += o.total;
    byOutlet[outlet].count += 1;
    bySchool[school].total += o.total;
    bySchool[school].count += 1;
  });

  const byCashier = {};
  dayOrders.forEach((o) => {
    const key = o.cashierName || "（未記名）";
    if (!byCashier[key]) byCashier[key] = { total: 0, count: 0 };
    byCashier[key].total += o.total;
    byCashier[key].count += 1;
  });

  const handleExportCSV = () => {
    const rows = [["日期", "時間", "單號", "開單員工", "學校", "件數", "總計", "明細"]];
    salesLog.forEach((o) => {
      rows.push([
        o.date,
        o.time,
        o.id,
        o.cashierName || "",
        o.school || "",
        o.itemCount,
        o.total,
        o.items.map((it) => `${it.name}(${sizeLabel({ size: it.size, length: it.length })})x${it.qty}`).join("；"),
      ]);
    });
    downloadCSV(Papa.unparse(rows), `銷售紀錄_${todayStr()}.csv`);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {canViewAllDates ? (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }}
          />
        ) : (
          <div style={{ fontSize: 13, background: "#EEF1F5", padding: "8px 12px", borderRadius: 8, color: "#1F3A5F", fontWeight: 500 }}>
            即時銷售紀錄（{todayStr()}）
          </div>
        )}
        <select value={outletFilter} onChange={(e) => { setOutletFilter(e.target.value); setSchoolFilter(""); }} style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 14, maxWidth: "100%" }}>
          <option value="">全部門店</option>
          {OUTLETS.map((outlet) => <option key={outlet.name} value={outlet.name}>{outlet.name}</option>)}
        </select>
        <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 14, maxWidth: "100%" }}>
          <option value="">全部學校</option>
          {availableSchools.map((school) => <option key={school} value={school}>{school}</option>)}
        </select>
        {canExportSales && (
          <button className="pos-btn" onClick={handleExportCSV} style={{ marginLeft: "auto", fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "#fff", border: "1px solid #1F3A5F", color: "#1F3A5F", display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={13} /> 匯出全部紀錄
          </button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div style={{ background: "#EEF1F5", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, color: "#666" }}>總收入</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{fmt(dayTotal)}</div>
        </div>
        <div style={{ background: "#EEF1F5", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, color: "#666" }}>賣出件數</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{dayItems}</div>
        </div>
      </div>
      {Object.keys(byOutlet).length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>按門店收入</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(byOutlet).map(([name, value]) => <div key={name} style={{ fontSize: 11, background: "#F7F7F5", border: "1px solid #E5E5E0", borderRadius: 8, padding: "5px 8px", color: "#555" }}>{name}：{value.count}單 / {fmt(value.total)}</div>)}
          </div>
        </div>
      )}
      {Object.keys(bySchool).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>按學校收入</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(bySchool).sort(([, a], [, b]) => b.total - a.total).map(([name, value]) => <div key={name} style={{ fontSize: 11, background: "#FFF8F4", border: "1px solid #F0D8CC", borderRadius: 8, padding: "5px 8px", color: "#555" }}>{name}：{value.count}單 / {fmt(value.total)}</div>)}
          </div>
        </div>
      )}
      {Object.keys(byCashier).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {Object.entries(byCashier).map(([name, v]) => (
            <div key={name} style={{ fontSize: 11, background: "#F7F7F5", border: "1px solid #E5E5E0", borderRadius: 8, padding: "4px 8px", color: "#555" }}>
              {name}：{v.count}單 / {fmt(v.total)}
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>{dayOrders.length} 張單</div>
      {dayOrders.length === 0 && <div style={{ fontSize: 13, color: "#999" }}>呢日未有交易記錄</div>}
      {dayOrders.map((o) => (
        <div key={o.id} style={{ background: "#fff", border: "1px solid #E5E5E0", borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{o.time} · {o.itemCount}件 · #{(o.id || "").slice(0, 6).toUpperCase()}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{o.items.map((it) => `${it.name}(${sizeLabel({ size: it.size, length: it.length })})x${it.qty}`).join("、")}</div>
            {o.cashierName && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>開單：{o.cashierName}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(o.total)}</div>
            <button className="pos-btn" onClick={() => onReprint(o)} style={{ fontSize: 11, color: "#1F3A5F", background: "none", marginTop: 2 }}>
              重印
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReceiptQR({ order }) {
  const [status, setStatus] = useState("loading");
  const [modules, setModules] = useState(null);
  const qrText = buildReceiptUrl(order);

  useEffect(() => {
    setStatus("loading");
    setModules(null);
    try {
      const qr = qrcode(0, "L");
      qr.addData(qrText);
      qr.make();
      const count = qr.getModuleCount();
      const grid = [];
      for (let r = 0; r < count; r++) {
        const row = [];
        for (let c = 0; c < count; c++) row.push(qr.isDark(r, c));
        grid.push(row);
      }
      setModules(grid);
      setStatus("ok");
    } catch (e) {
      console.error("QR產生失敗", e);
      setStatus("error");
    }
  }, [qrText]);

  const size = 176;
  const cell = modules && modules.length ? size / modules.length : 0;

  return (
    <div
      style={{
        background: "#FAFAF8",
        border: "1px dashed #ccc",
        borderRadius: 10,
        padding: "16px 14px 14px",
        marginBottom: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#1F3A5F", marginBottom: 10 }}>
        <QrCode size={15} /> 客人專屬 QR Code
      </div>

      <div
        style={{
          width: 176,
          height: 176,
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #E5E5E0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {status === "error" && (
          <div style={{ fontSize: 11, color: "#c33", textAlign: "center", padding: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <AlertCircle size={16} />
            無法產生 QR Code
            <br />
            請重新開啟呢張收據再試
          </div>
        )}
        {status === "loading" && <div style={{ fontSize: 11, color: "#999" }}>產生緊…</div>}
        {status === "ok" && modules && (
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
            <rect x={0} y={0} width={size} height={size} fill="#fff" />
            {modules.map((row, r) =>
              row.map((dark, c) =>
                dark ? (
                  <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell + 0.3} height={cell + 0.3} fill="#000" />
                ) : null
              )
            )}
          </svg>
        )}
      </div>

      <div style={{ fontSize: 11, color: "#999", marginTop: 8 }}>單號 {order.id}</div>
      <div style={{ fontSize: 12, color: "#666", marginTop: 6, textAlign: "center", lineHeight: 1.5 }}>
        請客人掃描後開啟電子收據頁，
        <br />
        可列印或另存為 PDF
      </div>
    </div>
  );
}

function ReceiptModal({ order, onClose, onPrintBrowser, onPrintBluetooth, btStatus }) {
  const openCustomerReceipt = () => {
    const receiptUrl = buildReceiptUrl(order);
    const anchor = document.createElement("a");
    anchor.href = receiptUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, maxWidth: 340, width: "100%", padding: 20, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>交易完成</div>
          <button className="pos-btn" onClick={onClose} style={{ background: "none" }}>
            <X size={18} />
          </button>
        </div>

        <ReceiptQR order={order} />

        <div style={{ background: "#FAFAF8", border: "1px dashed #ccc", borderRadius: 8, padding: 12, fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13 }}>Victoria Uniform 校服銷售</div>
          <div style={{ textAlign: "center", color: "#888", fontSize: 11 }}>電子銷售單 ELECTRONIC RECEIPT</div>
          <div style={{ marginTop: 4 }}>收據編號：#{(order.id || "").toUpperCase()}</div>
          <div>交易日期：{order.date} {order.time}</div>
          <div>學校：{order.school || "-"}</div>
          <div>--------------------------------</div>
          <div>商品明細</div>
          {order.items.map((it, i) => (
            <div key={i}>
              <div>{it.name}</div>
              <div>  {formatSizeForReceipt(it.name, it.size, it.length)}</div>
              <div>  數量 {it.qty} x {fmt(it.price)} = {fmt(it.price * it.qty)}</div>
            </div>
          ))}
          <div>--------------------------------</div>
          <div>商品件數：{order.itemCount}</div>
          <div>應付總額：{fmt(order.total)}</div>
          <div>實收現金：{fmt(order.cashReceived ?? order.total)}</div>
          <div style={{ fontWeight: 700 }}>找續：{fmt(Math.max(order.changeDue ?? 0, 0))}</div>
          <div>交易狀態：已完成</div>
          <div style={{ marginTop: 8, color: "#555", lineHeight: 1.5 }}>
            換貨條款：全新校服可於購買日起一個月內到指定門店換貨。<br />
            不設退款；貨品必須未經洗滌、未曾使用，並保留完整吊牌及剪牌，否則恕不接受換貨。
          </div>
          <div style={{ textAlign: "center", marginTop: 6, color: "#888" }}>多謝惠顧，歡迎重臨</div>
        </div>

        <button
          className="pos-btn"
          onClick={openCustomerReceipt}
          title="打開客人可以掃描及查看的電子收據頁"
          style={{ width: "100%", padding: "13px 0", borderRadius: 10, background: "#1F3A5F", color: "#fff", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}
        >
          <QrCode size={16} /> 查看客人電子收據
        </button>
        <button
          className="pos-btn"
          onClick={onPrintBluetooth}
          title="只適用於支援 Web Bluetooth 的兼容打印機"
          style={{ width: "100%", padding: "12px 0", borderRadius: 10, background: "#fff", border: "1px solid #1F3A5F", color: "#1F3A5F", fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Bluetooth size={16} /> 藍牙打印機列印（需兼容）
        </button>
        <div style={{ marginTop: 8, color: "#888", fontSize: 11, lineHeight: 1.5, textAlign: "center" }}>
          上方按鈕會打開客人電子收據頁；藍牙打印機未必支援直接連接。
        </div>

        {btStatus.state !== "idle" && (
          <div style={{ marginTop: 10, fontSize: 12, color: btStatus.state === "error" ? "#c33" : "#1F3A5F", display: "flex", gap: 6, alignItems: "flex-start" }}>
            {btStatus.state === "error" ? <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <Check size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
            <span>{btStatus.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SchoolChip({ label, selected, onClick, sub }) {
  return (
    <button
      className="pos-btn"
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        background: selected ? "#D97757" : "rgba(255,255,255,0.12)",
        color: "#fff",
        border: "1px solid " + (selected ? "#D97757" : "rgba(255,255,255,0.3)"),
        fontSize: 13,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 1,
      }}
    >
      <span>{label}</span>
      {sub != null && <span style={{ fontSize: 10, opacity: 0.75 }}>{sub}</span>}
    </button>
  );
}

function StoreSchoolSwitcher({ schools, schoolMeta, selectedSchool, onPick }) {
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [schoolType, setSchoolType] = useState(null);
  const [query, setQuery] = useState("");
  const visibleSchools = selectedOutlet ? schools.filter((school) => outletNameForSchool(school, schoolMeta) === selectedOutlet) : [];
  const schoolTypes = ["幼稚園", "小學", "中學", "其他"];
  const typedSchools = schoolType ? visibleSchools.filter((school) => {
    const level = metaOf(schoolMeta, school).level;
    return schoolType === "其他" ? !["幼稚園", "小學", "中學"].includes(level) : level === schoolType;
  }) : [];
  const matchedSchools = query.trim() ? typedSchools.filter((school) => school.includes(query.trim())) : typedSchools;
  if (!selectedOutlet) return <div style={{ marginTop: 12, paddingBottom: 4 }}><div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>第一步：揀門店</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{OUTLETS.map((outlet) => <SchoolChip key={outlet.name} label={outlet.name} sub={`${schools.filter((school) => outletNameForSchool(school, schoolMeta) === outlet.name).length}間學校`} selected={false} onClick={() => { setSelectedOutlet(outlet.name); setSchoolType(null); setQuery(""); }} />)}</div></div>;
  if (!schoolType) return <div style={{ marginTop: 12, paddingBottom: 4 }}><button className="pos-btn" onClick={() => setSelectedOutlet(null)} style={{ background: "none", color: "rgba(255,255,255,0.75)", fontSize: 11, padding: 0, marginBottom: 8 }}>更改分店</button><div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>第二步：揀學校類別</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{schoolTypes.map((type) => <SchoolChip key={type} label={type} sub={`${visibleSchools.filter((school) => { const level = metaOf(schoolMeta, school).level; return type === "其他" ? !schoolTypes.slice(0, 3).includes(level) : level === type; }).length}間學校`} selected={false} onClick={() => { setSchoolType(type); setQuery(""); }} />)}</div></div>;
  return <div style={{ marginTop: 12, paddingBottom: 4 }}><button className="pos-btn" onClick={() => { setSchoolType(null); setQuery(""); }} style={{ background: "none", color: "rgba(255,255,255,0.75)", fontSize: 11, padding: 0, marginBottom: 8 }}>更改學校類別</button>{typedSchools.length > 6 && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋學校名稱…" style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />}<div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>第三步：揀學校（{typedSchools.length}間）</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{matchedSchools.length ? matchedSchools.map((school) => <SchoolChip key={school} label={school} selected={selectedSchool === school} onClick={() => onPick(school)} />) : <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>此分類沒有學校。</div>}</div></div>;
}

function SchoolSwitcher({ schools, schoolMeta, selectedSchool, onPick }) {
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [schoolType, setSchoolType] = useState(null);
  const [query, setQuery] = useState("");

  const visibleSchools = selectedOutlet ? schools.filter((school) => outletNameForSchool(school, schoolMeta) === selectedOutlet) : schools;
  const typedSchools = schoolType ? visibleSchools.filter((school) => {
    const level = metaOf(schoolMeta, school).level;
    return schoolType === "其他" ? level !== "小學" && level !== "中學" : level === schoolType;
  }) : visibleSchools;

  const box = { marginTop: 12, paddingBottom: 4 };
  const searchInput = (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.6 }} />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜尋學校名稱…"
        style={{
          width: "100%",
          padding: "8px 10px 8px 30px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.35)",
          background: "rgba(255,255,255,0.12)",
          color: "#fff",
          fontSize: 13,
          boxSizing: "border-box",
          outline: "none",
        }}
      />
    </div>
  );

  const outletSelector = (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>第一步：揀門店</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {OUTLETS.map((outlet) => {
          const count = schools.filter((school) => outletNameForSchool(school, schoolMeta) === outlet.name).length;
          return <SchoolChip key={outlet.name} label={outlet.name} sub={`${count}間學校`} selected={false} onClick={() => { setSelectedOutlet(outlet.name); setSchoolType(null); setQuery(""); }} />;
        })}
      </div>
    </div>
  );

  if (!selectedOutlet) {
    return <div style={box}>{outletSelector}</div>;
  }

  if (!schoolType) {
    const typeCounts = ["小學", "中學", "其他"].map((type) => [type, visibleSchools.filter((school) => {
      const level = metaOf(schoolMeta, school).level;
      return type === "其他" ? level !== "小學" && level !== "中學" : level === type;
    }).length]);
    return (
      <div style={box}>
        <button className="pos-btn" onClick={() => setSelectedOutlet(null)} style={{ background: "none", color: "rgba(255,255,255,0.75)", fontSize: 11, padding: 0, marginBottom: 8 }}>更改分店</button>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>第二步：揀學校類別</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {typeCounts.map(([type, count]) => <SchoolChip key={type} label={type} sub={`${count}間學校`} selected={false} onClick={() => { setSchoolType(type); setQuery(""); }} />)}
        </div>
      </div>
    );
  }

  if (query.trim()) {
    const q = query.trim();
    const matched = typedSchools.filter((sc) => sc.includes(q));
    return (
      <div style={box}>
        <button className="pos-btn" onClick={() => setSchoolType(null)} style={{ background: "none", color: "rgba(255,255,255,0.75)", fontSize: 11, padding: 0, marginBottom: 8 }}>更改學校類別</button>
        {searchInput}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {matched.length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>搵唔到「{q}」</div>}
          {matched.map((sc) => (
            <SchoolChip key={sc} label={sc} selected={selectedSchool === sc} onClick={() => onPick(sc)} />
          ))}
        </div>
      </div>
    );
  }

  if (useFlat) {
    return (
      <div style={box}>
        {outletSelector}
        {schools.length > 6 && searchInput}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {visibleSchools.map((sc) => (
            <SchoolChip key={sc} label={sc} selected={selectedSchool === sc} onClick={() => onPick(sc)} />
          ))}
        </div>
      </div>
    );
  }

  const Breadcrumb = () => (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.85)", marginBottom: 10 }}>
      <button className="pos-btn" onClick={() => { setLevel(null); setRegion(null); setDistrict(null); }} style={{ background: "none", color: level ? "rgba(255,255,255,0.7)" : "#fff", fontWeight: level ? 400 : 600, display: "flex", alignItems: "center", gap: 3 }}>
        {level && <ChevronLeft size={12} />} 階段
      </button>
      {level && (
        <>
          <span style={{ opacity: 0.5 }}>/</span>
          <button className="pos-btn" onClick={() => { setRegion(null); setDistrict(null); }} style={{ background: "none", color: region ? "rgba(255,255,255,0.7)" : "#fff", fontWeight: region ? 400 : 600, display: "flex", alignItems: "center", gap: 3 }}>
            {region && <ChevronLeft size={12} />} {level}
          </button>
        </>
      )}
      {region && (
        <>
          <span style={{ opacity: 0.5 }}>/</span>
          <button className="pos-btn" onClick={() => setDistrict(null)} style={{ background: "none", color: district ? "rgba(255,255,255,0.7)" : "#fff", fontWeight: district ? 400 : 600, display: "flex", alignItems: "center", gap: 3 }}>
            {district && <ChevronLeft size={12} />} {region}
          </button>
        </>
      )}
      {district && (
        <>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: "#fff", fontWeight: 600 }}>{district}</span>
        </>
      )}
    </div>
  );
}
    /*
      <button className="pos-btn" onClick={() => setFlatOverride(true)} style={{ marginLeft: "auto", background: "none", color: "rgba(255,255,255,0.6)", fontSize: 11, textDecoration: "underline" }}>
        睇晒全部
      <button className="pos-btn" onClick={submit} disabled={busy} style={{ width: "100%", padding: "12px 0", borderRadius: 10, background: "#1F3A5F", color: "#fff", fontSize: 15, fontWeight: 600 }}>{busy ? "儲存中…" : "儲存密碼並登入"}</button>
    </div>
          <button className="pos-btn" onClick={() => setSchoolType(null)} style={{ background: "none", color: "rgba(255,255,255,0.75)", fontSize: 11, padding: 0, marginBottom: 8 }}>更改學校類別</button>
          {typedSchools.length > 6 && searchInput}
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>第三步：揀學校</div>
 */
function PublicHomePage({ schools = [], schoolMeta = {}, onStaffLogin }) {
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedSchoolForRegistration, setSelectedSchoolForRegistration] = useState("");

  const schoolOptions = [...new Set(schools.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));

  const levelOptions = SCHOOL_LEVELS.map((level) => ({
    level,
    count: schoolOptions.filter((school) => {
      const meta = metaOf(schoolMeta, school);
      const schoolLevel = meta.level || "其他";
      return level === "其他" ? !["幼稚園", "小學", "中學"].includes(schoolLevel) : schoolLevel === level;
    }).length,
  }));

  const levelFilteredSchools = selectedLevel
    ? schoolOptions.filter((school) => {
        const meta = metaOf(schoolMeta, school);
        const schoolLevel = meta.level || "其他";
        return selectedLevel === "其他" ? !["幼稚園", "小學", "中學"].includes(schoolLevel) : schoolLevel === selectedLevel;
      })
    : schoolOptions;

  const regionOptions = [...new Set(levelFilteredSchools.map((school) => metaOf(schoolMeta, school).region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));

  const regionFilteredSchools = selectedRegion
    ? levelFilteredSchools.filter((school) => (metaOf(schoolMeta, school).region || "其他") === selectedRegion)
    : levelFilteredSchools;

  const handleLevelSelect = (level) => {
    setSelectedLevel(level);
    setSelectedRegion(null);
    setSelectedSchoolForRegistration("");
  };

  const handleRegionSelect = (region) => {
    setSelectedRegion(region);
    setSelectedSchoolForRegistration("");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7FB", padding: "32px 16px", boxSizing: "border-box", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ background: "#1F3A5F", color: "#fff", borderRadius: 18, padding: "28px 24px" }}>
          <div style={{ fontSize: 13, opacity: 0.78, marginBottom: 8 }}>Victoria Uniform 校服銷售系統</div>
          <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.35 }}>歡迎使用</h1>
          <div style={{ marginTop: 10, fontSize: 14, opacity: 0.82 }}>請選擇你要使用的服務</div>
        </div>

        <div style={{ border: "1px solid #D5DDE5", borderRadius: 14, background: "#fff", padding: 22 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#1F3A5F" }}>登記學校</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#66717D" }}>請按步驟選擇學校，再進行客人登記</div>

          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8, fontWeight: 700 }}>第一步：選擇學校類別</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {levelOptions.map(({ level, count }) => (
                  <button
                    key={level}
                    type="button"
                    className="pos-btn"
                    onClick={() => handleLevelSelect(level)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 10,
                      background: selectedLevel === level ? "#1F3A5F" : "#F3F6FA",
                      color: selectedLevel === level ? "#fff" : "#1F3A5F",
                      border: "1px solid " + (selectedLevel === level ? "#1F3A5F" : "#D5DDE5"),
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {level} ({count})
                  </button>
                ))}
              </div>
            </div>

            {selectedLevel && (
              <div>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8, fontWeight: 700 }}>第二步：選擇地區</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {regionOptions.length > 0 ? (
                    regionOptions.map((region) => (
                      <button
                        key={region}
                        type="button"
                        className="pos-btn"
                        onClick={() => handleRegionSelect(region)}
                        style={{
                          padding: "9px 12px",
                          borderRadius: 10,
                          background: selectedRegion === region ? "#D97757" : "#F3F6FA",
                          color: selectedRegion === region ? "#fff" : "#1F3A5F",
                          border: "1px solid " + (selectedRegion === region ? "#D97757" : "#D5DDE5"),
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {region}
                      </button>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: "#66717D" }}>此類別暫無地區資料</div>
                  )}
                </div>
              </div>
            )}

            {selectedRegion && (
              <div>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8, fontWeight: 700 }}>第三步：選擇學校</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
                  {regionFilteredSchools.length > 0 ? (
                    regionFilteredSchools.map((school) => (
                      <button
                        key={school}
                        type="button"
                        className="pos-btn"
                        onClick={() => setSelectedSchoolForRegistration(school)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: selectedSchoolForRegistration === school ? "#EAF4FF" : "#fff",
                          border: "1px solid " + (selectedSchoolForRegistration === school ? "#9BC3EC" : "#D5DDE5"),
                          color: "#1F3A5F",
                          fontSize: 14,
                          fontWeight: selectedSchoolForRegistration === school ? 700 : 500,
                        }}
                      >
                        {school}
                      </button>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: "#66717D" }}>此區域暫無學校資料</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!selectedSchoolForRegistration}
            onClick={() => navigate(`/checkin?school_id=${encodeURIComponent(selectedSchoolForRegistration)}`)}
            style={{ width: "100%", marginTop: 18, border: "none", borderRadius: 10, background: selectedSchoolForRegistration ? "#1F3A5F" : "#C7D0DA", color: "#fff", padding: "12px 16px", fontWeight: 800, cursor: selectedSchoolForRegistration ? "pointer" : "not-allowed" }}
          >
            開始登記
          </button>
        </div>

        <button type="button" onClick={onStaffLogin} style={{ border: "none", borderRadius: 14, background: "#D97757", color: "#fff", padding: 22, textAlign: "left", cursor: "pointer" }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>登入後台</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.88 }}>員工登入、銷售、度身、取貨及收銀</div>
        </button>
      </div>
    </div>
  );
}

function LoginScreen({ accounts, onLogin, onAuthLogin, useSupabaseAuth = false }) {
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = () => {
    const acc = accounts.find((a) => a.pin === pin.trim());
    if (!acc) {
      setError("PIN唔啱，請再試（或請管理員檢查「員工」設定）");
      setPin("");
      return;
    }
    setError("");
    onLogin(acc);
  };

  const submitAuth = async () => {
    if (!email.trim() || !password) {
      setError("請輸入電郵及密碼。");
      return;
    }
    setSubmitting(true);
    const result = await onAuthLogin(email.trim(), password);
    setError(result.error);
    setSubmitting(false);
  };

  return (
    <div style={{ maxWidth: 340, margin: "60px auto", fontFamily: "system-ui, -apple-system, sans-serif", padding: "0 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1F3A5F" }}>校服銷售系統</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{useSupabaseAuth ? "請使用員工電郵登入" : "請輸入你嘅員工 PIN 登入"}</div>
      </div>

      {useSupabaseAuth ? (
        <>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitAuth()} placeholder="員工電郵" autoFocus style={{ width: "100%", padding: 14, borderRadius: 10, border: "1px solid #ccc", fontSize: 16, boxSizing: "border-box", marginBottom: 10 }} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitAuth()} placeholder="密碼" style={{ width: "100%", padding: 14, borderRadius: 10, border: "1px solid #ccc", fontSize: 16, boxSizing: "border-box", marginBottom: 10 }} />
        </>
      ) : (
        <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="輸入 PIN" autoFocus style={{ width: "100%", padding: 14, borderRadius: 10, border: "1px solid #ccc", fontSize: 18, textAlign: "center", letterSpacing: 4, boxSizing: "border-box", marginBottom: 10 }} />
      )}
      {error && (
        <div style={{ color: "#c33", fontSize: 12, marginBottom: 10, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}
      <button
        className="pos-btn"
        onClick={useSupabaseAuth ? submitAuth : submit}
        disabled={submitting}
        style={{ width: "100%", padding: "12px 0", borderRadius: 10, background: "#1F3A5F", color: "#fff", fontSize: 15, fontWeight: 600 }}
      >
        {submitting ? "登入中…" : "登入"}
      </button>

      {!useSupabaseAuth && <div style={{ marginTop: 20, fontSize: 11, color: "#aaa", textAlign: "center", lineHeight: 1.6 }}>首次使用預設 PIN：管理員 0000／店長 1111／店員 2222、3333<br />登入後管理員可以喺「員工」分頁改晒PIN</div>}
    </div>
  );
}

function AuthStaffTab({ manageStaff, currentId }) {
  const [staff, setStaff] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [role, setRole] = useState(ROLES.STAFF);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStaff = async () => {
    const result = await manageStaff({ action: "list" });
    if (result.error) setMessage("讀取員工失敗：" + result.error);
    else setStaff(result.data?.staff || []);
  };

  useEffect(() => { loadStaff(); }, []);

  const invite = async () => {
    if (!email.trim() || !name.trim()) {
      setMessage("請輸入員工姓名及電郵。");
      return;
    }
    setBusy(true);
    const result = await manageStaff({ action: "invite", email: email.trim(), display_name: name.trim(), role });
    setMessage(result.error || "已發送邀請電郵。");
    if (!result.error) {
      setEmail("");
      setName("");
      await loadStaff();
    }
    setBusy(false);
  };

  const createWithPassword = async () => {
    if (!email.trim() || !name.trim() || temporaryPassword.length < 8) {
      setMessage("請輸入姓名、電郵及最少 8 個字元的臨時密碼。");
      return;
    }
    setBusy(true);
    const result = await manageStaff({ action: "create_password", email: email.trim(), display_name: name.trim(), password: temporaryPassword, role });
    setMessage(result.error || "帳戶已建立，可以直接登入。");
    if (!result.error) {
      setEmail("");
      setName("");
      setTemporaryPassword("");
      await loadStaff();
    }
    setBusy(false);
  };

  const changeRole = async (id, nextRole) => {
    setBusy(true);
    const result = await manageStaff({ action: "update_role", id, role: nextRole });
    setMessage(result.error || "角色已更新。");
    if (!result.error) await loadStaff();
    setBusy(false);
  };

  const disable = async (id) => {
    if (id === currentId || !window.confirm("確定停用這位員工？")) return;
    setBusy(true);
    const result = await manageStaff({ action: "disable", id });
    setMessage(result.error || "員工已停用。");
    setBusy(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 12 }}><div style={{ fontSize: 12, color: "#666" }}>管理員可在此邀請員工。邀請電郵會由 Supabase 發送，員工自行設定密碼。</div><button className="pos-btn" onClick={loadStaff} disabled={busy} style={{ flexShrink: 0, padding: "6px 8px", borderRadius: 6, background: "#fff", border: "1px solid #ccc", fontSize: 11 }}>重新整理</button></div>
      <div style={{ background: "#F7F7F5", borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="員工姓名" style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid #ccc", boxSizing: "border-box", marginBottom: 8 }} />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="員工電郵" style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid #ccc", boxSizing: "border-box", marginBottom: 8 }} />
        <input type="password" value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} placeholder="臨時密碼（最少 8 字元）" style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid #ccc", boxSizing: "border-box", marginBottom: 8 }} />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid #ccc", boxSizing: "border-box", marginBottom: 8 }}>
          <option value={ROLES.STAFF}>店員</option>
          <option value={ROLES.MANAGER}>店長</option>
          <option value={ROLES.ADMIN}>管理員</option>
        </select>
        <button className="pos-btn" onClick={invite} disabled={busy} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#1F3A5F", color: "#fff", fontWeight: 600 }}>{busy ? "處理中…" : "發送員工邀請"}</button>
        <button className="pos-btn" onClick={createWithPassword} disabled={busy} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#fff", color: "#1F3A5F", border: "1px solid #1F3A5F", fontWeight: 600, marginTop: 8 }}>直接建立帳戶（免電郵）</button>
      </div>
      {message && <div style={{ fontSize: 12, color: message.includes("失敗") || message.includes("請") ? "#B42318" : "#28784B", marginBottom: 10 }}>{message}</div>}
      {staff.map((member) => (
        <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid #eee" }}>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{member.display_name}</div><div style={{ fontSize: 10, color: "#999", overflow: "hidden", textOverflow: "ellipsis" }}>{member.id}</div></div>
          <select value={member.role} onChange={(e) => changeRole(member.id, e.target.value)} disabled={busy} style={{ padding: 6, borderRadius: 6, border: "1px solid #ccc" }}>
            <option value={ROLES.ADMIN}>管理員</option><option value={ROLES.MANAGER}>店長</option><option value={ROLES.STAFF}>店員</option>
          </select>
          <button className="pos-btn" onClick={() => disable(member.id)} disabled={busy || member.id === currentId} style={{ padding: "6px 8px", borderRadius: 6, background: "#fff", border: "1px solid #f0c0c0", color: "#c33" }}>停用</button>
        </div>
      ))}
    </div>
  );
}

function StaffTab({ accounts, saveAccounts, currentId }) {
  const [expanded, setExpanded] = useState(null);
  const [revealedPin, setRevealedPin] = useState(null);

  const updateAccount = (id, next) => {
    saveAccounts(accounts.map((a) => (a.id === id ? next : a)));
  };

  const deleteAccount = (id) => {
    if (id === currentId) {
      alert("唔可以刪除自己目前登入緊嘅帳號");
      return;
    }
    if (accounts.filter((a) => a.role === ROLES.ADMIN).length <= 1 && accounts.find((a) => a.id === id)?.role === ROLES.ADMIN) {
      alert("最少要保留一個管理員帳號");
      return;
    }
    saveAccounts(accounts.filter((a) => a.id !== id));
  };

  const addAccount = () => {
    const na = { id: uid(), name: "新員工", role: ROLES.STAFF, pin: String(Math.floor(1000 + Math.random() * 9000)) };
    saveAccounts([...accounts, na]);
    setExpanded(na.id);
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 12, lineHeight: 1.5 }}>
        管理員先見到呢個分頁。喺度可以新增/刪除員工、改PIN、指派角色。
        每部裝置各自用自己嘅PIN登入，就算同一時間有幾個人喺唔同裝置打單都得。
      </div>
      {accounts.map((a) => (
        <div key={a.id} style={{ background: "#fff", border: "1px solid #E5E5E0", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
          <button
            className="pos-btn"
            onClick={() => setExpanded(expanded === a.id ? null : a.id)}
            style={{ width: "100%", padding: "12px 14px", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span style={{ textAlign: "left" }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</span>
              <span style={{ fontSize: 11, color: "#999", marginLeft: 6 }}>{ROLE_LABEL[a.role]}</span>
              {a.id === currentId && <span style={{ fontSize: 11, color: "#D97757", marginLeft: 6 }}>（目前登入中）</span>}
            </span>
            {expanded === a.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expanded === a.id && (
            <div style={{ padding: "0 14px 14px" }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>姓名</div>
              <input
                value={a.name}
                onChange={(e) => updateAccount(a.id, { ...a, name: e.target.value })}
                style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }}
              />
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>角色</div>
              <select
                value={a.role}
                onChange={(e) => updateAccount(a.id, { ...a, role: e.target.value })}
                style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }}
              >
                <option value={ROLES.ADMIN}>{ROLE_LABEL[ROLES.ADMIN]}</option>
                <option value={ROLES.MANAGER}>{ROLE_LABEL[ROLES.MANAGER]}</option>
                <option value={ROLES.STAFF}>{ROLE_LABEL[ROLES.STAFF]}</option>
              </select>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>PIN（登入用）</div>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <input
                  type={revealedPin === a.id ? "text" : "password"}
                  value={a.pin}
                  onChange={(e) => updateAccount(a.id, { ...a, pin: e.target.value.replace(/\s/g, "") })}
                  style={{ width: "100%", padding: "8px 38px 8px 8px", borderRadius: 8, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box", letterSpacing: revealedPin === a.id ? 0 : 3 }}
                />
                <button
                  type="button"
                  className="pos-btn"
                  onClick={() => setRevealedPin(revealedPin === a.id ? null : a.id)}
                  style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", color: "#888", padding: 4 }}
                  title={revealedPin === a.id ? "隱藏PIN" : "顯示PIN"}
                >
                  {revealedPin === a.id ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                className="pos-btn"
                onClick={() => deleteAccount(a.id)}
                style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, background: "#fff", border: "1px solid #f0c0c0", color: "#c33" }}
              >
                刪除呢個員工帳號
              </button>
            </div>
          )}
        </div>
      ))}
      <button
        className="pos-btn"
        onClick={addAccount}
        style={{ width: "100%", padding: "12px 0", borderRadius: 10, background: "#1F3A5F", color: "#fff", fontSize: 14, fontWeight: 500, marginTop: 4 }}
      >
        + 新增員工
      </button>
    </div>
  );
}
