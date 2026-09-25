import React, { lazy, Suspense, useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import qrcode from "qrcode-generator";
import { useLocation, useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { Plus, Minus, Trash2, Printer, Bluetooth, ChevronDown, ChevronUp, ChevronLeft, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, X, ShoppingCart, Settings, ClipboardList, Check, AlertCircle, Upload, Download, School, Users, Eye, EyeOff, MapPin, GraduationCap, Search, QrCode } from "lucide-react";
import { isSupabaseConfigured, isSupabaseAuthEnabled, supabase } from "./supabaseClient";
import { logStartupCheck, getStartupErrorUI, validateAllEnvVars } from "./config/envValidation";
import { getUserFriendlyError } from "./config/errorHandler";
import { Alert } from "./components/common";
const CustomerCheckinPage = lazy(() => import("./pages/CustomerCheckinPage"));
const QueuePage = lazy(() => import("./pages/QueuePage"));
const FittingPage = lazy(() => import("./pages/FittingPage"));
const PickupPage = lazy(() => import("./pages/PickupPage"));
const CashierVerifyPage = lazy(() => import("./pages/CashierVerifyPage"));
const GuestPortalPage = lazy(() => import("./pages/GuestPortalPage"));
const GuestQueueStatusPage = lazy(() => import("./pages/GuestQueueStatusPage"));
const StaffOrderTracking = lazy(() => import("./pages/StaffOrderTracking"));
const QueueDisplayPage = lazy(() => import("./pages/QueueDisplayPage"));
const DirectoryPage = lazy(() => import("./pages/DirectoryPage"));
import { getHongKongDate, QUEUE_SERVICE, queueOrderService } from "./services/queueOrderService";
import baseSchoolCatalog from "./schoolCatalog.json";
import workbookSchoolCatalog from "./workbookSchoolCatalog.json";
import workbookSchoolOutlets from "./workbookSchoolOutlets.json";
import databaseProductsSnapshot from "../database-products-snapshot.json";
import { loadProducts, saveProducts as saveProductsToStore } from "./data/productsStore";



// 应用启动时进行环境检查
if (typeof window !== 'undefined') {
  logStartupCheck();
}

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

const PRODUCT_CATALOG_FALLBACK = databaseProductsSnapshot;

const fmt = (n) => `$${Math.round(n).toLocaleString("en-HK")}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
const PRICE_MODE_LABELS = {
  simple: "一般尺碼",
  matrix: "長度／袖長 × 腰圍／上圍",
  fixed: "所有尺寸同價",
};
const productPriceMode = (product) => PRICE_MODE_LABELS[product?.priceMode] ? product.priceMode : (hasLengthOptions(product || {}) ? "matrix" : "simple");
const isPricedSize = (size) => size && size.price !== null && size.price !== undefined && Number.isFinite(Number(size.price)) && Number(size.price) >= 0;
const isTailoredSize = (size = {}) => Boolean(
  size.isTailored
  || String(size.size || "").trim() === "裁碼"
  || /^裁碼(?:\s|$)/.test(String(size.length || "").trim()),
);
const isTailoredFlag = (value) => value === true || ["true", "1", "yes", "是", "裁碼"].includes(String(value || "").trim().toLowerCase());
const sizeIdentityKey = (size = {}) => `${isTailoredSize(size) ? "tailored" : "regular"}\u0000${String(size.length || "").replace(/^裁碼\s*/, "")}\u0000${size.size || ""}`;
const customerSurname = (name = "") => String(name || "").trim().replace(/\s+/g, "").slice(0, 1);
const customerPhoneLast4 = (phone = "") => String(phone || "").replace(/\D/g, "").slice(-4);
const sizeLabel = (size) => size.length ? `${size.isTailored ? "裁碼 " : ""}${size.length}／${size.size}` : size.size;
const productUnit = (name = "") => {
  const normalizedName = String(name || "").replace(/\s+/g, "");
  if (/襪.*[（(]?\d+對|[（(]3對[）)]/.test(normalizedName)) return "包";
  if (/襪|鞋|手套/.test(normalizedName)) return "對";
  if (/套裝|套服/.test(normalizedName)) return "套";
  if (/皮帶|腰帶|領帶|頸巾|圍巾/.test(normalizedName)) return "條";
  if (/書包|背囊|袋|筆袋/.test(normalizedName)) return "個";
  return "件";
};
const hasLengthOptions = (product) => product.sizes.some((size) => size.length);
const dimensionLabels = (name = "") => {
  const normalizedName = String(name || "").replace(/\s+/g, "");
  if (/裙/.test(normalizedName)) return { length: "裙長", size: "上圍" };
  if (/長袖.*(?:恤衫|襯衫)|(?:恤衫|襯衫).*長袖/.test(normalizedName)) return { length: "袖長", size: "領圍" };
  if (/(?:西褲|長褲|短褲|運動褲|褲)/.test(normalizedName)) return { length: "褲長", size: "腰圍" };
  return { length: "", size: "尺碼" };
};
const sizeDimensionLabel = (product) => dimensionLabels(product?.name).size;
const lengthDimensionLabel = (product) => dimensionLabels(product?.name).length;
const sizeDimensionLabels = (product) => {
  const labels = dimensionLabels(product?.name);
  return `${labels.length} → ${labels.size}`;
};
// 用於電子銷售單中的清晰尺碼顯示
const formatSizeForReceipt = (itemName, size, length) => {
  const labels = dimensionLabels(itemName);
  const sizeStr = String(size || "");
  const lengthStr = String(length || "").replace(/^裁碼\s*/, "");
  
  if (lengthStr && sizeStr) {
    return `${labels.length}：${lengthStr}（${labels.size}：${sizeStr}）`;
  } else if (lengthStr) {
    return `${labels.length}：${lengthStr}`;
  } else if (sizeStr) {
    return `${labels.size}：${sizeStr}`;
  } else {
    return `${labels.size}：-`;
  }
};
const naturalSizeSort = (first, second) => {
  const firstText = String(first ?? "").trim();
  const secondText = String(second ?? "").trim();
  const isTailored = (value) => /^裁碼(?:\s|$)/.test(value);
  if (isTailored(firstText) || isTailored(secondText)) {
    if (firstText === secondText) return 0;
    return isTailored(firstText) ? 1 : -1;
  }
  const firstHasLetters = /^[A-Za-z]/.test(firstText);
  const secondHasLetters = /^[A-Za-z]/.test(secondText);
  const firstNumber = Number.parseFloat(first);
  const secondNumber = Number.parseFloat(second);
  if (firstHasLetters || secondHasLetters) {
    if (!firstHasLetters) return 1;
    if (!secondHasLetters) return -1;
    return firstText.localeCompare(secondText, "en", { numeric: true });
  }
  if (Number.isFinite(firstNumber) || Number.isFinite(secondNumber)) {
    if (!Number.isFinite(firstNumber)) return 1;
    if (!Number.isFinite(secondNumber)) return -1;
    if (firstNumber !== secondNumber) return firstNumber - secondNumber;
  }
  const alphaOrder = ["XS", "S", "M", "L", "XL", "XXL"];
  const firstAlpha = alphaOrder.indexOf(firstText.toUpperCase());
  const secondAlpha = alphaOrder.indexOf(secondText.toUpperCase());
  if (firstAlpha >= 0 || secondAlpha >= 0) {
    if (firstAlpha < 0) return 1;
    if (secondAlpha < 0) return -1;
    if (firstAlpha !== secondAlpha) return firstAlpha - secondAlpha;
  }
  return firstText.localeCompare(secondText, "zh-Hant", { numeric: true });
};
const sizeEntrySort = (first, second) => {
  const firstTailored = Boolean(first.isTailored) || /^裁碼(?:\s|$)/.test(String(first.size || "").trim()) || /^裁碼(?:\s|$)/.test(String(first.length || "").trim());
  const secondTailored = Boolean(second.isTailored) || /^裁碼(?:\s|$)/.test(String(second.size || "").trim()) || /^裁碼(?:\s|$)/.test(String(second.length || "").trim());
  if (firstTailored || secondTailored) {
    if (firstTailored === secondTailored) return 0;
    return firstTailored ? 1 : -1;
  }
  return naturalSizeSort(first.length || "", second.length || "") || naturalSizeSort(first.size, second.size);
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
    total: Math.max(0, Number(order.total || 0)),
    refund_due: Math.max(0, Number(order.refundDue || 0)),
    item_count: Number(order.itemCount || 0),
    created_at: new Date().toISOString(),
  };

  if (order.outletName) payload.outlet_name = order.outletName;
  if (order.outletAddress) payload.outlet_address = order.outletAddress;
  if (order.outletPhone) payload.outlet_phone = order.outletPhone;
  if (order.customerName || order.customerPhone) {
    payload.customer_surname = customerSurname(order.customerName);
    payload.customer_phone_last4 = customerPhoneLast4(order.customerPhone);
  }
  if (order.cashierId !== undefined) payload.cashier_id = order.cashierId || null;
  if (order.cashierName) payload.cashier_name = order.cashierName;
  if (order.exchangeSourceReceiptId) payload.exchange_source_receipt_id = order.exchangeSourceReceiptId;
  if (order.branchId) payload.branch_id = order.branchId;

  return payload;
};

const netOrderTotal = (order) => Number(order.total || 0) - Math.max(0, Number(order.refundDue || 0));

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
          Object.entries(orderPayload).filter(([key]) => !["cashier_id", "cashier_name", "outlet_name", "outlet_address", "outlet_phone", "customer_surname", "customer_phone_last4", "refund_due"].includes(key))
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

// 只列出目前商品庫內實際有商品的學校，避免選到空商品學校
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
const normalizeProductSizes = (sizes = []) => sizes.map((size) => ({ ...size }));
const productIdentityParts = (school, name, branchId = "") => {
  const cleaned = cleanProductName(name);
  const genderMatch = cleaned.match(/^(男生|女生|男女生)\s*[-–—:：]?\s*/);
  const gender = genderMatch ? genderMatch[1] : "";
  const cleanedName = cleaned
    .replace(/^(?:男生|女生|男女生)\s*[-–—:：]?\s*/, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[／/、，,\s]/g, "")
    .trim();
  return { school, name: cleanedName, gender, branchId: branchId || "" };
};
const productIdentityKey = (school, name, branchId = "") => {
  const { school: schoolName, name: productName, branchId: productBranchId } = productIdentityParts(school, name, branchId);
  return `${productBranchId}\u0000${schoolName}\u0000${productName}`;
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
  const set = new Set([
    ...products.map(schoolOf),
  ].filter((school) => school && !deletedSchoolsRuntime.has(school)));

  return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hant"));
};
const recoverUniformTrouserOffset = (sizes) => {
  const regular = sizes
    .filter((item) => !item.length && /^(?:23|24|25|26|27|28|29|30)$/.test(String(item.size)))
    .sort((first, second) => Number(first.size) - Number(second.size));
  const values = new Map(regular.map((item) => [String(item.size), Number(item.price)]));
  if (regular.length < 4 || values.get("30") < 130) return sizes;
  if (values.get("30") - values.get("29") !== 7 || values.get("29") - values.get("28") !== 8) return sizes;
  return sizes.map((item) => (
    !item.length && /^(?:23|24|25|26|27|28|29|30)$/.test(String(item.size))
      ? { ...item, price: Number(item.price) - 10 }
      : item
  ));
};
const recoverMissingTailoredTrouserPrices = (productName, sizes) => {
  if (productName !== "男生深炭灰色長西褲") return sizes;

  const hasExplicitTailoredPrice = sizes.some((item) => item.size === "裁碼" || item.isTailored);

  const regularByLength = new Map(
    sizes
      .filter((item) => String(item.size) === "30" && isPricedSize(item))
      .map((item) => [item.length || "", item]),
  );
  const baseWaist = sizes.find((item) => !item.length && String(item.size) === "30" && isPricedSize(item));
  if (!regularByLength.size && !baseWaist) return sizes;

  return sizes.map((item) => {
    const isTailoredSize = item.size === "裁碼"
      || /^(?:32|34|36|38|40|42|44|46|48)$/.test(String(item.size));
    if (!isTailoredSize) return item;
    const base = regularByLength.get(item.length || "") || baseWaist;
    if (!base) return item;
    const isCollapsedPrice = Number(item.price) === Number(base.price);
    if (hasExplicitTailoredPrice && !isCollapsedPrice) return item;
    const surcharge = trouserLengthSurcharge(item.length);
    return {
      ...item,
      price: Number(base.price) + 30 + surcharge,
      isTailored: true,
    };
  });
};
const normalizeProductState = (products) => {
  const normalizedProducts = (Array.isArray(products) ? products : []).map((product) => {
    const productName = cleanProductName(product.name);
    const rawSizes = normalizeProductSizes(product.sizes);
    // Prices are authoritative data. Never recalculate or overwrite them while loading.
    const sizes = rawSizes;
    if (SIMPLE_SIZE_PRODUCT_NAMES.has(productName)) {
      return {
        ...product,
        school: canonicalSchoolName(product.school),
        name: productName,
        sizes,
        priceMode: sizes.some((size) => size.length) ? "matrix" : product.priceMode,
      };
    }
    return {
      ...product,
      school: canonicalSchoolName(product.school),
      name: cleanProductName(product.name),
      priceMode: sizes.some((size) => size.length) ? "matrix" : product.priceMode,
      sizes,
    };
  });

  return normalizedProducts.reduce((result, product) => {
    const productParts = productIdentityParts(schoolOf(product), product.name, product.branch_id);
    const duplicate = result.find((item) => {
      const itemParts = productIdentityParts(schoolOf(item), item.name, item.branch_id);
      return productIdentityKey(itemParts.school, item.name, item.branch_id) === productIdentityKey(productParts.school, product.name, productParts.branchId)
        && compatibleProductGenders(itemParts.gender, productParts.gender);
    });

    if (!duplicate) {
      result.push(product);
      return result;
    }

    if (productPriceMode(product) === "matrix" || hasLengthOptions(product)) {
      duplicate.priceMode = "matrix";
    }
    const sizes = [...(duplicate.sizes || [])];
    (product.sizes || []).forEach((size) => {
      const existingIndex = sizes.findIndex((item) => sizeIdentityKey(item) === sizeIdentityKey(size));
      if (existingIndex < 0) {
        sizes.push(size);
        return;
      }
      const incomingPrice = Number(size.price);
      if (Number.isFinite(incomingPrice)) sizes[existingIndex] = { ...sizes[existingIndex], ...size };
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
const HK_DISTRICT_OPTIONS = Array.from(new Set(Object.values(HK_DISTRICTS).flat())).sort((a, b) => a.localeCompare(b, "zh-Hant"));

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

const explicitOutletNameForSchool = (school, schoolMeta = {}) => (
  schoolMeta[school]?.outletName
  || workbookSchoolOutlets[school]
  || EXTRA_SCHOOL_OUTLETS[school]
  || ""
);
const outletForSchool = (school, schoolMeta = {}) => {
  const explicitOutletName = explicitOutletNameForSchool(school, schoolMeta);
  if (explicitOutletName) {
    return OUTLETS.find((outlet) => outlet.name === explicitOutletName) || { name: explicitOutletName };
  }
  const meta = metaOf(schoolMeta, school);
  const candidates = OUTLETS.filter((outlet) => outlet.districts.includes(meta.district));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1 && school.includes("屯門")) return candidates[0];
  return candidates[0] || OUTLETS.find((outlet) => outlet.region === meta.region) || null;
};
const outletNameForSchool = (school, schoolMeta = {}) => outletForSchool(school, schoolMeta)?.name || "未指定門店";

const UNCLASSIFIED = "未分類";
const schoolCatalog = { ...baseSchoolCatalog, ...workbookSchoolCatalog, ...EXTRA_SCHOOL_CATALOG };
const SCHOOL_CATEGORIES = Array.from(new Set(Object.values(schoolCatalog).map((entry) => entry.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hant"));

// 學校分類資料表：{ 學校名稱: { level, region, district } }
// 冇分類嘅學校（例如舊資料、CSV匯入未指定）一律歸入「未分類」，唔會令佢消失
const metaOf = (schoolMeta, name) => ({ ...(schoolCatalog[name] || {}), ...(schoolMeta[name] || {}) });
const normalizeSchoolLevel = (schoolName, schoolMeta = {}) => {
  const meta = metaOf(schoolMeta, schoolName);
  const explicitLevel = String(meta.level || "").trim();
  if (["幼稚園", "小學", "中學", "其他"].includes(explicitLevel)) return explicitLevel;

  const category = String(meta.category || "").trim();
  const name = String(schoolName || "").trim();
  if (/中學/.test(category) || /中學/.test(name)) return "中學";
  if (/小學/.test(category) || /小學/.test(name)) return "小學";
  if (/幼稚園/.test(category) || /幼稚園/.test(name)) return "幼稚園";

  return "其他";
};
const normalizeSchoolDistrict = (schoolName, schoolMeta = {}) => {
  const meta = metaOf(schoolMeta, schoolName);
  const district = String(meta.district || "").trim();
  if (district) return district;
  const region = String(meta.region || "").trim();
  if (region && HK_DISTRICTS[region]?.length) return HK_DISTRICTS[region][0];
  return "其他";
};

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
  const importedPrices = new Map();

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
    const tailored = isTailoredFlag(row.isTailored) || size === "裁碼" || /^裁碼(?:\s|$)/.test(length);
    const normalizedLength = length.replace(/^裁碼\s*/, "");
    const importKey = `${schoolKey}\u0000${name}\u0000${tailored ? "tailored" : "regular"}\u0000${normalizedLength}\u0000${size}`;
    const previousImportPrice = importedPrices.get(importKey);
    if (previousImportPrice !== undefined && previousImportPrice !== price) {
      errors.push(`第${idx + 2}行：「${name}」${length ? `${length}/` : ""}${size} 出現衝突價格 $${previousImportPrice} 和 $${price}，已停止自動覆蓋。`);
      return;
    }
    importedPrices.set(importKey, price);
    let product = next.find((p) => schoolOf(p) === schoolKey && p.name === name);
    if (!product) {
      product = { id: uid(), school: schoolKey === UNASSIGNED ? "" : schoolKey, name, sizes: [] };
      next.push(product);
      addedProducts++;
    }
    const sizeEntry = product.sizes.find((s) => sizeIdentityKey(s) === sizeIdentityKey({ size, length: normalizedLength, isTailored: tailored }));
    if (sizeEntry) {
      if (sizeEntry.price !== price) updatedSizes++;
      sizeEntry.price = price;
    } else {
      product.sizes.push({ size, length: normalizedLength, price, isTailored: tailored });
      addedSizes++;
    }
  });

  return { next, summary: { addedProducts, addedSizes, updatedSizes }, errors };
};

const normalizeImportHeader = (value) => String(value || "").replace(/\s+/g, "").toLowerCase();
const HIGH_CONFIDENCE_IMPORT_THRESHOLD = 0.95;
const smartImportRows = (rows, existingProducts) => {
  const headerAliases = {
    school: ["學校", "学校", "school"],
    name: ["款式名稱", "款式", "商品名稱", "品名", "name", "product"],
    length: ["長度", "袖長", "褲長", "裙長", "length"],
    size: ["尺碼", "碼數", "腰圍", "上圍", "領圍", "size"],
    price: ["價錢", "價格", "單價", "price"],
  };
  const aliases = Object.fromEntries(Object.entries(headerAliases).flatMap(([key, names]) => names.map((name) => [normalizeImportHeader(name), key])));
  const mappedRows = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [aliases[normalizeImportHeader(key)] || key, value])));
  const previewRows = [];
  const errors = [];
  const next = existingProducts.map((p) => ({ ...p, sizes: p.sizes.map((s) => ({ ...s })) }));
  const importedPrices = new Map();
  let addedProducts = 0;
  let addedSizes = 0;
  let updatedSizes = 0;

  mappedRows.forEach((row, index) => {
    const school = String(row.school || "").trim();
    const name = String(row.name || "").trim();
    const size = String(row.size ?? "").trim();
    const length = String(row.length ?? "").trim();
    const rawPrice = String(row.price ?? "").replace(/[$,\s]/g, "");
    const price = Number(rawPrice);
    if (!name || !size) {
      errors.push(`第${index + 2}行：缺少款式名稱或尺碼，已略過`);
      return;
    }
    if (!rawPrice || !Number.isFinite(price) || price < 0) {
      errors.push(`第${index + 2}行：「${name}」價錢「${row.price ?? ""}」無效，已略過`);
      return;
    }
    const schoolKey = school || UNASSIGNED;
    const tailored = isTailoredFlag(row.isTailored) || size === "裁碼" || /^裁碼(?:\s|$)/.test(length);
    const normalizedLength = length.replace(/^裁碼\s*/, "");
    const importKey = `${schoolKey}\u0000${name}\u0000${tailored ? "tailored" : "regular"}\u0000${normalizedLength}\u0000${size}`;
    const previousImportPrice = importedPrices.get(importKey);
    if (previousImportPrice !== undefined && previousImportPrice !== price) {
      errors.push(`第${index + 2}行：「${name}」${length ? `${length}/` : ""}${size} 出現衝突價格 $${previousImportPrice} 和 $${price}，已停止自動覆蓋。`);
      return;
    }
    importedPrices.set(importKey, price);
    let product = next.find((item) => schoolOf(item) === schoolKey && item.name === name);
    if (!product) {
      product = { id: uid(), school: schoolKey === UNASSIGNED ? "" : schoolKey, name, sizes: [] };
      next.push(product);
      addedProducts++;
    }
    const existing = product.sizes.find((item) => sizeIdentityKey(item) === sizeIdentityKey({ size, length: normalizedLength, isTailored: tailored }));
    const action = existing ? (Number(existing.price) === price ? "無變更" : "更新價格") : "新增尺碼";
    if (existing) {
      if (Number(existing.price) !== price) updatedSizes++;
      existing.price = price;
      existing.isTailored = Boolean(existing.isTailored || row.isTailored);
    } else {
      product.sizes.push({ size, length: normalizedLength, price, isTailored: tailored });
      addedSizes++;
    }
    previewRows.push({ school: schoolKey, name, length, size, price, action });
  });
  return { next, summary: { addedProducts, addedSizes, updatedSizes, rows: mappedRows.length }, errors, previewRows };
};
const isHighConfidenceImport = ({ analysis, confidence, conversionWarnings = [] }) => {
  const errors = Array.isArray(analysis?.errors) ? analysis.errors : [];
  const previewRows = Array.isArray(analysis?.previewRows) ? analysis.previewRows : [];
  return Number(confidence) >= HIGH_CONFIDENCE_IMPORT_THRESHOLD
    && previewRows.length > 0
    && errors.length === 0
    && conversionWarnings.length === 0
    && previewRows.every((row) => row.school && row.school !== UNASSIGNED);
};

const asSheetRows = (workbook, xlsx) => xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
const numericCell = (value) => {
  const text = String(value ?? "").replace(/[$,\s]/g, "");
  if (!text || !/^\d+(?:\.\d+)?$/.test(text)) return null;
  return Number(text);
};
const looksLikeSizeValue = (value) => {
  const text = String(value ?? "").trim();
  return Boolean(text) && (text === "裁碼" || /^\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?(?:碼)?$/.test(text) || /^(?:XS|S|M|L|XL|XXL|均碼)(?:-(?:XS|S|M|L|XL|XXL))?$/i.test(text));
};
const looksLikeDimensionValue = (value) => {
  const text = String(value ?? "").trim();
  if (!looksLikeSizeValue(text)) return false;
  const numbers = text.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  return numbers.length === 0 || numbers.every((number) => number <= 60);
};
const findSheetSchool = (rows) => {
  const catalogNames = Object.keys(schoolCatalog);
  for (const row of rows) {
    for (const cell of row) {
      const text = String(cell || "").trim();
      const found = catalogNames.find((name) => text.includes(name));
      if (found) return found;
    }
  }
  return rows.flat().map((cell) => String(cell || "").trim()).find((text) => /(?:中學|小學|幼稚園)$/.test(text)) || "";
};
const PRICE_LIST_PRODUCT_ALIASES = {
  "底衫": "底衫",
  "半腰裙": "深炭灰色半截校裙",
  "男呔": "男呔",
  "女呔": "女呔",
  "男藍襪": "男藍襪",
  "男藍袜": "男藍襪",
  "女灰長襪": "女灰長襪",
  "女灰長袜": "女灰長襪",
  "女長恤": "女裝白色長袖恤衫",
  "女生白色長袖恤衫": "女裝白色長袖恤衫",
  "男生白色長袖恤衫": "男生白色長袖恤衫",
  "男生白色短袖恤衫": "白色短袖恤衫",
  "女生白色短袖恤衫": "白色短袖恤衫",
  "校服白色長袖恤衫": "白色長袖恤衫",
  "校服白色短袖恤衫": "白色短袖恤衫",
  "白色長袖恤衫": "男生白色長袖恤衫",
  "白色短袖恤衫": "白色短袖恤衫",
  "校裙": "深炭灰色半截校裙",
  "深炭灰色半截校裙": "深炭灰色半截校裙",
  "深炭灰色校裙": "深炭灰色半截校裙",
  "長西褲": "男生深炭灰色長西褲",
  "男生長西褲": "男生深炭灰色長西褲",
  "女生長西褲": "女生長西褲",
  "黑色短西褲": "黑色短西褲",
  "黑色長西褲": "男生黑色長西褲",
  "深炭灰色長西褲": "男生深炭灰色長西褲",
  "女西裝連背心": "女裝西裝褸配背心",
  "女生西裝連背心": "女裝西裝褸配背心",
  "男西裝連背心": "男生西裝褸配背心",
  "男生西裝連背心": "男生西裝褸配背心",
  "西裝連背心": "西裝褸配背心",
  "炭灰西裝連背心": "深炭灰色西裝褸配厚抓毛背心",
  "炭灰西装連背心": "深炭灰色西裝褸配厚抓毛背心",
  "女裝西裝褸配背心": "女裝西裝褸配背心",
  "男生西裝褸配背心": "男生西裝褸配背心",
  "深炭灰色西裝褸配厚抓毛背心": "深炭灰色西裝褸配厚抓毛背心",
  "撊棉長褸": "撊棉長褸",
  "V背心": "V領背心冷衫",
  "V領背心": "V領背心冷衫",
  "V領背心冷衫": "V領背心冷衫",
  "V長袖": "V領長袖冷衫",
  "V長": "V領長袖冷衫",
  "V領長袖冷衫": "V領長袖冷衫",
  "冬運套": "冬天運動套裝",
  "冬運單衣": "冬天運動單衫",
  "冬運單衫": "冬天運動單衫",
  "冬運單褲": "冬天運動單褲",
  "單衫": "冬天運動單衫",
  "單衣": "冬天運動單衫",
  "單褲": "冬天運動單褲",
  "夏運衣": "運動上衣",
  "夏運褲": "運動褲",
  "夏季運動衣": "運動上衣",
  "女裝夏季運動衣": "運動上衣",
  "男裝夏季運動衣": "運動上衣",
  "女裝夏季運動褲": "運動褲",
  "男裝夏季運動褲": "運動褲",
  "夏季運動褲": "運動褲",
  "夏運動衣": "運動上衣",
  "夏運動褲": "運動褲",
  "3/7冷衫": "3/7冷衫",
  "三七冷衫": "3/7冷衫",
  "冷衫背心": "V領背心",
  "冷衫長袖": "V領長袖冷衫",
};
const normalizePriceListProductName = (value) => String(value || "").replace(/[\s　]/g, "").trim();
const priceListSeasonForRow = (rows, rowIndex) => {
  const nearbyRows = rows
    .slice(Math.max(0, rowIndex - 3), rowIndex + 1)
    .flat()
    .map((value) => normalizePriceListProductName(value));
  const nearbyText = nearbyRows.join("");
  const nearbySeasons = new Set([
    ...(nearbyText.includes("夏") ? ["夏"] : []),
    ...(nearbyText.includes("冬") ? ["冬"] : []),
  ]);
  if (nearbySeasons.size === 1) return [...nearbySeasons][0];

  const workbookText = rows
    .slice(0, 5)
    .flat()
    .map((value) => normalizePriceListProductName(value))
    .join("");
  const workbookSeasons = new Set([
    ...(workbookText.includes("夏") ? ["夏"] : []),
    ...(workbookText.includes("冬") ? ["冬"] : []),
  ]);
  return workbookSeasons.size === 1 ? [...workbookSeasons][0] : "";
};
const canonicalPriceListProductName = (value, season = "") => {
  const rawName = String(value || "").replace(/\s+/g, " ").trim();
  const normalizedName = normalizePriceListProductName(rawName);
  const tieName = normalizedName.match(/^(男呔|女呔)\d+$/)?.[1];
  if (tieName) return PRICE_LIST_PRODUCT_ALIASES[tieName];
  if (normalizedName === "占領恤") {
    if (season === "夏") return "白色短袖恤衫";
    if (season === "冬") return "男生白色長袖恤衫";
    return rawName;
  }
  return PRICE_LIST_PRODUCT_ALIASES[normalizedName] || rawName;
};
const looksLikeProductHeader = (value) => {
  const text = normalizePriceListProductName(value);
  if (Object.prototype.hasOwnProperty.call(PRICE_LIST_PRODUCT_ALIASES, text)) return true;
  return text && text.length <= 24
    && !/^(上圍|腰圍|褲長|裙長|尺碼|碼數|價錢|價格|數量|夏(?!運衣|運褲)|冬|長|短|\d|加\$?)/.test(text)
    && /(?:裙|褲|恤衫|襯衫|恤|衫|棉.*褸|棉.*褛|外套|冷衫|運衣|運動衣|運動褲|上衣|襪|袜|呔|皮帶|底衫|校徽|套裝|單衫|單衣|單褲|背心|長袖|西褲|3\/7)/.test(text);
};
const PRICE_LIST_TAILORED_SIZES = [
  { match: /(?:裙)/, values: ["42", "44", "46", "48", "50"], matrixDimension: "length" },
  { match: /(?:西褲|長褲)/, values: ["32", "34", "36", "38", "40", "42", "44", "46", "48"], matrixDimension: "size" },
  { match: /(?:西裝.*背心|西装.*背心|背心.*西裝|背心.*西装|西裝褸.*背心|西装褸.*背心)/, values: ["32", "34", "36", "38", "40", "42", "44", "46", "48", "50", "52", "54", "56", "58", "60"], matrixDimension: "length" },
  { match: /(?:短恤|長恤|短袖恤|長袖恤|恤衫|襯衫|尖領恤|恤)/, values: ["16.5", "17", "17.5", "18", "18.5", "19", "19.5", "20", "20.5", "21"] },
  { match: /(?:運動上衣|夏運衣|夏季運動衣|女裝夏季運動衣|男裝夏季運動衣|四社.*夏運衣)/, values: ["32", "34", "36", "38", "40", "42", "44", "46", "48", "50", "52"], matrixDimension: "size" },
  { match: /(?:運動褲|夏運褲|夏季運動褲|女裝夏季運動褲|男裝夏季運動褲)/, values: ["1碼", "2碼", "3碼"], matrixDimension: "size" },
  { match: /(?:3\/7冷衫)/, values: ["44", "46", "48", "50"] },
  { match: /(?:V領背心)/, values: ["44", "46", "48", "50", "52"], matrixDimension: "size" },
  { match: /(?:V領長袖冷衫)/, values: ["44", "46", "48", "50", "52"], matrixDimension: "size" },
  { match: /(?:冬天運動套裝)/, values: ["46", "48", "50", "52"] },
  { match: /(?:冬天運動單衫|冬天運動單褲|冬運單衣|冬運單衫|冬運單褲)/, values: ["46", "48", "50", "52"] },
];
const SIMPLE_SIZE_PRODUCT_NAMES = new Set([
  "深炭灰色西裝褸配厚抓毛背心",
  "深炭灰色半截校裙",
  "女裝西裝褸配背心",
]);
const LONG_TROUSER_LENGTHS = ["30", "31", "32", "33", "34", "35", "36", "37", "38.5", "40", "41.5", "43", "44.5", "46"];
const DEFAULT_TROUSER_SURCHARGES = [
  { threshold: 43, amount: 30, minimum: true },
  { threshold: 41.5, amount: 20, minimum: false },
  { threshold: 40, amount: 10, minimum: false },
];
const trouserLengthSurcharge = (length, rules = DEFAULT_TROUSER_SURCHARGES) => {
  const value = Number(length);
  if (!Number.isFinite(value)) return 0;
  const rule = rules.find((candidate) => candidate.minimum ? value >= candidate.threshold : value === candidate.threshold);
  return rule?.amount || 0;
};
const BOTTOM_SHIRT_SIZES = new Set(["16", "17", "18", "S", "M", "L", "XL"]);
const expandTailoredPriceListValue = (name, value) => {
  if (String(value || "").trim() !== "裁碼" || /底裙/.test(name)) return [String(value || "").trim()];
  const tailoredRule = PRICE_LIST_TAILORED_SIZES.find((rule) => rule.match.test(name));
  if (tailoredRule?.matrixDimension !== "length" && /(?:短恤|長恤|短袖恤|長袖恤|恤衫|襯衫|尖領恤|恤)/.test(name)) {
    return tailoredRule.values;
  }
  if (tailoredRule?.matrixDimension === "size" && /(?:夏運衣|夏季運動衣|運動上衣|夏運褲|夏季運動褲|運動褲)/.test(name)) {
    return tailoredRule.values;
  }
  if (tailoredRule?.matrixDimension === "size" && /(?:V領背心|V領長袖冷衫)/.test(name)) {
    return tailoredRule.values;
  }
  return ["裁碼"];
};
const inferLowerTailoredSizes = (name, rawEntries) => {
  if (!rawEntries.some(({ size }) => size === "裁碼")) return [];
  const tailoredRule = PRICE_LIST_TAILORED_SIZES.find((rule) => rule.match.test(name));
  if (!tailoredRule) return [];
  const numericEntries = rawEntries
    .map(({ size, price }) => ({ size: Number(size), price }))
    .filter(({ size, price }) => Number.isFinite(size) && Number.isFinite(price));
  if (!numericEntries.length) return [];
  const lowestListedSize = Math.min(...numericEntries.map(({ size }) => size));
  const lowestListedPrice = numericEntries.find(({ size }) => size === lowestListedSize)?.price;
  return tailoredRule.values
    .filter((size) => Number(size) < lowestListedSize)
    .map((size) => ({ size, price: lowestListedPrice }));
};
const expandPriceListSizeRange = (name, value) => {
  const text = String(value || "").trim();
  const numericRange = text.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(?:碼)?$/);
  if (numericRange) {
    const start = Number(numericRange[1]);
    const end = Number(numericRange[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start && Number.isInteger(start) && Number.isInteger(end)) {
      return Array.from({ length: end - start + 1 }, (_, index) => String(start + index));
    }
    return [numericRange[1], numericRange[2]];
  }
  const alphaRange = text.match(/^(XS|S|M|L|XL|XXL)-(XS|S|M|L|XL|XXL)$/i);
  if (alphaRange) {
    const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
    const start = sizes.indexOf(alphaRange[1].toUpperCase());
    const end = sizes.indexOf(alphaRange[2].toUpperCase());
    return start >= 0 && end >= start ? sizes.slice(start, end + 1) : [text];
  }
  return [text];
};
const parseRangeValues = (text) => {
  const match = String(text || "").match(/(\d+(?:\.\d+)?)\s*(?:-|至|到)\s*(\d+(?:\.\d+)?)/);
  if (!match) return [];
  const start = Number(match[1]);
  const end = Number(match[2]);
  const step = start % 1 === 0 && end % 1 === 0 ? 1 : 0.5;
  const values = [];
  for (let value = start; value <= end + 0.0001; value += step) {
    values.push(String(Number(value.toFixed(1))));
  }
  return values;
};
const findDimensionRange = (rows, endRow, labelPattern) => {
  for (let index = endRow - 1; index >= Math.max(0, endRow - 8); index--) {
    const cell = rows[index]?.find((value) => labelPattern.test(String(value || "")));
    const values = parseRangeValues(cell);
    if (values.length) return values;
  }
  return [];
};
const findSurchargeRules = (rows, labelPattern) => {
  const rules = [];
  rows.forEach((row) => row.forEach((cell) => {
    const text = String(cell || "").replace(/\s+/g, "");
    if (!labelPattern.test(text)) return;
    const context = row.join("").replace(/\s+/g, "");
    const match = context.match(/(\d+(?:\.\d+)?)["”]?或以上.*?加\$?(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)["”]?.*?加\$?(\d+(?:\.\d+)?)/);
    if (match) {
      const threshold = Number(match[1] || match[3]);
      const amount = Number(match[2] || match[4]);
      if (Number.isFinite(threshold) && Number.isFinite(amount)) rules.push({ threshold, amount, minimum: Boolean(match[1]) });
    }
  }));
  return rules.sort((first, second) => second.threshold - first.threshold);
};
const expandDimensionWithSurchargeRules = (values, rules, step = 1) => {
  const expanded = new Set(values.map((value) => String(value)));
  rules.forEach(({ threshold }) => {
    if (!Number.isFinite(threshold)) return;
    expanded.add(String(threshold));
    if (rules.some((rule) => rule.minimum && rule.threshold === threshold)) {
      for (let value = threshold + step; value <= 50; value += step) {
        expanded.add(String(Number(value.toFixed(1))));
      }
    }
  });
  return [...expanded].sort((first, second) => Number(first) - Number(second));
};
const convertIrregularPriceList = (rows) => {
  const school = findSheetSchool(rows);
  const converted = [];
  const warnings = [];
  const skirtSurchargeRules = findSurchargeRules(rows, /上圍|上围|上圉/);
  const trouserSurchargeRules = findSurchargeRules(rows, /褲長|裤长/);
  const effectiveTrouserSurchargeRules = trouserSurchargeRules.length > 0 ? trouserSurchargeRules : DEFAULT_TROUSER_SURCHARGES;
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      const rawName = String(cell || "").replace(/\s+/g, " ").trim();
      const name = canonicalPriceListProductName(rawName, priceListSeasonForRow(rows, rowIndex));
      if (!looksLikeProductHeader(rawName)) return;
      const standalonePrice = row
        .slice(columnIndex + 1)
        .map(numericCell)
        .find((value) => value !== null);
      if (/底裙/.test(name) && standalonePrice !== undefined) {
        converted.push({ 學校: school, 款式名稱: name, 長度: "", 尺碼: "均碼", 價錢: standalonePrice });
        return;
      }
      if (/(?:呔|襪|袜)/.test(name) && standalonePrice !== undefined) {
        converted.push({ 學校: school, 款式名稱: name, 長度: "", 尺碼: "均碼", 價錢: standalonePrice });
        return;
      }
      let sizeColumn = columnIndex;
      let priceColumn = -1;
      const quantityMarker = String(row[columnIndex + 1] || "").trim().match(/^\d+(?:件|條|對|套|包)$/);
      if (quantityMarker) {
        for (let candidate = columnIndex - 1; candidate >= 0; candidate--) {
          if (rows.slice(rowIndex + 1, rowIndex + 6).some((nextRow) => looksLikeDimensionValue(nextRow?.[candidate]))) {
            sizeColumn = candidate;
            break;
          }
        }
        if (sizeColumn !== columnIndex) {
          priceColumn = sizeColumn + 1;
        }
      }
      if (priceColumn < 0) {
        const headerColumns = row
          .map((value, index) => ({ value, index }))
          .filter(({ value }) => looksLikeProductHeader(value))
          .map(({ index }) => index);
        const groupStart = headerColumns.find((index) => index >= columnIndex) ?? columnIndex;
        const groupEnd = headerColumns[headerColumns.indexOf(groupStart) + 1] ?? groupStart;
        const candidateSizeColumns = [];
        for (let candidate = Math.max(0, groupStart - 2); candidate <= groupEnd + 2; candidate++) {
          if (rows.slice(rowIndex + 1, rowIndex + 6).some((nextRow) => looksLikeDimensionValue(nextRow?.[candidate]))) {
            candidateSizeColumns.push(candidate);
          }
        }
        if (candidateSizeColumns.length) {
          sizeColumn = candidateSizeColumns[0];
          const numericColumns = [];
          for (let candidate = sizeColumn + 1; candidate < rows[0].length; candidate++) {
            if (rows.slice(rowIndex + 1, rowIndex + 6).some((nextRow) => numericCell(nextRow?.[candidate]) !== null)) {
              numericColumns.push(candidate);
            }
          }
          const sharedSizeHeaders = headerColumns.filter((index) => index >= sizeColumn);
          const headerPosition = sharedSizeHeaders.indexOf(columnIndex);
          priceColumn = numericColumns[headerPosition] ?? -1;
        }
      }
      for (let lookAhead = rowIndex + 1; lookAhead < Math.min(rows.length, rowIndex + 5); lookAhead++) {
        if (priceColumn >= 0) break;
        if (looksLikeDimensionValue(rows[lookAhead]?.[sizeColumn])) {
          for (let candidate = columnIndex + 1; candidate < Math.min(row.length, columnIndex + 6); candidate++) {
            if (numericCell(rows[lookAhead]?.[candidate]) !== null) {
              priceColumn = candidate;
              break;
            }
          }
          if (priceColumn >= 0) break;
        }
      }
      if (priceColumn < 0) {
        const nearbySizeColumn = row.findIndex((_, candidate) => rows.slice(rowIndex + 1, rowIndex + 6).some((nextRow) => looksLikeDimensionValue(nextRow?.[candidate])));
        if (nearbySizeColumn >= 0) {
          sizeColumn = nearbySizeColumn;
          priceColumn = row.findIndex((_, candidate) => candidate > sizeColumn && rows.slice(rowIndex + 1, rowIndex + 6).some((nextRow) => numericCell(nextRow?.[candidate]) !== null));
        }
      }
      if (/(?:長西褲|西褲)/.test(name) && columnIndex > 0
        && rows.slice(rowIndex + 1, rowIndex + 8).some((nextRow) => looksLikeDimensionValue(nextRow?.[columnIndex - 1]))
        && rows.slice(rowIndex + 1, rowIndex + 8).some((nextRow) => numericCell(nextRow?.[columnIndex]) !== null)) {
        sizeColumn = columnIndex - 1;
        priceColumn = columnIndex;
      }
      if (/(?:恤衫|襯衫|恤)/.test(name)) {
        const shirtSizeColumns = [];
        for (let candidate = Math.max(0, columnIndex - 1); candidate <= Math.min(row.length - 1, columnIndex + 2); candidate++) {
          const values = rows.slice(rowIndex + 1, rowIndex + 8)
            .map((nextRow) => numericCell(nextRow?.[candidate]))
            .filter((value) => value !== null);
          if (values.length >= 2 && values.every((value) => value >= 10 && value <= 22)) {
            shirtSizeColumns.push(candidate);
          }
        }
        const shirtSizeColumn = shirtSizeColumns.sort((first, second) => Math.abs(first - columnIndex) - Math.abs(second - columnIndex))[0];
        if (shirtSizeColumn !== undefined && numericCell(rows[rowIndex + 1]?.[shirtSizeColumn + 1]) !== null) {
          sizeColumn = shirtSizeColumn;
          priceColumn = shirtSizeColumn + 1;
        }
      }
      if (priceColumn < 0) {
        warnings.push(`第${rowIndex + 1}行「${name}」未能確定尺碼及單價欄，請在預覽後補充。`);
        return;
      }
      const normalizedHeaderName = normalizePriceListProductName(rawName);
      const isSingleGarmentHeader = normalizedHeaderName === "單衣/褲";
      const hasSportsSuitHeader = row.some((value) => {
        const headerName = canonicalPriceListProductName(String(value || "").trim(), priceListSeasonForRow(rows, rowIndex));
        return /運動套裝/.test(headerName) || normalizePriceListProductName(value) === "冬天運動套裝";
      });
      if (isSingleGarmentHeader && hasSportsSuitHeader) return;
      if (isSingleGarmentHeader) {
        for (let dataRow = rowIndex + 1; dataRow < Math.min(rows.length, rowIndex + 15); dataRow += 1) {
          const size = String(rows[dataRow]?.[sizeColumn] ?? "").trim();
          const singleGarmentPrice = numericCell(rows[dataRow]?.[priceColumn + 1]);
          if (!size || singleGarmentPrice === null) {
            if (dataRow > rowIndex + 1 && rows[dataRow]?.every((value) => String(value || "").trim() === "")) break;
            continue;
          }
          converted.push({ 學校: school, 款式名稱: "運動外套", 長度: "", 尺碼: size, 價錢: singleGarmentPrice });
          converted.push({ 學校: school, 款式名稱: "運動長褲", 長度: "", 尺碼: size, 價錢: singleGarmentPrice });
        }
        return;
      }
      const rawEntries = [];
      for (let dataRow = rowIndex + 1; dataRow < Math.min(rows.length, rowIndex + 15); dataRow++) {
        const hasBottomShirtHeader = rows[dataRow]?.some((value) => normalizePriceListProductName(value) === "底衫");
        if (hasBottomShirtHeader && name !== "底衫") break;
        const size = String(rows[dataRow]?.[sizeColumn] ?? "").trim();
        const price = numericCell(rows[dataRow]?.[priceColumn]);
        if (!size || (!looksLikeDimensionValue(size) && size !== "裁碼") || price === null) {
          if (dataRow > rowIndex + 1 && rows[dataRow]?.every((value) => String(value || "").trim() === "")) break;
          continue;
        }
        rawEntries.push({ size, price });
      }
      const isSkirt = /裙/.test(name);
      const isTrousers = /(?:褲|西褲)/.test(name);
      const isShirt = /(?:短恤|長恤|短袖恤|長袖恤|恤衫|襯衫|尖領恤|恤)/.test(name);
      const isBottomShirt = name === "底衫";
      const tailoredSizeRule = PRICE_LIST_TAILORED_SIZES.find((rule) => rule.matrixDimension === "size" && rule.match.test(name));
      const isLongTrousers = /西褲/.test(name) && Boolean(tailoredSizeRule);
      const shirtPriceAt12 = isShirt
        ? rawEntries.find(({ size }) => Number(size) === 12)?.price
        : undefined;
      const conversionEntries = isShirt && shirtPriceAt12 !== undefined
        ? rawEntries.map((entry) => Number(entry.size) <= 12 ? { ...entry, price: shirtPriceAt12 } : entry)
        : rawEntries;
      const sizeRange = isSkirt
        ? expandDimensionWithSurchargeRules(findDimensionRange(rows, rowIndex, /上圍|上围|上圉/), skirtSurchargeRules, 2)
        : [];
      const lengthRange = isTrousers ? findDimensionRange(rows, rowIndex, /褲長|裤长|長度|长度/) : [];
      const hasSkirtMatrix = isSkirt && sizeRange.length > 0;
      if (hasSkirtMatrix) {
        rawEntries.forEach(({ size: rawLength, price }) => {
          const lengths = expandTailoredPriceListValue(name, rawLength)
            .flatMap((tailoredLength) => expandPriceListSizeRange(name, tailoredLength));
          lengths.forEach((length) => sizeRange.forEach((size) => {
            const sizeNumber = Number(size);
            const rule = skirtSurchargeRules.find((candidate) => candidate.minimum ? sizeNumber >= candidate.threshold : sizeNumber === candidate.threshold);
            converted.push({
              學校: school,
              款式名稱: name,
              長度: length,
              尺碼: size,
              價錢: price + (rule?.amount || 0),
            });
          }));
        });
      } else if (isTrousers && (lengthRange.length || isLongTrousers || PRICE_LIST_TAILORED_SIZES.some((rule) => rule.matrixDimension === "length" && rule.match.test(name)))) {
        const tailoredLengthRule = PRICE_LIST_TAILORED_SIZES.find((rule) => rule.matrixDimension === "length" && rule.match.test(name));
        const matrixLengthValues = new Set([
          ...LONG_TROUSER_LENGTHS,
          ...lengthRange,
          ...(tailoredLengthRule?.matrixDimension === "length" ? tailoredLengthRule.values : []),
          ...effectiveTrouserSurchargeRules.map((rule) => String(rule.threshold)),
        ]);
        const matrixLengths = [...matrixLengthValues]
          .filter((value) => value !== "")
          .sort((first, second) => Number(first) - Number(second));
        const matrixEntries = [...rawEntries];
        if (isLongTrousers) {
          const tailoredEntry = rawEntries.find(({ size }) => size === "裁碼");
          if (tailoredEntry) {
            tailoredSizeRule.values.forEach((size) => {
              if (!matrixEntries.some((entry) => entry.size === size && entry.isTailored)) {
                matrixEntries.push({ size, price: tailoredEntry.price, isTailored: true });
              }
            });
          }
        }
        matrixEntries.forEach(({ size: rawSize, price, isTailored: rawIsTailored = false }) => {
          const waistSizes = isLongTrousers && rawSize === "裁碼"
            ? tailoredSizeRule.values
            : expandTailoredPriceListValue(name, rawSize);
          waistSizes
            .flatMap((tailoredSize) => expandPriceListSizeRange(name, tailoredSize))
            .forEach((size) => matrixLengths.forEach((length) => {
            const lengthNumber = Number(length);
            const rule = effectiveTrouserSurchargeRules.find((candidate) => candidate.minimum ? lengthNumber >= candidate.threshold : lengthNumber === candidate.threshold);
            converted.push({
              學校: school,
              款式名稱: name,
              長度: length,
              尺碼: size,
              價錢: price + (rule?.amount || 0),
              isTailored: isLongTrousers && (rawSize === "裁碼" || rawIsTailored),
            });
          }));
        });
      } else {
        const exactEntries = isBottomShirt
          ? conversionEntries.flatMap(({ size, price }) => expandPriceListSizeRange(name, size).map((expandedSize) => ({ size: expandedSize, price })))
            .filter(({ size }) => BOTTOM_SHIRT_SIZES.has(size))
          : conversionEntries;
        inferLowerTailoredSizes(name, exactEntries).forEach(({ size, price }) => {
          converted.push({ 學校: school, 款式名稱: name, 長度: "", 尺碼: size, 價錢: price });
        });
        exactEntries.forEach(({ size, price }) => {
          expandTailoredPriceListValue(name, size)
            .flatMap((tailoredSize) => expandPriceListSizeRange(name, tailoredSize))
            .forEach((expandedSize) => {
              converted.push({
                學校: school,
                款式名稱: name,
                長度: "",
                尺碼: expandedSize,
                價錢: price,
                isTailored: String(size).trim() === "裁碼",
              });
          });
        });
      }
    });
  });
  const trouserGroups = new Map();
  converted.forEach((entry) => {
    if (!/西褲/.test(entry.款式名稱) || entry.尺碼 !== "裁碼") return;
    const key = `${entry.學校}\u0000${entry.款式名稱}`;
    const group = trouserGroups.get(key) || new Map();
    group.set(entry.長度 || "", entry.價錢);
    trouserGroups.set(key, group);
  });
  trouserGroups.forEach((tailoredPrices, key) => {
    const [school, name] = key.split("\u0000");
    const existing = new Set(converted
      .filter((entry) => entry.學校 === school && entry.款式名稱 === name)
      .map((entry) => `${entry.長度 || ""}\u0000${entry.尺碼}`));
    tailoredPrices.forEach((tailoredPrice, length) => {
      const tailoredRule = PRICE_LIST_TAILORED_SIZES.find((rule) => rule.matrixDimension === "size" && rule.match.test(name));
      (tailoredRule?.values || []).forEach((size) => {
        const keyForEntry = `${length}\u0000${size}`;
        if (existing.has(keyForEntry)) return;
        converted.push({ 學校: school, 款式名稱: name, 長度: length, 尺碼: size, 價錢: tailoredPrice });
      });
    });
  });
  if (!school) warnings.unshift("未能從價目表自動識別學校，匯入後會放入未分類。");
  return { rows: converted, warnings };
};

const noticeTextFromPdf = async (file) => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || "").join(" "));
  }
  return pages.join("\n");
};

const noticeTextFromDocx = async (file) => {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
};

const noticeTextFromImage = async (file) => {
  const tesseract = await import("tesseract.js");
  const result = await tesseract.recognize(file, "chi_tra+eng");
  return result.data.text;
};

const analyzeNoticeText = (text, fileName) => {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  const school = findSheetSchool([[normalized]]);
  const season = normalized.includes("冬") ? "冬季" : normalized.includes("夏") ? "夏季" : "";
  const yearMatch = normalized.match(/20\d{2}/);
  const productKeywords = [
    "女裝白色長袖恤衫", "白色長袖恤衫", "白色短袖恤衫", "女西裝連背心",
    "男生深炭灰色長西褲", "長西褲", "冬天運動套裝", "冬天運動單衫",
    "冬天運動單褲", "V領背心", "V領長袖冷衫", "校裙", "運動褲",
  ];
  const productsFound = productKeywords.filter((keyword) => normalized.includes(keyword));
  return {
    fileName,
    text: normalized,
    school,
    season,
    schoolYear: yearMatch ? yearMatch[0] : "",
    productsFound,
    warnings: normalized ? [] : ["文件未能抽取到文字，請改用較清晰的 PDF、Word 或圖片。"],
  };
};

const normalizeNoticeProductName = (value) => {
  const raw = String(value || "").trim();
  const normalized = normalizePriceListProductName(raw)
    .replace(/[（(].*?[）)]/g, "")
    .replace(/男生|女生|男裝|女裝|校服|同學/g, "")
    .replace(/\/|／|、|，|。/g, "");
  const canonical = PRICE_LIST_PRODUCT_ALIASES[normalized] || normalized;
  return String(canonical || "").replace(/\s+/g, "");
};

const buildNoticeImportFusion = (notice, importPreview) => {
  const excelProducts = [...new Set((importPreview.previewRows || []).map((row) => String(row.name || "").trim()).filter(Boolean))];
  const noticeProducts = notice.productsFound || [];
  const matches = noticeProducts.map((noticeProduct) => {
    const normalizedNotice = normalizeNoticeProductName(noticeProduct);
    const matchedExcel = excelProducts.find((excelProduct) => {
      const normalizedExcel = normalizeNoticeProductName(excelProduct);
      return normalizedExcel === normalizedNotice
        || normalizedExcel.includes(normalizedNotice)
        || normalizedNotice.includes(normalizedExcel);
    });
    return { noticeProduct, matchedExcel: matchedExcel || "" };
  });
  const schoolMatch = !notice.school || !importPreview.previewRows?.length
    ? "待確認"
    : importPreview.previewRows.every((row) => !row.school || row.school === notice.school)
      ? "符合"
      : "有差異";
  return {
    schoolMatch,
    matches,
    unmatchedNotice: matches.filter((item) => !item.matchedExcel).map((item) => item.noticeProduct),
    excelOnly: excelProducts.filter((excelProduct) => !matches.some((item) => item.matchedExcel === excelProduct)),
  };
};

const BT_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
const BT_CHAR = "00002af1-0000-1000-8000-00805f9b34fb";

// ===================== 員工權限 =====================
// 五種角色：admin（全權限）、manager（店長/當日負責人）、sales（銷售）、staff（店員）、guest（客人登記）
const ROLES = { ADMIN: "admin", MANAGER: "manager", SALES: "sales", STAFF: "staff", GUEST: "guest" };
const ROLE_LABEL = { admin: "管理員 ADMIN", manager: "店長／當日負責人", sales: "銷售", staff: "店員", guest: "客人" };

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
  [ROLES.SALES]: {
    tabs: ["sale", "records"],
    canEditProducts: false,
    canManageSchools: false,
    canImportExport: false,
    canViewAllDates: false,
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

const ENGLISH_RECEIPT_SCHOOL = "港青基信書院";
const isEnglishReceiptSchool = (school) => String(school || "").trim() === ENGLISH_RECEIPT_SCHOOL;
const receiptLanguageLabel = (language) => language === "en" ? "English" : "中文";
const receiptProductUnit = (name, language) => {
  const unit = productUnit(name);
  if (language !== "en") return unit;
  return { "件": "pcs", "對": "pairs", "包": "packs", "套": "sets", "條": "pcs", "個": "pcs" }[unit] || "pcs";
};
const receiptFieldLabels = (language) => language === "en" ? {
  school: "School",
  receiptNo: "Receipt No.",
  sourceReceipt: "Source Receipt",
  date: "Date",
  customer: "Customer",
  phone: "Last 4 digits",
  outlet: "Outlet",
  address: "Address",
  telephone: "Telephone",
  cashier: "Staff",
  items: "Items",
  quantity: "Qty",
  itemCount: "Item count",
  total: "Total due",
  exchangeTotal: "Exchange difference",
  cash: "Cash received",
  refund: "Refund due",
  change: "Change",
  status: "Status",
  completed: "Completed",
  exchanged: "Exchange completed",
  exchangeOut: "Exchange out: ",
  returnPolicy: "Returns & exchanges: Within 30 days of purchase, present this receipt at the designated store to exchange the size, provided the item is unused, unwashed and unaltered.",
  careTitle: "Care instructions:",
  care: "Do not use bleach, colour bleach or bleaching products. Separate light and dark garments and hang them to dry promptly after washing.",
  thanks: "Thank you for your purchase. We look forward to serving you again.",
  qr: "This QR Code contains this electronic receipt.",
} : {
  school: "學校",
  receiptNo: "收據編號",
  sourceReceipt: "來源單據",
  date: "交易日期",
  customer: "客人",
  phone: "電話尾4位",
  outlet: "最近門店",
  address: "門店地址",
  telephone: "門店電話",
  cashier: "服務員",
  items: "商品明細",
  quantity: "數量",
  itemCount: "商品件數",
  total: "應付總額",
  exchangeTotal: "換貨差額",
  cash: "實收現金",
  refund: "應退客人",
  change: "找續",
  status: "交易狀態",
  completed: "已完成",
  exchanged: "換貨完成",
  exchangeOut: "換出：",
  returnPolicy: "退換條款：購貨後 30 天內，憑收據且商品未經使用、洗滌或改動，可親臨指定門市辦理更換尺碼。",
  careTitle: "洗滌指引：",
  care: "請勿使用含有漂白成份之洗衣產品、彩漂或漂白水。深淺色衣物必須分開洗滌，清洗後請即時晾曬，以免移色。",
  thanks: "多謝惠顧，歡迎重臨",
  qr: "此 QR Code 內容為本單電子收據",
};

// 每張單獨立嘅收據文字（用嚟印藍牙收據，亦係 QR code 嘅內容）
// 加入學校名、單號短碼、負責開單員工，令收據睇落更似正式商業收據
const buildReceiptLines = (order, shopName, language = "zh") => {
  const labels = receiptFieldLabels(language);
  const english = language === "en";
  const lines = [];
  lines.push(english ? "Victoria Uniform" : "Victoria Uniform 校服銷售");
  lines.push(english ? "ELECTRONIC RECEIPT" : "電子銷售單 ELECTRONIC RECEIPT");
  lines.push("================================");
  lines.push(`${labels.receiptNo}: #${(order.id || "").toUpperCase()}`);
  if (order.exchangeSourceReceiptId) lines.push(`${labels.sourceReceipt}: #${String(order.exchangeSourceReceiptId).toUpperCase()}`);
  lines.push(`${labels.date}: ${order.date || "-"} ${order.time || ""}`);
  lines.push(`${labels.school}: ${english && order.school === ENGLISH_RECEIPT_SCHOOL ? "YMCA of Hong Kong Christian College" : order.school || shopName || "-"}`);
  if (order.customerName || order.customerPhone) {
    lines.push(`${labels.customer}: ${customerSurname(order.customerName) || "-"}`);
    lines.push(`${labels.phone}: ${customerPhoneLast4(order.customerPhone) || "-"}`);
  }
  if (order.outletName) {
    lines.push(`${labels.outlet}: ${order.outletName}`);
    lines.push(`${labels.address}: ${order.outletAddress}`);
    lines.push(`${labels.telephone}: ${order.outletPhone}`);
  }
  if (order.cashierName) lines.push(`${labels.cashier}: ${order.cashierName}`);
  lines.push("--------------------------------");
  lines.push(labels.items);
  order.items.forEach((it) => {
    lines.push(`${it.exchangeReturn ? labels.exchangeOut : ""}${it.name}`);
    lines.push(`  ${formatSizeForReceipt(it.name, it.size, it.length)}`);
    lines.push(`  ${labels.quantity} ${it.qty} ${receiptProductUnit(it.name, language)} x ${fmt(Math.abs(it.price))} = ${fmt((it.exchangeReturn ? -1 : 1) * Math.abs(it.price) * it.qty)}`);
  });
  lines.push("--------------------------------");
  lines.push(`${labels.itemCount}: ${order.itemCount || 0}`);
  lines.push(`${order.exchangeSourceReceiptId ? labels.exchangeTotal : labels.total}: ${fmt(order.total)}`);
  if (typeof order.cashReceived === "number") lines.push(`${labels.cash}: ${fmt(order.cashReceived)}`);
  if (order.refundDue > 0) lines.push(`${labels.refund}: ${fmt(order.refundDue)}`);
  else if (typeof order.changeDue === "number") lines.push(`${labels.change}: ${fmt(order.changeDue)}`);
  lines.push(`${labels.status}: ${order.exchangeSourceReceiptId ? labels.exchanged : labels.completed}`);
  lines.push("--------------------------------");
  lines.push(labels.returnPolicy);
  lines.push(labels.careTitle);
  lines.push(labels.care);
  lines.push(labels.thanks);
  lines.push(labels.qr);
  return lines;
};

const buildReceiptUrl = (order, language = "zh") => {
  const json = JSON.stringify(order);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const encoded = btoa(binary);
  const publicUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, "");
  return `${publicUrl}/receipt.html?lang=${language}&data=${encodeURIComponent(encoded)}`;
};

// ===================== 儲存層 =====================
// 有 Supabase 設定時使用雲端；未設定時保留 localStorage，方便本機試用。
if (!window.storage) {
  const cloudStorageKeys = new Set(["school-meta"]);
  const localStorageKey = (key, shared = false) => (shared ? `shared:${key}` : key);

  window.storage = {
    get: async (key, shared = false) => {
      const localKey = localStorageKey(key, shared);
      if (shared && cloudStorageKeys.has(key) && isSupabaseConfigured) {
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
      if (shared && cloudStorageKeys.has(key) && isSupabaseConfigured) {
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

export class AppErrorBoundary extends React.Component {
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
            {this.state.error && (
              <pre style={{
                margin: 0,
                padding: 10,
                overflowX: "auto",
                textAlign: "left",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                borderRadius: 8,
                background: "#fff7f7",
                color: "#7f1d1d",
                fontSize: 11,
              }}>
                {String(this.state.error.message || this.state.error)}
              </pre>
            )}
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

const PageLoading = () => (
  <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary, #666)" }}>
    載入緊…
  </div>
);

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
  const [heldSales, setHeldSales] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [pendingSaleProductId, setPendingSaleProductId] = useState("");
  const [exchangeReplacementQueue, setExchangeReplacementQueue] = useState([]);
  const exchangeReplacementQueueRef = useRef([]);
  const [receipt, setReceipt] = useState(null);
  const [receiptLanguage, setReceiptLanguage] = useState("zh");
  useEffect(() => {
    if (receipt) setReceiptLanguage("zh");
  }, [receipt]);
  const [cashReceived, setCashReceived] = useState("");
  const [btStatus, setBtStatus] = useState({ state: "idle", msg: "" });
  const printAreaRef = useRef(null);
  const checkoutSubmittingRef = useRef(false);

  const [importResult, setImportResult] = useState(null); // { summary, errors } | null
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [productsSaveError, setProductsSaveError] = useState("");
  const [productsSaveState, setProductsSaveState] = useState("saved");
  const [sourceIntegrityWarning, setSourceIntegrityWarning] = useState("");
  const [envError, setEnvError] = useState(null); // 环境变量验证错误
  const productsSaveTimerRef = useRef(null);
  const productsPersistQueueRef = useRef(Promise.resolve());
  const productsSavePendingRef = useRef(false);
  const productsSaveGenerationRef = useRef(0);
  const productsSaveBlockedRef = useRef(false);
  const productsRef = useRef(products);
  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  const [selectedSchool, setSelectedSchool] = useState(() => (
    new URLSearchParams(location.search).get("school_id")
    || new URLSearchParams(location.search).get("school")
    || DESIGNATED_SCHOOL
  ));
  const [schoolPanelOpen, setSchoolPanelOpen] = useState(false);
  const [branchSchoolIds, setBranchSchoolIds] = useState({});
  const customerSchools = listSchools(products);

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
  const [session, setSession] = useState(null); // { id, name, role, branchId } | null
  const [authReady, setAuthReady] = useState(!isSupabaseAuthEnabled); // Wait for auth before loading protected data
  const [passwordSetupRequired, setPasswordSetupRequired] = useState(false);
  const perms = session ? (PERMISSIONS[session.role] || PERMISSIONS[ROLES.STAFF]) : null;
  const accessibleProducts = !isSupabaseAuthEnabled || session?.role === ROLES.ADMIN
    ? products
    : products.filter((product) => product.branch_id === session?.branchId || branchSchoolIds[schoolOf(product)] === session?.branchId);
  const schools = listSchools(accessibleProducts);

  useEffect(() => {
    window.storage.get("held-sales", false).then((saved) => {
      if (!saved?.value) return;
      try {
        const parsed = JSON.parse(saved.value);
        if (Array.isArray(parsed)) {
          const today = getHongKongDate();
          const current = parsed.filter((hold) => getHongKongDate(hold.createdAt) === today);
          setHeldSales(current);
          if (current.length !== parsed.length) {
            window.storage.set("held-sales", JSON.stringify(current), false).catch((error) => {
              console.error("清理過期 HOLD 單失敗", error);
            });
          }
        }
      } catch (error) {
        console.error("讀取 HOLD 單失敗", error);
      }
    }).catch((error) => console.error("讀取 HOLD 單失敗", error));
  }, []);

  useEffect(() => {
    if (!authReady || (isSupabaseAuthEnabled && !session)) return undefined;
    let lastDate = getHongKongDate();
    const cleanup = async () => {
      const today = getHongKongDate();
      if (today === lastDate) return;
      lastDate = today;
      try {
        await queueOrderService.clearExpiredData();
      } catch (error) {
        console.error("清理過期排隊資料失敗", error);
      }
      setHeldSales((previous) => {
        const current = previous.filter((hold) => getHongKongDate(hold.createdAt) === today);
        if (current.length !== previous.length) {
          window.storage.set("held-sales", JSON.stringify(current), false).catch((error) => {
            console.error("清理過期 HOLD 單失敗", error);
          });
        }
        return current;
      });
      setCart([]);
      setCashReceived("");
      setSelectedProduct(null);
      setExchangeReplacementQueue([]);
      exchangeReplacementQueueRef.current = [];
    };

    queueOrderService.clearExpiredData().catch((error) => {
      console.error("清理過期排隊資料失敗", error);
    });
    const timer = window.setInterval(cleanup, 30 * 1000);
    return () => window.clearInterval(timer);
  }, [authReady, session]);

  const persistHeldSales = (next) => {
    setHeldSales(next);
    window.storage.set("held-sales", JSON.stringify(next), false).catch((error) => {
      console.error("儲存 HOLD 單失敗", error);
      setStorageError("HOLD 單未能儲存，請檢查裝置儲存空間後再試。");
    });
  };

  const clearCartWithConfirmation = () => {
    if (cart.length === 0) return;
    if (!window.confirm("確定要刪除購物車內所有款式嗎？此操作不能復原。")) return;
    setCart([]);
    setCashReceived("");
    setSelectedProduct(null);
    setExchangeReplacementQueue([]);
    exchangeReplacementQueueRef.current = [];
  };

  const holdCurrentSale = () => {
    if (cart.length === 0) return;
    const hold = {
      id: uid(),
      createdAt: new Date().toISOString(),
      school: selectedSchool || "",
      cart,
      cashReceived,
    };
    persistHeldSales([hold, ...heldSales]);
    setCart([]);
    setCashReceived("");
    setSelectedProduct(null);
  };

  const resumeHeldSale = (hold) => {
    if (cart.length > 0 && !window.confirm("目前購物車已有款式，確定要載入 HOLD 單並取代目前內容嗎？")) return;
    setSelectedSchool(hold.school || selectedSchool);
    setCart(hold.cart || []);
    setCashReceived(hold.cashReceived || "");
    setSelectedProduct(null);
    persistHeldSales(heldSales.filter((item) => item.id !== hold.id));
  };

  const discardHeldSale = (holdId) => {
    persistHeldSales(heldSales.filter((item) => item.id !== holdId));
  };

  useEffect(() => {
    if (!pendingSaleProductId) return;
    const product = products.find((candidate) => candidate.id === pendingSaleProductId);
    if (!product || schoolOf(product) !== selectedSchool) return;
    setSelectedProduct(pendingSaleProductId);
    setPendingSaleProductId("");
  }, [pendingSaleProductId, products, selectedSchool]);

  const isPasswordSetupLink = () => /(?:^|&)type=(?:invite|recovery)(?:&|$)/.test(window.location.hash.slice(1));

  // 环境变量检查 - 应用启动时验证关键配置
  useEffect(() => {
    const { errors: envErrors } = validateAllEnvVars();
    if (envErrors && envErrors.length > 0) {
      const errorUI = getStartupErrorUI(envErrors);
      setEnvError(errorUI);
      console.error("❌ 环境配置错误:", envErrors);
    }
  }, []);

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
            .select("id, display_name, role, branch_id")
            .eq("id", data.session.user.id)
            .maybeSingle();
          if (profile) {
            setSession({ id: profile.id, name: profile.display_name, role: profile.role, branchId: profile.branch_id || "" });
          } else {
            setSession(null);
          }
        } else if (active) {
          setSession(null);
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
    if (session && !newTabsAlwaysAllowed.includes(tab) && !perms.tabs.includes(tab)) {
      setTab(perms.tabs[0]);
    }
  }, [perms, session, tab]);

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

  // 只有公開客人登記頁才使用遊客身份；員工頁面可帶 school_id 而不跳過登入。
  useEffect(() => {
    if (window.location.pathname !== "/checkin") return;
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
    const s = { id: account.id, name: account.name, role: account.role, branchId: account.branchId || "" };
    setSession(s);
    window.storage.set("current-session", JSON.stringify(s), false).catch((e) => console.error("記住登入狀態失敗", e));
    navigate("/menu");
  };

  const loginWithAuth = async (email, password) => {
    if (!supabase) return { error: "Supabase 未設定" };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "登入失敗，請檢查電郵及密碼。" };
    const { data: profile, error: profileError } = await supabase
      .from("staff_profiles")
      .select("id, display_name, role, branch_id")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError || !profile) {
      await supabase.auth.signOut();
      return { error: "帳戶尚未設定員工角色，請聯絡管理員。" };
    }
    setSession({ id: profile.id, name: profile.display_name, role: profile.role, branchId: profile.branch_id || "" });
    await refreshFromCloud({ skipProductsWhileEditing: false });
    navigate("/menu");
    return { error: "" };
  };

  const finishPasswordSetup = async (password) => {
    if (!supabase || password.length < 8) return { error: "密碼最少需要 8 個字元。" };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: "設定密碼失敗，請重新開啟邀請連結。" };
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("staff_profiles")
      .select("id, display_name, role, branch_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) return { error: "找不到員工角色，請聯絡管理員。" };
    setSession({ id: profile.id, name: profile.display_name, role: profile.role, branchId: profile.branch_id || "" });
    window.history.replaceState({}, document.title, window.location.pathname);
    setPasswordSetupRequired(false);
    return { error: "" };
  };

  const logout = () => {
    if (!window.confirm("確定要登出目前帳戶？")) return;
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
      setSelectedSchool(() => (
        schools.includes(DESIGNATED_SCHOOL)
          ? DESIGNATED_SCHOOL
          : (schools[0] || DESIGNATED_SCHOOL)
      ));
    }
  }, [schools, selectedSchool]);

  useEffect(() => {
    if (!["/menu", "/sale", "/products"].includes(location.pathname)) return;
    const routeSchool = new URLSearchParams(location.search).get("school_id")
      || new URLSearchParams(location.search).get("school");
    if (routeSchool && schools.includes(routeSchool) && routeSchool !== selectedSchool) {
      setSelectedSchool(routeSchool);
    }
  }, [location.pathname, location.search, schools]);

  useEffect(() => {
    if (!products.some((product) => product.id === selectedProduct)) {
      setSelectedProduct(null);
    }
  }, [products, selectedProduct]);

  const pickSchool = (sc) => {
    const nextSchool = sc || DESIGNATED_SCHOOL;
    setSelectedSchool(nextSchool);
    setSelectedProduct(null);
    setCart([]);
    setCashReceived("");
    setReceipt(null);
    setStorageError("");
    setSchoolPanelOpen(false);
    window.storage.set("last-school", nextSchool, false).catch((e) => console.error("記住學校選擇失敗", e));
    if (["/menu", "/sale", "/products"].includes(location.pathname)) {
      navigate(`${location.pathname}?school_id=${encodeURIComponent(nextSchool)}`);
    }
  };

  // 由雲端（共用儲存）攞返最新一份 products / sales-log
  const refreshFromCloud = async ({ skipProductsWhileEditing = true } = {}) => {
    if (!authReady || (isSupabaseAuthEnabled && !session)) return;
    setSyncing(true);
    try {
      const refreshGeneration = productsSaveGenerationRef.current;
      const skipProducts = skipProductsWhileEditing && (tabRef.current === "products" || productsSavePendingRef.current);
      
      // 各個加載函數都應該返回有效數據或空陣列/null，不應拋出異常
      const loadProductsSafe = skipProducts 
        ? Promise.resolve(null)
        : (isSupabaseAuthEnabled ? loadSecureProducts() : loadProducts({
            storage: window.storage,
            supabase,
            isSupabaseAuthEnabled,
            fallbackProducts: PRODUCT_CATALOG_FALLBACK,
          })).catch((error) => {
            console.error("載入產品失敗", error);
            return null;
          });

      const loadOrdersSafe = isSupabaseAuthEnabled 
        ? loadSecureOrders().catch((error) => {
            console.error("載入訂單失敗", error);
            return null;
          })
        : window.storage.get("sales-log", true).catch((error) => {
            console.error("載入本地銷售記錄失敗", error);
            return null;
          });

      const loadAccountsSafe = window.storage.get("staff-accounts", true).catch((error) => {
        console.error("載入員工帳戶失敗", error);
        return null;
      });

      const loadSchoolMetaSafe = window.storage.get("school-meta", true).catch((error) => {
        console.error("載入學校元數據失敗", error);
        return null;
      });
      const loadBranchSchoolMapSafe = loadBranchSchoolMap().catch((error) => {
        console.error("載入分店學校分配失敗", error);
        return {};
      });

      const [p, s, a, sm, branchMap] = await Promise.all([
        loadProductsSafe,
        loadOrdersSafe,
        loadAccountsSafe,
        loadSchoolMetaSafe,
        loadBranchSchoolMapSafe,
      ]);
      setBranchSchoolIds(branchMap);

      if (p && !productsSavePendingRef.current && !productsSaveBlockedRef.current && refreshGeneration === productsSaveGenerationRef.current) {
        const authoritative = enforceAuthoritativeProducts(p);
        if (authoritative.length > 0) {
          setSourceIntegrityWarning(p.length > 0 ? "" : "產品資料來源暫時沒有記錄，已保留目前商品資料。");
          setProducts(authoritative);
        } else if (p.length > 0) {
          setSourceIntegrityWarning("產品資料來源不完整：目前只檢測到示範資料，已阻止當作正式產品庫。");
        }
      }
      
      if (isSupabaseAuthEnabled ? Array.isArray(s) : s) {
        try {
          setSalesLog(isSupabaseAuthEnabled ? s : JSON.parse(s.value));
        } catch (parseError) {
          console.error("解析銷售記錄失敗", parseError);
        }
      }
      
      if (a && a.value) {
        try {
          setAccounts(JSON.parse(a.value));
        } catch (parseError) {
          console.error("解析員工帳戶失敗", parseError);
        }
      }
      
      if (sm && sm.value) {
        try {
          setSchoolMeta(JSON.parse(sm.value));
        } catch (parseError) {
          console.error("解析學校元數據失敗", parseError);
        }
      }
      
      setLastSync(new Date());
    } catch (e) {
      console.error("同步失敗，但應用應繼續運行", e);
      // 不重新拋出異常，允許應用繼續運行
    } finally {
      setSyncing(false);
    }
  };

  const loadSecureOrders = async () => {
    if (!supabase) return [];
    try {
      let { data, error } = await supabase
        .from("orders")
        .select("id, school, branch_id, outlet_name, outlet_address, outlet_phone, customer_surname, customer_phone_last4, exchange_source_receipt_id, refund_due, cashier_id, cashier_name, total, item_count, created_at, order_items(name, size, length, price, qty)")
        .order("created_at", { ascending: false });
      
      if (error?.code === "42703") {
        console.warn("orders 表結構版本不相容，嘗試使用簡化查詢", error);
        ({ data, error } = await supabase
          .from("orders")
          .select("id, school, exchange_source_receipt_id, cashier_id, cashier_name, total, item_count, created_at, order_items(name, size, price, qty)")
          .order("created_at", { ascending: false }));
      }
      if (error?.code === "42703") {
        console.warn("來源單據欄位尚未同步，使用基本訂單查詢", error);
        ({ data, error } = await supabase
          .from("orders")
          .select("id, school, cashier_id, cashier_name, total, item_count, created_at, order_items(name, size, price, qty)")
          .order("created_at", { ascending: false }));
      }
      
      if (error) {
        console.error("loadSecureOrders 查詢失敗", error);
        // 查詢失敗時保留現有記錄，避免同步錯誤清空畫面。
        return null;
      }
      
      return (data || []).map((order) => {
        try {
          const created = new Date(order.created_at);
          return {
            id: order.id,
            date: created.toISOString().slice(0, 10),
            time: created.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" }),
            items: (order.order_items || []).map((item) => ({ ...item, length: item.length || "" })),
            total: Math.max(0, Number(order.total || 0)),
            refundDue: Math.max(0, Number(order.refund_due || 0)),
            itemCount: order.item_count,
            cashierId: order.cashier_id,
            cashierName: order.cashier_name,
            school: order.school,
            branchId: order.branch_id || "",
            outletName: order.outlet_name,
            outletAddress: order.outlet_address,
            outletPhone: order.outlet_phone,
            customerName: order.customer_surname || "",
            customerPhone: order.customer_phone_last4 || "",
            exchangeSourceReceiptId: order.exchange_source_receipt_id || order.exchangeSourceReceiptId || order.source_receipt_id || "",
          };
        } catch (mapError) {
          console.error("轉換訂單數據失敗", mapError, order);
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      console.error("loadSecureOrders 異常", error);
      return null;
    }
  };

  const loadSecureProducts = async () => {
    if (!supabase) return [];
    const { data, error } = await supabase.from("products").select("id, school, name, sizes, display_order, branch_id").order("display_order", { ascending: true, nullsFirst: false }).order("name");
    if (error) throw error;
    return data || [];
  };

  const loadBranchSchoolMap = async () => {
    if (!supabase || !isSupabaseAuthEnabled || !session || session.role === ROLES.ADMIN) return {};
    const { data, error } = await supabase.from("school_branches").select("school, branch_id");
    if (error) throw error;
    return Object.fromEntries((data || []).map((entry) => [entry.school, entry.branch_id]));
  };

  useEffect(() => {
    if (!authReady) return;
    if (isSupabaseAuthEnabled && !session) {
      setLoaded(true);
      return;
    }
    
    (async () => {
      try {
        const deleted = await window.storage.get("deleted-schools", false).catch(() => null);
        const deletedList = deleted && deleted.value ? JSON.parse(deleted.value) : [];
        deletedSchoolsRuntime = new Set(Array.isArray(deletedList) ? deletedList : []);
        setDeletedSchools([...deletedSchoolsRuntime]);
        const p = isSupabaseAuthEnabled
          ? await loadSecureProducts()
          : await loadProducts({
            storage: window.storage,
            supabase,
            isSupabaseAuthEnabled,
            fallbackProducts: PRODUCT_CATALOG_FALLBACK,
          });
        const s = isSupabaseAuthEnabled ? await loadSecureOrders() : await window.storage.get("sales-log", true).catch(() => null);
        const a = await window.storage.get("staff-accounts", true).catch(() => null);
        const sm = await window.storage.get("school-meta", true).catch(() => null);
        const branchMap = await loadBranchSchoolMap();
        setBranchSchoolIds(branchMap);
        if (p) {
          const authoritative = enforceAuthoritativeProducts(p)
            .filter((product) => !isSupabaseAuthEnabled
              || !session?.branchId
              || session.role === ROLES.ADMIN
              || product.branch_id === session.branchId
              || branchMap[schoolOf(product)] === session.branchId);
          if (authoritative.length > 0) {
            setSourceIntegrityWarning(p.length > 0 ? "" : "產品資料來源暫時沒有記錄，已保留目前商品資料。");
            setProducts(authoritative);
            if (session?.branchId && session.role !== ROLES.ADMIN && selectedSchool && !authoritative.some((product) => schoolOf(product) === selectedSchool)) {
              setSelectedSchool(schoolOf(authoritative[0]) || "");
            }
          } else if (p.length > 0) {
            setSourceIntegrityWarning("產品資料來源不完整：目前只檢測到示範資料，已阻止當作正式產品庫。");
          }
        }
        if (isSupabaseAuthEnabled ? Array.isArray(s) : s) setSalesLog(isSupabaseAuthEnabled ? s : JSON.parse(s.value));
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
  }, [authReady, session]);

  // 第一次加載時自動刷新以確保從 Supabase 加載產品
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loaded && authReady && (!isSupabaseAuthEnabled || session) && products.length <= 20) {
        // 如果只有默認產品或很少的產品，嘗試從 Supabase 重新加載
        refreshFromCloud({ skipProductsWhileEditing: false });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [loaded]);

  // 每30秒自動由雲端拉一次最新資料
  useEffect(() => {
    if (!authReady || (isSupabaseAuthEnabled && !session)) return undefined;
    const timer = setInterval(() => {
      refreshFromCloud();
    }, 30000);
    return () => clearInterval(timer);
  }, [authReady, session]);

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
    if (!Array.isArray(next) || next.length === 0) {
      const message = "拒絕保存空商品清單，避免刪除整個商品庫。請先載入或匯入商品資料。";
      setProductsSaveError(message);
      setProductsSaveState("error");
      return false;
    }
    productsRef.current = next;
    setProducts(next);
    setProductsSaveError("");
    setProductsSaveState("pending");
    productsSavePendingRef.current = true;
    productsSaveBlockedRef.current = false;
    const saveGeneration = ++productsSaveGenerationRef.current;
    if (productsSaveTimerRef.current) clearTimeout(productsSaveTimerRef.current);
    productsSaveTimerRef.current = setTimeout(() => {
      productsPersistQueueRef.current = productsPersistQueueRef.current
        .catch(() => {})
        .then(() => persistProducts(next, options))
        .catch((error) => {
          const detail = error?.message || error?.code || "未知錯誤";
          if (saveGeneration === productsSaveGenerationRef.current) {
            productsSaveBlockedRef.current = true;
            setProductsSaveError(`商品未能保存：${detail}`);
            setProductsSaveState("error");
          }
          throw error;
        })
        .then(() => {
          if (saveGeneration === productsSaveGenerationRef.current) setProductsSaveState("saved");
        })
        .finally(() => {
          if (saveGeneration === productsSaveGenerationRef.current) productsSavePendingRef.current = false;
        });
      productsSaveTimerRef.current = null;
    }, 500);
  };

  const saveProductsNow = async () => {
    if (productsSaveTimerRef.current) {
      clearTimeout(productsSaveTimerRef.current);
      productsSaveTimerRef.current = null;
    }
    const next = productsRef.current;
    if (!Array.isArray(next) || next.length === 0) {
      setProductsSaveError("拒絕保存空商品清單，避免刪除整個商品庫。請先載入或匯入商品資料。");
      setProductsSaveState("error");
      return false;
    }
    const saveGeneration = ++productsSaveGenerationRef.current;
    productsSavePendingRef.current = true;
    setProductsSaveError("");
    setProductsSaveState("saving");
    productsSaveBlockedRef.current = false;
    productsPersistQueueRef.current = productsPersistQueueRef.current
      .catch(() => {})
      .then(() => persistProducts(next));
    try {
      await productsPersistQueueRef.current;
      if (saveGeneration === productsSaveGenerationRef.current) setProductsSaveState("saved");
      return true;
    } catch (error) {
      const detail = error?.message || error?.code || "未知錯誤";
      if (saveGeneration === productsSaveGenerationRef.current) {
        productsSaveBlockedRef.current = true;
        setProductsSaveError(`商品未能保存：${detail}`);
        setProductsSaveState("error");
      }
      return false;
    } finally {
      if (saveGeneration === productsSaveGenerationRef.current) productsSavePendingRef.current = false;
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
        const persistedOrder = { ...order, total: Math.max(0, Number(order.total || 0)) };
        const { data: receiptId, error } = await supabase.rpc("create_order_with_items", {
          order_data: {
            ...persistedOrder,
            id: requestedReceiptId,
            cashier_id: order.cashierId,
            cashier_name: order.cashierName,
            item_count: order.itemCount,
            outlet_name: order.outletName,
            outlet_address: order.outletAddress,
            outlet_phone: order.outletPhone,
            customer_surname: customerSurname(order.customerName),
            customer_phone_last4: customerPhoneLast4(order.customerPhone),
            exchange_source_receipt_id: order.exchangeSourceReceiptId || null,
            refund_due: Math.max(0, Number(order.refundDue || 0)),
            created_at: new Date().toISOString(),
          },
        });

        if (!error) {
          savedOrder = { ...order, id: receiptId || requestedReceiptId };
        } else if (error.code === "42702" || error.code === "23505" || error.code === "23514") {
          const fallbackOrder = { ...persistedOrder, id: `${requestedReceiptId}-${uid()}` };
          const fallbackResult = await insertSalesOrderRecord(fallbackOrder, salesLog);
          savedOrder = fallbackResult.savedOrder;
        } else if (error.message && /row-level security policy|policy|cashier_id|column .* does not exist/i.test(error.message)) {
          const fallbackResult = await insertSalesOrderRecord(persistedOrder, salesLog);
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

  const addToCart = (product, sizeObj, quantity = 1) => {
    const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
    setCart((prev) => {
      const idx = prev.findIndex((c) => !c.exchangeReturn
        && c.productId === product.id
        && sizeIdentityKey(c) === sizeIdentityKey(sizeObj));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { key: uid(), productId: product.id, name: product.name, size: sizeObj.size, length: sizeObj.length || "", isTailored: Boolean(sizeObj.isTailored), price: sizeObj.price, qty }];
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

  const startExchange = (order, selectedItems) => {
    const items = Array.isArray(selectedItems) ? selectedItems : [selectedItems];
    const exchangeItems = items.map((item) => {
      const product = products.find((candidate) => candidate.name === item.name || candidate.id === item.productId);
      const originalSize = product?.sizes?.find((size) => sizeIdentityKey(size) === sizeIdentityKey(item))
        || product?.sizes?.find((size) => String(size.size) === String(item.size) && isTailoredSize(size) === Boolean(item.isTailored));
      return { item, product, originalSize };
    });
    if (exchangeItems.some(({ product }) => !product)) {
      setStorageError("找不到原有貨品款式，請先更新商品資料後再試。");
      return;
    }
    if (exchangeItems.some(({ originalSize }) => !originalSize)) {
      setStorageError("找不到原有貨品碼數，請先更新商品資料後再試。");
      return;
    }
    setSelectedSchool(order.school || selectedSchool);
    setCart(exchangeItems.map(({ item, product, originalSize }) => ({
      key: uid(),
      productId: product.id,
      name: item.name,
      size: item.size,
      length: item.length || "",
      isTailored: Boolean(item.isTailored || originalSize.isTailored),
      price: Math.abs(Number(item.price || originalSize.price || 0)),
      qty: Math.max(1, Number(item.qty || 1)),
      exchangeReturn: true,
      exchangeSourceReceiptId: order.id || "",
      sourceGuestName: order.customerName || "",
      sourceGuestPhone: order.customerPhone || "",
    })));
    setCashReceived("");
    setSelectedProduct(null);
    const replacementQueue = exchangeItems.map(({ product }) => product.id);
    exchangeReplacementQueueRef.current = replacementQueue;
    setExchangeReplacementQueue(replacementQueue);
    setPendingSaleProductId(exchangeItems[0].product.id);
    setReceipt(null);
    setTab("sale");
    navigate("/sale", { replace: true });
  };

  useEffect(() => {
    if (!authReady || (isSupabaseAuthEnabled && !session)) return undefined;
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
      })
      .subscribe(async (status) => {
        // 訂閱成功時立即載入初始數據
        if (status === "SUBSCRIBED" && isMounted) {
          const data = await queueOrderService.listOrders();
          const normalized = (data || [])
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
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [authReady, session]);

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
    if (!guest) return;
    
    setSelectedGuest(guest);
    setTab("fitting");
    
    // 使用 guest.id 優先（Supabase 的 UUID），次序為 queueNo
    const guestId = guest?.id || guest?.queueNo || "";
    
    if (!guestId) {
      console.warn("handleAssignGuest: guest 缺少 ID 或 queueNo", guest);
      alert("無法進入度身頁面：訂單資訊缺失，請重新選擇");
      return;
    }
    
    console.log("handleAssignGuest: navigating to fitting", {
      guestId,
      guestName: guest?.guestName,
      queueNo: guest?.queueNo,
      selectedSchool,
    });
    
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
      customerPhone: ticket.phone || ticket.customerPhone || "",
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
    if (!order) return false;
    const parseRecord = (value) => {
      if (value && typeof value === "object") return value;
      if (typeof value !== "string") return {};
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    };
    const tailorInfo = parseRecord(order.tailor_info || order.tailorInfo);
    const itemCandidates = [
      tailorInfo.items,
      tailorInfo.selected_items,
      tailorInfo.selectedItems,
      tailorInfo.products,
      order.items,
      order.customer_info?.items,
    ];
    const sourceItems = itemCandidates.find((value) => Array.isArray(value))
      || Object.values(itemCandidates.find((value) => value && typeof value === "object") || {});
    const readyItems = sourceItems.map((item, index) => {
      const productName = item.product_name || item.productName || item.name || "未知產品";
      const productId = item.product_id || item.productId || "";
      const product = products.find((p) => p.id === productId || p.name === productName) || null;
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
        sourceGuestName: order.customer_info?.guestName || order.guestName || order.customerName || "",
        sourceGuestPhone: order.customer_info?.phone || order.phone || order.customerPhone || "",
      };
    });

    if (!readyItems.length) {
      setStorageError("此訂單沒有可銷售商品，請返回取貨頁重新載入訂單。");
      return false;
    }
    if (order.school) setSelectedSchool(order.school);
    setCart(readyItems);
    setCashReceived("");
    setSelectedProduct(null);
    setTab("sale");
    navigate("/sale", { replace: true });
    return true;
  };

  const handleConfirmPayment = async (payment) => {
    try {
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
            branchId: session?.branchId || "",
            school: paidOrder.school || selectedSchool || "",
            customerName: paidOrder.guestName || paidOrder.customerName || "",
            customerPhone: paidOrder.customerPhone || paidOrder.phone || "",
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
      
      // 異步刷新雲端數據，但不阻止導航
      if (refreshFromCloud) {
        refreshFromCloud({ skipProductsWhileEditing: false }).catch((error) => {
          console.error("同步支付後記錄失敗，但已安全返回到銷售記錄頁", error);
        });
      }
    } catch (error) {
      console.error("handleConfirmPayment 錯誤", error);
      // 即使發生錯誤也應該返回到 records 頁面
      setTab("records");
      navigate("/records", { replace: true });
    }
  };

  const cartTotal = cart.reduce((sum, c) => sum + (c.exchangeReturn ? -1 : 1) * c.price * c.qty, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);
  const exchangeMode = cart.some((item) => item.exchangeReturn);
  const cartSourceMeta = cart.find((item) => item.sourceQueueNo || item.sourceGuestName) || {};
  const cashAmount = exchangeMode
    ? (cashReceived === "" ? 0 : Number(cashReceived || 0))
    : (cashReceived === "" ? cartTotal : Number(cashReceived || 0));
  const settlementDifference = cashAmount - cartTotal;
  const changeDue = exchangeMode ? Math.max(cartTotal - cashAmount, 0) : Math.max(settlementDifference, 0);
  const refundDue = exchangeMode ? Math.max(-cartTotal - cashAmount, 0) : 0;

  const checkout = async () => {
    if (cart.length === 0 || checkoutSubmittingRef.current) return;
    checkoutSubmittingRef.current = true;
    const now = new Date();
    const received = cashReceived === ""
      ? (exchangeMode ? 0 : cartTotal)
      : Number(cashReceived || 0);
    const sourceMeta = cart.find((item) => item.sourceQueueNo || item.sourceGuestName) || {};
    const order = {
      id: "",
      date: todayStr(),
      time: now.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" }),
      items: cart.map(({ name, size, length, price, qty, exchangeReturn, exchangeSourceReceiptId }) => ({ name, size, length, price, qty, exchangeReturn, exchangeSourceReceiptId })),
      total: cartTotal,
      cashReceived: received,
      changeDue: exchangeMode ? Math.max(cartTotal - received, 0) : Math.max(received - cartTotal, 0),
      refundDue: exchangeMode ? Math.max(-cartTotal - received, 0) : 0,
      itemCount: cartCount,
      cashierId: session ? session.id : null,
      cashierName: session ? session.name : "",
      branchId: session?.branchId || "",
      school: selectedSchool || "",
      queueNo: sourceMeta.sourceQueueNo || "",
      guestName: sourceMeta.sourceGuestName || "",
      customerName: sourceMeta.sourceGuestName || "",
      customerPhone: sourceMeta.sourceGuestPhone || "",
      exchangeSourceReceiptId: cart.find((item) => item.exchangeSourceReceiptId)?.exchangeSourceReceiptId || "",
    };
    const outlet = outletForSchool(order.school, schoolMeta);
    if (outlet) {
      order.outletName = outlet.name;
      order.outletAddress = outlet.address;
      order.outletPhone = outlet.phone;
    }

    const sourceOrderIds = [...new Set(cart.filter((item) => item.sourceOrderId).map((item) => item.sourceOrderId))];
    const sourceSaleId = localReceiptId(salesLog);

    if (sourceOrderIds.length > 0 && isSupabaseConfigured && supabase) {
      try {
        await Promise.all(sourceOrderIds.map(async (sourceOrderId) => {
          const { data, error } = await supabase
            .from("customer_orders")
            .update({
              status: "COMPLETED",
              tailor_info: { paid_at: new Date().toISOString(), source_sale_id: sourceSaleId, payment: { method: "cash", cashReceived: received, changeDue: Math.max(received - cartTotal, 0) } },
            })
            .eq("id", sourceOrderId)
            .eq("school_id", order.school)
            .eq("status", "READY")
            .select("id, status");
          if (error) throw error;
          if (!data?.[0]) {
            const { data: existing } = await supabase
              .from("customer_orders")
              .select("id, status, tailor_info")
              .eq("id", sourceOrderId)
              .eq("school_id", order.school)
              .maybeSingle();
            if (existing?.status !== "COMPLETED" || existing.tailor_info?.source_sale_id !== sourceSaleId) {
              throw new Error("來源訂單未成功完成");
            }
          } else if (data[0].status !== "COMPLETED") {
            throw new Error("來源訂單未成功完成");
          }
        }));
      } catch (error) {
        console.error("同步已支付客戶訂單失敗，保留購物車", error);
        setStorageError("來源訂單未能同步完成，交易尚未完成；請檢查網絡後再試。 ");
        checkoutSubmittingRef.current = false;
        return;
      }
    }

    const savedOrder = await saveSalesLog([order, ...salesLog]);
    if (!savedOrder) {
      if (sourceOrderIds.length > 0 && isSupabaseConfigured && supabase) {
        await Promise.all(sourceOrderIds.map((sourceOrderId) => supabase.from("customer_orders").update({ status: "READY" }).eq("id", sourceOrderId).eq("school_id", order.school)));
      }
      checkoutSubmittingRef.current = false;
      return;
    }

    sourceOrderIds.forEach((sourceOrderId) => {
      window.dispatchEvent(new CustomEvent("customer-order-paid", { detail: { orderId: sourceOrderId } }));
    });

    setReceipt(savedOrder);
    setCart([]);
    setSelectedProduct(null);
    exchangeReplacementQueueRef.current = [];
    setExchangeReplacementQueue([]);
    checkoutSubmittingRef.current = false;
  };

  const advanceExchangeReplacement = () => {
    const [, ...remaining] = exchangeReplacementQueueRef.current;
    exchangeReplacementQueueRef.current = remaining;
    setExchangeReplacementQueue(remaining);
    setPendingSaleProductId(remaining[0] || "");
    setSelectedProduct(remaining[0] || null);
    return remaining[0] || "";
  };

  const printBrowser = () => {
    window.print();
  };

  const printBluetooth = async (order, language = "zh") => {
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

      const lines = buildReceiptLines(order, order.school || "校服銷售收據", language);
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
  const publicRouteOutlet = new URLSearchParams(location.search).get("outlet") || "";
  const publicQueueService = (new URLSearchParams(location.search).get("service") || "").toUpperCase();
  const routeId = new URLSearchParams(location.search).get("id");
  const isDirectoryPage = location.pathname === "/menu";

  useEffect(() => {
    if (location.pathname === "/" && publicRouteSchool) {
      navigate(`/checkin?school_id=${encodeURIComponent(publicRouteSchool)}`);
    }
  }, [location.pathname, publicRouteSchool, navigate]);

  useEffect(() => {
    if (!isDirectoryPage && schoolPanelOpen) {
      setSchoolPanelOpen(false);
    }
  }, [isDirectoryPage, schoolPanelOpen]);

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
      products: "/products",
      records: "/records",
      staff: "/staff",
    };
    if (routeMap[nextTab]) {
      const schoolQuery = selectedSchool
        ? `?school_id=${encodeURIComponent(selectedSchool)}`
        : "";
      navigate(`${routeMap[nextTab]}${schoolQuery}`);
    }
  };

  const directoryIds = session?.role === ROLES.SALES
    ? perms?.tabs || []
    : [
      "sale",
      "guest",
      "queue",
      "track",
      "fitting",
      "pickup",
      "cashier",
      ...(perms?.tabs || []),
    ];

  if (location.pathname === "/checkin") {
    return <Suspense fallback={<PageLoading />}><CustomerCheckinPage school={publicRouteSchool} schools={customerSchools} schoolMeta={schoolMeta} onSubmit={handleGuestSubmit} /></Suspense>;
  }

  if (location.pathname === "/queue-status") {
    return <Suspense fallback={<PageLoading />}><GuestQueueStatusPage queueNo={routeId || publicQueueParam || ""} schoolName={publicRouteSchool || ""} schools={customerSchools} /></Suspense>;
  }

  if (location.pathname === "/queue-display") {
    return <Suspense fallback={<PageLoading />}><QueueDisplayPage schoolName={publicRouteSchool} outletName={publicRouteOutlet} serviceType={publicQueueService} /></Suspense>;
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
    return <PublicHomePage schools={schools} schoolMeta={schoolMeta} onStaffLogin={() => navigate("/menu")} />;
  }

  if (!session) {
    return <LoginScreen accounts={accounts} onLogin={login} onAuthLogin={loginWithAuth} useSupabaseAuth={isSupabaseAuthEnabled} />;
  }

  return (
    <AppErrorBoundary>
      <div className="pos-shell" style={{ maxWidth: 760, minHeight: "100vh", margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif", background: "#F7F9FC", boxShadow: "0 0 32px rgba(15, 23, 42, 0.06)" }}>
        <style>{`
        :root { color-scheme: light; }
        body { margin: 0; background: #EAF0F6; color: #172B4D; }
        button, input, select, textarea { font: inherit; }
        @media print {
          body * { visibility: hidden; }
          #print-receipt, #print-receipt * { visibility: visible; }
          #print-receipt { position: absolute; top: 0; left: 0; width: 58mm; font-family: monospace; }
        }
        .pos-btn { cursor: pointer; border: none; outline: none; }
        .pos-btn:active { transform: scale(0.97); }
        .pos-page-content { padding: 20px; }
        .pos-page-content > * { max-width: 100%; }
        .sale-product-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .sale-product-button { min-height: 76px; }
        .sale-size-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .sale-size-button { min-height: 76px; }
        @media (max-width: 560px) {
          .pos-page-content { padding: 14px; }
          .sale-product-grid { gap: 8px; }
          .sale-product-button { min-height: 76px; padding: 10px 8px !important; font-size: 16px !important; line-height: 1.35; }
          .sale-size-grid { gap: 8px; }
          .sale-size-button { min-height: 76px; padding: 10px 8px !important; font-size: 16px !important; line-height: 1.35; }
        }
        @media (min-width: 760px) {
          .pos-shell { box-sizing: border-box; border-left: 1px solid #DCE5EF; border-right: 1px solid #DCE5EF; }
        }
      `}</style>

        {envError && (
          <div style={{ padding: "12px 16px" }}>
            <Alert
              type="error"
              title={envError.title}
              message={envError.message}
              onClose={() => setEnvError(null)}
            >
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                {envError.errors?.map((err, idx) => (
                  <li key={idx} style={{ fontSize: 12, marginTop: 4 }}>
                    <strong>{err.message}</strong>
                    <div style={{ opacity: 0.8, marginTop: 2 }}>{err.suggestion}</div>
                  </li>
                ))}
              </ul>
            </Alert>
          </div>
        )}

        <div style={{ background: "linear-gradient(135deg, #1F3A5F 0%, #294D78 100%)", color: "#fff", padding: "18px 20px", borderRadius: isDirectoryPage && schoolPanelOpen ? "0" : "0 0 16px 16px", position: "relative", boxShadow: "0 3px 12px rgba(31, 58, 95, 0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          {session.role === ROLES.GUEST ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{selectedSchool}</div>
                <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>客人登記系統</div>
              </div>
            </div>
          ) : schools.length > 0 ? (
            isDirectoryPage ? (
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
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{selectedSchool || "校服銷售"}</div>
                  <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>{todayStr()}</div>
                </div>
              </div>
            )
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
            {session.role !== ROLES.GUEST && selectedSchool && (
              <button
                className="pos-btn"
                onClick={() => {
                  const outlet = outletNameForSchool(selectedSchool, schoolMeta);
                  const url = `/queue-display?school_id=${encodeURIComponent(selectedSchool)}&outlet=${encodeURIComponent(outlet)}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, opacity: 0.9, background: "rgba(255,255,255,0.12)", color: "#fff", padding: "4px 8px", borderRadius: 8 }}
                title="開啟目前學校的公開叫號頁"
              >
                <QrCode size={12} />
                公開叫號頁
              </button>
            )}
            <button
              className="pos-btn"
              onClick={logout}
              style={{ fontSize: 11, opacity: 0.9, background: "rgba(255,255,255,0.12)", color: "#fff", padding: "4px 8px", borderRadius: 8 }}
              title="登出"
            >
              {session.name}（{(ROLE_LABEL[session.role] || ROLE_LABEL[ROLES.STAFF]).split("／")[0].replace(" ADMIN", "")}）· 登出
            </button>
          </div>
        </div>

        {isDirectoryPage && schoolPanelOpen && schools.length > 0 && session.role !== ROLES.GUEST && (
          <StoreSchoolSwitcher
            schools={schools}
            schoolMeta={schoolMeta}
            selectedSchool={selectedSchool}
            onPick={pickSchool}
          />
        )}
      </div>
      {isDirectoryPage && schoolPanelOpen && <div style={{ height: 16, background: "#294D78", borderRadius: "0 0 16px 16px" }} />}

      {session.role !== ROLES.GUEST && !isDirectoryPage && (
        <div style={{ padding: "12px 16px 0" }}>
          <button
            className="pos-btn"
            onClick={() => navigate("/menu")}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: location.pathname === "/menu" ? "#1F3A5F" : "#EEF1F5", color: location.pathname === "/menu" ? "#fff" : "#1F3A5F", fontSize: 14, fontWeight: 700 }}
          >
            返回目錄
          </button>
        </div>
      )}

      {(() => {
        const queueParam = new URLSearchParams(window.location.search).get("queue");
        if (queueParam) {
          return <GuestQueueStatusPage queueNo={queueParam} schoolName={selectedSchool || ""} />;
        }
        return null;
      })()}

      <div className="pos-page-content">
        <Suspense fallback={<PageLoading />}>
          <Routes>
          <Route
            path="/checkin"
            element={<CustomerCheckinPage school={publicRouteSchool} schools={customerSchools} schoolMeta={schoolMeta} onSubmit={handleGuestSubmit} />}
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
            element={<div style={{ display: "grid", gap: 16 }}><QueuePage key="fitting-queue" serviceType={QUEUE_SERVICE.FITTING} visits={queueVisits} currentSchoolId={selectedSchool || publicRouteSchool} outletName={outletNameForSchool(selectedSchool || publicRouteSchool, schoolMeta)} calledBy={isSupabaseAuthEnabled ? session?.id || "" : ""} onViewGuest={(guest) => setSelectedGuest(guest)} onAssign={handleAssignGuest} /><QueuePage key="pickup-queue" serviceType={QUEUE_SERVICE.PICKUP} visits={queueVisits} currentSchoolId={selectedSchool || publicRouteSchool} outletName={outletNameForSchool(selectedSchool || publicRouteSchool, schoolMeta)} calledBy={isSupabaseAuthEnabled ? session?.id || "" : ""} onReadyForSale={handleReadyForSale} /></div>}
          />
          <Route
            path="/pickup"
            element={<PickupPage currentSchoolId={selectedSchool || publicRouteSchool} onReadyForSale={handleReadyForSale} />}
          />
          <Route
            path="/cashier"
            element={<CashierVerifyPage currentSchoolId={selectedSchool || publicRouteSchool} products={products.filter((p) => schoolOf(p) === (selectedSchool || publicRouteSchool))} onConfirmPayment={handleConfirmPayment} onReadyForSale={handleReadyForSale} />}
          />
          <Route
            path="/track"
            element={
              <StaffOrderTracking visits={queueVisits} currentSchoolId={selectedSchool || publicRouteSchool} onStatusUpdate={(id, status) => {
                setQueueVisits((prev) => prev.map(v => v.id === id ? {...v, status} : v));
              }} />
            }
          />
          <Route
            path="/qrcode"
            element={<Navigate to="/sale" replace />}
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
                onPickSchool={pickSchool}
              />
            }
          />
          <Route
            path="/records"
            element={
              <RecordsTab
                salesLog={salesLog}
                selectedSchool={selectedSchool || publicRouteSchool}
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
            path="/menu"
            element={<DirectoryPage availableIds={[...new Set(directoryIds)]} onNavigate={handleTabChange} />}
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
                exchangeMode={exchangeMode}
                refundDue={refundDue}
                exchangeReplacementQueue={exchangeReplacementQueue}
                onExchangeReplacementAdded={advanceExchangeReplacement}
                salesLog={salesLog}
                onExchange={startExchange}
                heldSales={heldSales}
                onHoldSale={holdCurrentSale}
                onResumeHeldSale={resumeHeldSale}
                onDiscardHeldSale={discardHeldSale}
                onClearCart={clearCartWithConfirmation}
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
                    exchangeMode={exchangeMode}
                    refundDue={refundDue}
                    exchangeReplacementQueue={exchangeReplacementQueue}
                    onExchangeReplacementAdded={advanceExchangeReplacement}
                    salesLog={salesLog}
                    onExchange={startExchange}
                    heldSales={heldSales}
                    onHoldSale={holdCurrentSale}
                    onResumeHeldSale={resumeHeldSale}
                    onDiscardHeldSale={discardHeldSale}
                    onClearCart={clearCartWithConfirmation}
                  />
                )}
                {tab === "guest" && (
                  <CustomerCheckinPage school={publicRouteSchool} onSubmit={handleGuestSubmit} />
                )}
                {tab === "queue" && (
                  <div style={{ display: "grid", gap: 16 }}><QueuePage key="fitting-queue" serviceType={QUEUE_SERVICE.FITTING} visits={queueVisits} currentSchoolId={selectedSchool || publicRouteSchool} outletName={outletNameForSchool(selectedSchool || publicRouteSchool, schoolMeta)} calledBy={isSupabaseAuthEnabled ? session?.id || "" : ""} onViewGuest={(guest) => setSelectedGuest(guest)} onAssign={handleAssignGuest} /><QueuePage key="pickup-queue" serviceType={QUEUE_SERVICE.PICKUP} visits={queueVisits} currentSchoolId={selectedSchool || publicRouteSchool} outletName={outletNameForSchool(selectedSchool || publicRouteSchool, schoolMeta)} calledBy={isSupabaseAuthEnabled ? session?.id || "" : ""} onReadyForSale={handleReadyForSale} /></div>
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
                  <CashierVerifyPage currentSchoolId={selectedSchool || publicRouteSchool} products={products.filter((p) => schoolOf(p) === (selectedSchool || publicRouteSchool))} onConfirmPayment={handleConfirmPayment} onReadyForSale={handleReadyForSale} />
                )}
                {tab === "track" && (
                  <StaffOrderTracking visits={queueVisits} currentSchoolId={selectedSchool || publicRouteSchool} onStatusUpdate={(id, status) => {
                    setQueueVisits((prev) => prev.map(v => v.id === id ? {...v, status} : v));
                  }} />
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
                    onPickSchool={pickSchool}
                  />
                )}
                {tab === "records" && (
                  <RecordsTab
                    salesLog={salesLog}
                    selectedSchool={selectedSchool || publicRouteSchool}
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
        </Suspense>
      </div>

      {receipt && (
        <ReceiptModal
          order={receipt}
          language={receiptLanguage}
          onLanguageChange={setReceiptLanguage}
          onClose={() => {
            setReceipt(null);
            setBtStatus({ state: "idle", msg: "" });
          }}
          onRedoSale={(order) => {
            const started = handleReadyForSale({ ...order, id: "" });
            if (started) {
              setReceipt(null);
              setBtStatus({ state: "idle", msg: "" });
            }
            return started;
          }}
          onExchange={startExchange}
          onPrintBrowser={() => printBrowser()}
          onPrintBluetooth={(language) => printBluetooth(receipt, language)}
          btStatus={btStatus}
        />
      )}

      <div id="print-receipt" ref={printAreaRef} style={{ display: "none" }}>
        {receipt && (
          <div style={{ padding: 8, fontSize: 12, lineHeight: 1.5 }}>
            {(() => {
              const labels = receiptFieldLabels(receiptLanguage);
              const english = receiptLanguage === "en";
              return <>
            <div style={{ textAlign: "center", fontWeight: 700 }}>{english ? "Victoria Uniform" : "Victoria Uniform 校服銷售"}</div>
            <div style={{ textAlign: "center" }}>{english ? "ELECTRONIC RECEIPT" : "電子銷售單 ELECTRONIC RECEIPT"}</div>
            <div>{labels.receiptNo}: #{(receipt.id || "").toUpperCase()}</div>
            {receipt.exchangeSourceReceiptId && <div>{labels.sourceReceipt}: #{String(receipt.exchangeSourceReceiptId).toUpperCase()}</div>}
            <div>{labels.date}: {receipt.date} {receipt.time}</div>
            <div>{labels.school}: {english && receipt.school === ENGLISH_RECEIPT_SCHOOL ? "YMCA of Hong Kong Christian College" : receipt.school || "-"}</div>
            <div>{labels.customer}: {customerSurname(receipt.customerName) || "-"}</div>
            <div>{labels.phone}: {customerPhoneLast4(receipt.customerPhone) || "-"}</div>
            <div>--------------------------------</div>
            <div>{labels.items}</div>
            {receipt.items.map((it, i) => (
              <div key={i}>
                <div>{it.exchangeReturn ? labels.exchangeOut : ""}{it.name}</div>
                <div>  {formatSizeForReceipt(it.name, it.size, it.length)}</div>
                <div>  {labels.quantity} {it.qty} {receiptProductUnit(it.name, receiptLanguage)} x {fmt(it.price)} = {fmt((it.exchangeReturn ? -1 : 1) * it.price * it.qty)}</div>
              </div>
            ))}
            <div>--------------------------------</div>
            <div>{labels.itemCount}: {receipt.itemCount}</div>
            <div style={{ fontWeight: 700 }}>{receipt.exchangeSourceReceiptId ? labels.exchangeTotal : labels.total}: {fmt(receipt.total)}</div>
            <div>{labels.status}: {receipt.exchangeSourceReceiptId ? labels.exchanged : labels.completed}</div>
            <div style={{ marginTop: 8, color: "#555", whiteSpace: "pre-line" }}>
              <strong>{labels.returnPolicy}</strong>{String.fromCharCode(10)}<strong>{labels.careTitle}</strong>{String.fromCharCode(10)}{labels.care}
            </div>
            <div style={{ textAlign: "center", marginTop: 8 }}>{labels.thanks}</div>
              </>;
            })()}
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
  exchangeMode = false,
  refundDue = 0,
  exchangeReplacementQueue = [],
  onExchangeReplacementAdded,
  salesLog = [],
  onExchange,
  heldSales = [],
  onHoldSale,
  onResumeHeldSale,
  onDiscardHeldSale,
  onClearCart,
}) {
  const [genderFilter, setGenderFilter] = useState("全部");
  const [selectedLength, setSelectedLength] = useState("");
  const [quantityPrompt, setQuantityPrompt] = useState(null);
  const [exchangePickerOpen, setExchangePickerOpen] = useState(false);
  const [exchangeOrder, setExchangeOrder] = useState(null);
  const [exchangeItems, setExchangeItems] = useState([]);
  const [exchangeItemQuantities, setExchangeItemQuantities] = useState({});
  const [exchangeSearch, setExchangeSearch] = useState("");
  const [directExchangeOpen, setDirectExchangeOpen] = useState(false);
  const [directExchangeProductId, setDirectExchangeProductId] = useState("");
  const [directExchangeLength, setDirectExchangeLength] = useState("");
  const [directExchangeQuantityPrompt, setDirectExchangeQuantityPrompt] = useState(null);
  const [directExchangeItems, setDirectExchangeItems] = useState([]);
  const schools = listSchools(products);
  const visibleProducts = (selectedSchool ? products.filter((p) => schoolOf(p) === selectedSchool) : products)
    .filter((product) => product.sizes.some(isPricedSize));
  const filteredProducts = visibleProducts.filter((product) =>
    genderFilter === "全部" || genderOf(product) === genderFilter || genderOf(product) === "男女通用"
  );
  const exchangeDate = todayStr();
  const exchangeOrders = selectedSchool
    ? salesLog.filter((order) =>
      String(order.school || "").trim() === String(selectedSchool).trim()
      && String(order.date || "").slice(0, 10) === exchangeDate
    )
    : [];
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const aIndex = products.findIndex((p) => p.id === a.id);
    const bIndex = products.findIndex((p) => p.id === b.id);
    return aIndex - bIndex;
  });

  useEffect(() => {
    if (
      selectedProduct
      && !filteredProducts.some((product) => product.id === selectedProduct)
      && !exchangeReplacementQueue.includes(selectedProduct)
    ) {
      setSelectedProduct(null);
    }
  }, [genderFilter, selectedSchool, products, selectedProduct, exchangeReplacementQueue]);

  useEffect(() => {
    setSelectedLength("");
  }, [selectedProduct]);

  useEffect(() => {
    if (!exchangeMode || selectedProduct || exchangeReplacementQueue.length === 0) return;
    setSelectedProduct(exchangeReplacementQueue[0]);
  }, [exchangeMode, selectedProduct, exchangeReplacementQueue]);

  useEffect(() => {
    setExchangePickerOpen(false);
    setExchangeOrder(null);
    setExchangeItems([]);
    setExchangeItemQuantities({});
    setExchangeSearch("");
  }, [selectedSchool]);

  const handleSizeSelect = (product, size) => {
    setQuantityPrompt({ product, size, quantity: "", custom: false });
  };

  const confirmQuantity = (selectedQuantity = quantityPrompt?.quantity) => {
    if (!quantityPrompt) return;
    const quantity = Number(selectedQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return;
    addToCart(quantityPrompt.product, quantityPrompt.size, quantity);
    setQuantityPrompt(null);
    setSelectedProduct(null);
    setSelectedLength("");
    if (exchangeMode && exchangeReplacementQueue.length > 0) {
      const nextProductId = onExchangeReplacementAdded?.();
      if (nextProductId) setSelectedProduct(nextProductId);
    }
  };

  const openExchangePicker = () => {
    setExchangePickerOpen(true);
    setExchangeOrder(null);
    setExchangeItems([]);
    setExchangeSearch("");
  };

  const confirmExchangeItems = () => {
    if (!exchangeOrder || exchangeItems.length === 0) return;
    const selectedWithQuantities = exchangeItems.map((item) => ({
      ...item,
      qty: Math.max(1, Math.min(Number(item.qty || 1), Number(exchangeItemQuantities[item._exchangeIndex] || 1))),
    }));
    onExchange?.(exchangeOrder, selectedWithQuantities);
    setExchangePickerOpen(false);
    setExchangeOrder(null);
    setExchangeItems([]);
    setExchangeItemQuantities({});
  };

  const startDirectExchange = (product, size, quantity = 1) => {
    setDirectExchangeItems((current) => {
      const itemKey = (item) => `${item.productId}::${sizeIdentityKey(item)}`;
      const newItem = {
          productId: product.id,
          name: product.name,
          size: size.size,
          length: size.length || "",
          isTailored: Boolean(size.isTailored),
          price: Number(size.price || 0),
          qty: quantity,
        };
      const existingIndex = current.findIndex((item) => itemKey(item) === itemKey(newItem));
      if (existingIndex < 0) return [...current, newItem];
      const next = [...current];
      next[existingIndex] = { ...next[existingIndex], qty: Math.min(99, Number(next[existingIndex].qty || 0) + quantity) };
      return next;
    });
    setDirectExchangeQuantityPrompt(null);
    setDirectExchangeProductId("");
    setDirectExchangeLength("");
  };

  const selectDirectExchangeProduct = (productId) => {
    setDirectExchangeQuantityPrompt(null);
    setDirectExchangeLength("");
    setDirectExchangeProductId(productId);
  };

  const confirmDirectExchange = () => {
    if (directExchangeItems.length === 0) return;
    onExchange?.({
      id: "",
      school: selectedSchool,
      customerName: "",
      customerPhone: "",
    }, directExchangeItems);
    setDirectExchangeQuantityPrompt(null);
    setDirectExchangeOpen(false);
    setDirectExchangeProductId("");
    setDirectExchangeLength("");
    setDirectExchangeItems([]);
  };

  return (
    <div>
      <button
        className="pos-btn"
        onClick={openExchangePicker}
        style={{ width: "100%", padding: "12px 0", borderRadius: 10, background: "#FFF7ED", color: "#9A3412", border: "1px solid #FDBA74", fontSize: 14, fontWeight: 700, marginBottom: 12 }}
      >
        快速換貨／補差額（可換多件）
      </button>
      <button
        className="pos-btn"
        onClick={() => { setDirectExchangeOpen(true); setDirectExchangeProductId(""); setDirectExchangeLength(""); setDirectExchangeQuantityPrompt(null); }}
        style={{ width: "100%", padding: "12px 0", borderRadius: 10, background: "#ECFDF3", color: "#166534", border: "1px solid #86EFAC", fontSize: 14, fontWeight: 700, marginBottom: 12 }}
      >
        遺失單據快速換貨（直接揀退回貨品）
      </button>
      {directExchangeOpen && (
        <div style={{ background: "#ECFDF3", border: "1px solid #86EFAC", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ color: "#166534", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>第一步：揀選客人退回的款式及尺碼</div>
          {directExchangeItems.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #86EFAC", borderRadius: 8, padding: 8, marginBottom: 10 }}>
              <div style={{ color: "#166534", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>已選退回貨品（{directExchangeItems.length}款）</div>
              {directExchangeItems.map((item) => (
                <div key={`${item.productId}-${item.size}-${item.length}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "4px 0", borderBottom: "1px solid #DCFCE7" }}>
                  <span>{displayProductName(item.name)}（{sizeLabel(item)}）× {item.qty}{productUnit(item.name)}</span>
                  <button className="pos-btn" onClick={() => setDirectExchangeItems((current) => current.filter((entry) => entry !== item))} style={{ padding: "2px 6px", background: "transparent", color: "#166534", fontSize: 11 }}>移除</button>
                </div>
              ))}
              <button className="pos-btn" onClick={confirmDirectExchange} style={{ width: "100%", marginTop: 8, padding: 9, borderRadius: 8, background: "#166534", color: "#fff", fontWeight: 800 }}>
                確定換貨（{directExchangeItems.length}款）
              </button>
            </div>
          )}
          {!directExchangeProductId ? (
            <div className="sale-product-grid" style={{ maxHeight: 260, overflowY: "auto" }}>
              {visibleProducts.map((product) => (
                <button key={product.id} className="pos-btn sale-product-button" onClick={() => selectDirectExchangeProduct(product.id)} style={{ padding: "10px 8px", borderRadius: 10, background: "#fff", border: "1px solid #86EFAC", color: "#166534", fontSize: 16, fontWeight: 700, textAlign: "left" }}>
                  {displayProductName(product.name)}
                </button>
              ))}
            </div>
          ) : (() => {
            const product = visibleProducts.find((item) => item.id === directExchangeProductId);
            if (!product) return null;
            const hasLengths = hasLengthOptions(product);
            const pricedSizes = product.sizes.filter(isPricedSize);
            const lengths = hasLengths ? [...new Set(pricedSizes.map((size) => size.length))].sort(naturalSizeSort) : [];
            const sizes = hasLengths && directExchangeLength ? pricedSizes.filter((size) => size.length === directExchangeLength) : pricedSizes;
            return (
              <div>
                <button className="pos-btn" onClick={() => { setDirectExchangeProductId(""); setDirectExchangeLength(""); setDirectExchangeQuantityPrompt(null); }} style={{ padding: "6px 8px", marginBottom: 8, background: "transparent", color: "#166534" }}>← 返回選款式</button>
                <div style={{ fontSize: 12, color: "#166534", marginBottom: 6 }}>{displayProductName(product.name)}：揀{hasLengths ? `${lengthDimensionLabel(product)}及${sizeDimensionLabel(product)}` : "尺碼"}</div>
                {directExchangeQuantityPrompt && (
                  <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 10, padding: 10, marginBottom: 10 }}>
                    <div style={{ color: "#166534", fontSize: 13, fontWeight: 800 }}>需要換貨數量</div>
                    <div style={{ color: "#166534", fontSize: 12, marginTop: 3 }}>{sizeLabel(directExchangeQuantityPrompt.size)}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 8 }}>
                      {[1, 2, 3].map((quantity) => (
                        <button key={quantity} className="pos-btn" onClick={() => startDirectExchange(product, directExchangeQuantityPrompt.size, quantity)} style={{ padding: "10px 6px", borderRadius: 8, background: "#166534", border: "none", color: "#fff", fontWeight: 800 }}>
                          {quantity}{productUnit(product.name)}
                        </button>
                      ))}
                    </div>
                    <button className="pos-btn" onClick={() => setDirectExchangeQuantityPrompt((current) => ({ ...current, custom: true, quantity: "" }))} style={{ width: "100%", marginTop: 6, padding: 8, borderRadius: 8, background: directExchangeQuantityPrompt.custom ? "#DCFCE7" : "#fff", border: "1px solid #86EFAC", color: "#166534", fontWeight: 800 }}>
                      其他（4–99{productUnit(product.name)}）
                    </button>
                    {directExchangeQuantityPrompt.custom && (
                      <>
                        <input
                          type="number"
                          min="4"
                          max="99"
                          inputMode="numeric"
                          autoFocus
                          placeholder={`輸入數量（4–99${productUnit(product.name)}）`}
                          value={directExchangeQuantityPrompt.quantity}
                          onChange={(event) => setDirectExchangeQuantityPrompt((current) => ({ ...current, quantity: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              const quantity = Number(directExchangeQuantityPrompt.quantity);
                              if (Number.isInteger(quantity) && quantity >= 4 && quantity <= 99) startDirectExchange(product, directExchangeQuantityPrompt.size, quantity);
                            }
                          }}
                          style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: "9px 10px", border: "1px solid #86EFAC", borderRadius: 8, fontSize: 17, fontWeight: 700 }}
                        />
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <button className="pos-btn" onClick={() => setDirectExchangeQuantityPrompt(null)} style={{ flex: 1, padding: 8, borderRadius: 8, background: "#fff", border: "1px solid #86EFAC", color: "#166534", fontWeight: 700 }}>取消</button>
                          <button className="pos-btn" onClick={() => startDirectExchange(product, directExchangeQuantityPrompt.size, Number(directExchangeQuantityPrompt.quantity))} disabled={!Number.isInteger(Number(directExchangeQuantityPrompt.quantity)) || Number(directExchangeQuantityPrompt.quantity) < 4 || Number(directExchangeQuantityPrompt.quantity) > 99} style={{ flex: 1, padding: 8, borderRadius: 8, background: "#166534", border: "none", color: "#fff", fontWeight: 700 }}>確定換貨</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {hasLengths && !directExchangeLength ? (
                  <div className="sale-size-grid">
                    {lengths.map((length) => <button key={length} className="pos-btn sale-size-button" onClick={() => setDirectExchangeLength(length)} style={{ padding: "10px 8px", borderRadius: 10, background: "#fff", border: "1px solid #86EFAC", color: "#166534", fontSize: 16, fontWeight: 700 }}>{lengthDimensionLabel(product)} {length}</button>)}
                  </div>
                ) : <div className="sale-size-grid">
                  {sizes.map((size) => (
                    <button key={`${size.size}-${size.length || ""}`} className="pos-btn sale-size-button" onClick={() => setDirectExchangeQuantityPrompt({ size, custom: false, quantity: "" })} style={{ padding: "10px 8px", borderRadius: 10, background: "#fff", border: "1px solid #86EFAC", color: "#166534", fontSize: 16 }}>
                      {sizeLabel(size)} · {fmt(size.price)}
                    </button>
                  ))}
                </div>}
              </div>
            );
          })()}
          <button className="pos-btn" onClick={() => { setDirectExchangeOpen(false); setDirectExchangeQuantityPrompt(null); setDirectExchangeItems([]); }} style={{ width: "100%", marginTop: 8, padding: 7, background: "transparent", color: "#166534" }}>取消</button>
        </div>
      )}
      {exchangePickerOpen && exchangeOrder === null && (
        <div style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ color: "#9A3412", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>選擇原單據</div>
          {exchangeOrders.length > 0 ? (
            <>
            <input
              value={exchangeSearch}
              onChange={(event) => setExchangeSearch(event.target.value)}
              placeholder="搜尋單據尾4位或部分單號"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", marginBottom: 8, borderRadius: 8, border: "1px solid #FDBA74", fontSize: 13 }}
            />
            <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto" }}>
              {exchangeOrders.filter((order) => {
                const query = exchangeSearch.trim().toLowerCase();
                if (!query) return true;
                return String(order.id || "").toLowerCase().includes(query);
              }).slice(0, 20).map((order) => (
                <button key={order.id} className="pos-btn" onClick={() => { setExchangeOrder(order); setExchangeItems([]); setExchangeItemQuantities({}); }} style={{ textAlign: "left", padding: "9px 10px", borderRadius: 8, background: "#fff", border: "1px solid #FDBA74", color: "#7C2D12" }}>
                  #{order.id} · {order.date} · {fmt(order.total)}
                </button>
              ))}
            </div>
            </>
          ) : <div style={{ color: "#9A3412", fontSize: 12 }}>{selectedSchool ? `「${selectedSchool}」目前沒有可供換貨的銷售單據。` : "請先在左上角選擇學校。"}</div>}
          <button className="pos-btn" onClick={() => setExchangePickerOpen(false)} style={{ width: "100%", marginTop: 8, padding: 7, background: "transparent", color: "#9A3412" }}>取消</button>
        </div>
      )}
      {exchangePickerOpen && exchangeOrder && (
        <div style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ color: "#9A3412", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>揀選換貨貨品（可多選）</div>
          {exchangeOrder.items.map((item, index) => {
            const selected = exchangeItems.some((entry) => entry._exchangeIndex === index);
            const selectedQuantity = Number(exchangeItemQuantities[index] || 1);
            return (
              <div key={`${item.name}-${item.size}-${index}`} style={{ padding: 8, marginBottom: 6, borderRadius: 8, background: "#fff", border: "1px solid #FDBA74", color: "#7C2D12" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => {
                      setExchangeItems((previous) => selected
                        ? previous.filter((entry) => entry._exchangeIndex !== index)
                        : [...previous, { ...item, _exchangeIndex: index }]);
                      setExchangeItemQuantities((previous) => {
                        if (selected) {
                          const next = { ...previous };
                          delete next[index];
                          return next;
                        }
                        return { ...previous, [index]: 1 };
                      });
                    }}
                  />
                  <span>{item.name}（{sizeLabel(item)}）× {item.qty}{productUnit(item.name)}</span>
                </label>
                {selected && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 24 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>本次換</span>
                    <input
                      type="number"
                      min="1"
                      max={item.qty}
                      inputMode="numeric"
                      value={selectedQuantity}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setExchangeItemQuantities((previous) => ({ ...previous, [index]: Number.isFinite(value) ? Math.max(1, Math.min(Number(item.qty), value)) : 1 }));
                      }}
                      style={{ width: 64, padding: "6px 8px", border: "1px solid #FDBA74", borderRadius: 6, fontSize: 16, fontWeight: 700 }}
                    />
                    <span style={{ fontSize: 12 }}>{productUnit(item.name)}（最多 {item.qty}）</span>
                  </div>
                )}
              </div>
            );
          })}
          <button className="pos-btn" disabled={exchangeItems.length === 0} onClick={confirmExchangeItems} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#166534", color: "#fff", fontWeight: 700 }}>確定換選貨品（{exchangeItems.length}款）</button>
          <button className="pos-btn" onClick={() => setExchangeOrder(null)} style={{ width: "100%", marginTop: 6, padding: 7, background: "transparent", color: "#9A3412" }}>返回單據選擇</button>
        </div>
      )}
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

      {!selectedProduct && (
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
      )}

      {!selectedProduct && filteredProducts.length === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "#999", padding: "8px 2px" }}>
            此分類未有商品，請選擇其他分類或到「商品」分頁新增／匯入。
          </div>
        </div>
      )}

      {!selectedProduct && <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#2F6F68", padding: "8px 2px", borderBottom: "1px solid #DDE8E5", marginBottom: 8 }}>
          商品列表
        </div>
        <div className="sale-product-grid">
          {sortedProducts.map((p) => (
            <button
              key={p.id}
              className="pos-btn sale-product-button"
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
                fontSize: 16,
                fontWeight: 700,
                textAlign: "left",
              }}
            >
              {displayProductName(p.name)}
            </button>
          ))}
        </div>
      </div>}

      {selectedProduct && (
        <div key={selectedProduct} style={{ marginBottom: 16 }}>
          <button
            className="pos-btn"
            onClick={() => {
              setSelectedProduct(null);
              setSelectedLength("");
            }}
            style={{ marginBottom: 10, padding: "7px 10px", borderRadius: 8, background: "#F0F0EC", border: "1px solid #ddd", color: "#1F3A5F", fontSize: 12, fontWeight: 700 }}
          >
            ← 返回選款式
          </button>
          {(() => {
            const product = products.find((p) => p.id === selectedProduct);
            return product ? (
              <div style={{ background: "#1F3A5F", color: "#fff", borderRadius: 10, padding: "12px 14px", marginBottom: 12, boxShadow: "0 2px 6px rgba(31,58,95,0.18)" }}>
                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 3 }}>目前選擇款式</div>
                <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.35, overflowWrap: "anywhere" }}>{displayProductName(product.name)}</div>
              </div>
            ) : null;
          })()}
          {(() => {
            const product = products.find((p) => p.id === selectedProduct);
            const categoryLabel = hasLengthOptions(product) ? `先揀${lengthDimensionLabel(product)}，再揀${sizeDimensionLabel(product)}：` : "揀尺碼：";
            return (
              <>
                {quantityPrompt && (
                  <div style={{ background: "#EAF4FF", border: "1px solid #B7D4F2", borderRadius: 12, padding: 14, marginBottom: 12 }}>
                    <div style={{ color: "#1F3A5F", fontSize: 14, fontWeight: 800 }}>需要購買數量</div>
                    <div style={{ color: "#64748B", fontSize: 12, marginTop: 4 }}>
                      {displayProductName(quantityPrompt.product.name)}（{sizeLabel(quantityPrompt.size)}）
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
                      {[1, 2, 3].map((quantity) => (
                        <button
                          key={quantity}
                          className="pos-btn"
                          onClick={() => confirmQuantity(quantity)}
                          style={{ padding: "12px 8px", borderRadius: 8, background: "#1F3A5F", border: "none", color: "#fff", fontSize: 16, fontWeight: 800 }}
                        >
                          {quantity}{productUnit(quantityPrompt.product.name)}
                        </button>
                      ))}
                    </div>
                    <button
                      className="pos-btn"
                      onClick={() => setQuantityPrompt((current) => ({ ...current, custom: true, quantity: "" }))}
                      style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 8, background: quantityPrompt.custom ? "#DCEEFF" : "#fff", border: "1px solid #9BC3EC", color: "#1F3A5F", fontWeight: 800 }}
                    >
                      其他（4–99{productUnit(quantityPrompt.product.name)}）
                    </button>
                    {!quantityPrompt.custom && (
                      <button className="pos-btn" onClick={() => setQuantityPrompt(null)} style={{ width: "100%", marginTop: 8, padding: "9px 10px", borderRadius: 8, background: "#fff", border: "1px solid #CBD5E1", color: "#475569", fontWeight: 700 }}>
                        取消
                      </button>
                    )}
                    {quantityPrompt.custom && (
                      <>
                        <input
                          type="number"
                          min="4"
                          max="99"
                          inputMode="numeric"
                          autoFocus
                          placeholder={`輸入數量（4–99${productUnit(quantityPrompt.product.name)}）`}
                          value={quantityPrompt.quantity}
                          onChange={(event) => setQuantityPrompt((current) => ({ ...current, quantity: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") confirmQuantity();
                          }}
                          style={{ width: "100%", boxSizing: "border-box", marginTop: 10, padding: "10px 12px", border: "1px solid #9BC3EC", borderRadius: 8, fontSize: 18, fontWeight: 700 }}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button className="pos-btn" onClick={() => setQuantityPrompt(null)} style={{ flex: 1, padding: "9px 10px", borderRadius: 8, background: "#fff", border: "1px solid #CBD5E1", color: "#475569", fontWeight: 700 }}>
                            取消
                          </button>
                          <button className="pos-btn" onClick={() => confirmQuantity()} disabled={!Number.isInteger(Number(quantityPrompt.quantity)) || Number(quantityPrompt.quantity) < 4 || Number(quantityPrompt.quantity) > 99} style={{ flex: 1, padding: "9px 10px", borderRadius: 8, background: "#1F3A5F", border: "none", color: "#fff", fontWeight: 700 }}>
                            確定加入
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {!quantityPrompt && <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>{categoryLabel}</div>}
              </>
            );
          })()}
          {(() => {
            const product = products.find((p) => p.id === selectedProduct);
            if (!product) return null;
            if (!product) return null;
            const hasLengths = hasLengthOptions(product);
            if (!hasLengths) return (
              <div className="sale-size-grid">
                {[...product.sizes].filter(isPricedSize).sort(sizeEntrySort).map((s) => (
                  <button
                    key={`${selectedProduct}-${s.size}`}
                    className="pos-btn sale-size-button"
                    onClick={() => handleSizeSelect(product, s)}
                    style={{ padding: "10px 8px", borderRadius: 10, background: "#fff", border: "1px solid #ccc", fontSize: 16 }}
                  >
                    <div style={{ fontWeight: 600 }}>{sizeLabel(s)}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{fmt(s.price)}</div>
                  </button>
                ))}
              </div>
            );
            const lengths = [...new Set(product.sizes.filter(isPricedSize).map((size) => size.length))].sort(naturalSizeSort);
            if (!selectedLength) return (
              <div className="sale-size-grid">
                {lengths.map((length) => (
                  <button key={`${selectedProduct}-length-${length}`} className="pos-btn sale-size-button" onClick={() => setSelectedLength(length)} style={{ padding: "10px 8px", borderRadius: 10, background: "#fff", border: "1px solid #1F3A5F", color: "#1F3A5F", fontSize: 16, fontWeight: 700 }}>
                    {lengthDimensionLabel(product)} {length}
                  </button>
                ))}
              </div>
            );
            const selectedLengthSizes = product.sizes
              .filter((size) => size.length === selectedLength && isPricedSize(size))
              .sort((a, b) => naturalSizeSort(a.size, b.size));
            return (
              <div>
                <button className="pos-btn" onClick={() => setSelectedLength("")} style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 8, background: "#F0F0EC", border: "1px solid #ddd", fontSize: 12 }}>
                  更改長度（目前：{selectedLength}）
                </button>
                <div className="sale-size-grid">
                  {selectedLengthSizes.map((s) => (
                    <button
                      key={`${selectedProduct}-${s.size}-${s.length}`}
                      className="pos-btn sale-size-button"
                      onClick={() => handleSizeSelect(product, s)}
                      style={{ padding: "10px 8px", borderRadius: 10, background: "#fff", border: "1px solid #ccc", fontSize: 16 }}
                    >
                      <div style={{ fontWeight: 600 }}>{s.isTailored ? "裁碼" : sizeDimensionLabel(product)} {s.size} 吋</div>
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
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.exchangeReturn ? "換出：" : ""}{c.name}（{sizeLabel(c)}）</div>
              <div style={{ fontSize: 12, color: c.exchangeReturn ? "#9A3412" : "#888" }}>{c.exchangeReturn ? "-" : ""}{fmt(c.price)} x {c.qty}{productUnit(c.name)} = {fmt((c.exchangeReturn ? -1 : 1) * c.price * c.qty)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {!c.exchangeReturn && (
                <>
                  <button className="pos-btn" onClick={() => changeQty(c.key, -1)} style={{ width: 26, height: 26, borderRadius: 6, background: "#fff", border: "1px solid #ccc" }}>
                    <Minus size={13} style={{ margin: "auto" }} />
                  </button>
                  <span style={{ fontSize: 13, minWidth: 16, textAlign: "center" }}>{c.qty}</span>
                  <button className="pos-btn" onClick={() => changeQty(c.key, 1)} style={{ width: 26, height: 26, borderRadius: 6, background: "#fff", border: "1px solid #ccc" }}>
                    <Plus size={13} style={{ margin: "auto" }} />
                  </button>
                </>
              )}
              <button className="pos-btn" onClick={() => removeItem(c.key)} style={{ width: 26, height: 26, borderRadius: 6, background: "#fff", border: "1px solid #eee", color: "#c33" }}>
                <Trash2 size={13} style={{ margin: "auto" }} />
              </button>
            </div>
          </div>
        ))}
        {cart.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button className="pos-btn" onClick={onClearCart} style={{ flex: 1, padding: "9px 8px", borderRadius: 8, background: "#FFF1F2", border: "1px solid #FDA4AF", color: "#BE123C", fontSize: 13, fontWeight: 700 }}>
                刪除所有款式
              </button>
            </div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700 }}>
              <span>{exchangeMode ? "換貨應補／應退" : `總計（${cartCount}件）`}</span>
              <span>{fmt(cartTotal)}</span>
            </div>

            <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 10, borderTop: "1px solid #E5E5E0" }}>
              <label htmlFor="cash-received" style={{ fontSize: 13, fontWeight: 600, color: "#45515F" }}>{exchangeMode ? "補回現金" : "實收現金"}</label>
              <input
                id="cash-received"
                type="number"
                min="0"
                step="1"
                value={exchangeMode && refundDue > 0 ? 0 : cashReceived}
                disabled={exchangeMode && refundDue > 0}
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

            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: exchangeMode && refundDue > 0 ? "#166534" : "#1F3A5F" }}>
              <span>{exchangeMode && refundDue > 0 ? "應退客人" : exchangeMode ? "應補差額" : "找續"}</span>
              <span>{fmt(exchangeMode && refundDue > 0 ? refundDue : exchangeMode ? changeDue : changeDue)}</span>
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
        {exchangeMode ? (refundDue > 0 ? `完成換貨／退回 ${fmt(refundDue)}` : `完成換貨${changeDue > 0 ? `／補回 ${fmt(changeDue)}` : ""}`) : "完成交易"}並開單
      </button>
      {!exchangeMode && cart.length > 0 && (
        <button
          className="pos-btn"
          onClick={onHoldSale}
          style={{ width: "100%", marginTop: 8, padding: "12px 0", borderRadius: 10, background: "#FFF7ED", border: "1px solid #FDBA74", color: "#9A3412", fontSize: 15, fontWeight: 700 }}
        >
          HOLD 單（稍後繼續）
        </button>
      )}
      {heldSales.length > 0 && (
        <div style={{ marginTop: 14, background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1F3A5F", marginBottom: 8 }}>HOLD 單（{heldSales.length}張）</div>
          <div style={{ display: "grid", gap: 6 }}>
            {heldSales.map((hold) => (
              <div key={hold.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{hold.school || "未選學校"} · {hold.cart?.reduce((sum, item) => sum + Number(item.qty || 0), 0) || 0}件</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{new Date(hold.createdAt).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <button className="pos-btn" onClick={() => onResumeHeldSale(hold)} style={{ padding: "8px 10px", borderRadius: 7, background: "#1F3A5F", color: "#fff", fontSize: 12, fontWeight: 700 }}>繼續</button>
                <button className="pos-btn" onClick={() => onDiscardHeldSale(hold.id)} style={{ padding: "8px 9px", borderRadius: 7, background: "#FFF1F2", color: "#BE123C", fontSize: 12, fontWeight: 700 }}>刪除</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {storageError && (
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "#FFF1F0", color: "#B42318", fontSize: 12, display: "flex", gap: 6, alignItems: "flex-start" }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{storageError}</span>
        </div>
      )}
    </div>
  );
}

function ProductsTab({ products, saveProducts, saveProductsNow, importResult, setImportResult, productsSaveError = "", productsSaveState = "saved", sourceIntegrityWarning = "", canManageSchools = true, canImportExport = true, schoolMeta = {}, saveSchoolMeta = async () => {}, setDeletedSchools = () => {}, selectedSchool = null, setSelectedSchool = () => {}, onPickSchool = setSelectedSchool }) {
  const [expanded, setExpanded] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importPreviewSearch, setImportPreviewSearch] = useState("");
  const [importHistory, setImportHistory] = useState([]);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [noticeAnalyzing, setNoticeAnalyzing] = useState(false);
  const [noticePreview, setNoticePreview] = useState(null);
  const [autoApplyHighConfidence, setAutoApplyHighConfidence] = useState(true);
  const IMPORT_HISTORY_KEY = "import_history_v1";

  const saveSnapshotToCloud = async (snapshot) => {
    try {
      // store full snapshot keyed by id
      await window.storage.set(`import_snapshot:${snapshot.id}`, JSON.stringify(snapshot), true);
      // update index
      const existing = await window.storage.get(IMPORT_HISTORY_KEY, true).catch(() => null);
      const list = existing && existing.value ? JSON.parse(existing.value) : [];
      const meta = { id: snapshot.id, fileName: snapshot.fileName, timestamp: snapshot.timestamp, confidence: snapshot.confidence, summary: snapshot.summary };
      const next = [meta, ...list.filter((s) => s.id !== snapshot.id)].slice(0, 50);
      await window.storage.set(IMPORT_HISTORY_KEY, JSON.stringify(next), true);
      setImportHistory(next);
      return true;
    } catch (e) {
      console.warn("保存匯入快照失敗", e);
      return false;
    }
  };

  const loadImportHistory = async () => {
    try {
      const saved = await window.storage.get(IMPORT_HISTORY_KEY, true).catch(() => null);
      const list = saved && saved.value ? JSON.parse(saved.value) : [];
      setImportHistory(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn("載入匯入歷史失敗", e);
      setImportHistory([]);
    }
  };

  useEffect(() => { loadImportHistory(); }, []);
  const [lengthPromptProductId, setLengthPromptProductId] = useState(null);
  const [lengthDraft, setLengthDraft] = useState("");
  const [matrixDrafts, setMatrixDrafts] = useState({});
  const activeSchool = selectedSchool;

  const fileInputRef = useRef(null);
  const noticeInputRef = useRef(null);
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
  const [schoolSettingsQuery, setSchoolSettingsQuery] = useState("");
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
    const scrollPosition = window.scrollY;
    const currentProducts = productsRef.current;
    const current = currentProducts.find((product) => product.id === id);
    if (!current) return;
    const patch = typeof next === "function" ? next(current) : next;
    const merged = { ...current, ...patch };
    if (!PRICE_MODE_LABELS[merged.priceMode]) {
      merged.priceMode = merged.sizes?.some((size) => size?.length) ? "matrix" : "simple";
    }
    const nextProducts = currentProducts.map((product) => (product.id === id ? merged : product));
    productsRef.current = nextProducts;
    saveProducts(nextProducts);
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollPosition, left: window.scrollX, behavior: "auto" });
    });
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
      const existingKeys = new Set(product.sizes.map(sizeIdentityKey));
      const existingSizes = [...new Set(product.sizes.map((size) => size.size))];
      const additions = existingSizes
        .filter((size) => !existingKeys.has(sizeIdentityKey({ size, length: normalizedLength })))
        .map((size) => ({ size, length: normalizedLength, price: product.sizes.find((item) => item.size === size)?.price ?? null }));
      sizes = [...product.sizes, ...additions];
    }
    updateProduct(product.id, { ...product, sizes });
    setLengthPromptProductId(null);
    setLengthDraft("");
  };

  const addProduct = (school) => {
    const np = { id: uid(), school: school || "", name: "新款式", priceMode: "simple", sizes: [{ size: "M", price: null }] };
    saveProducts([...products, np]);
    setExpanded(np.id);
  };

  const updateMatrixDraft = (productId, field, value) => {
    setMatrixDrafts((current) => ({ ...current, [productId]: { ...(current[productId] || {}), [field]: value } }));
  };

  const calculateMatrixPrices = (sizes, draft, { preserveExistingPrices = false } = {}) => {
    const baseBySize = {};
    String(draft.basePrices || "").split(/[,\n，、]+/).map((entry) => entry.trim()).filter(Boolean).forEach((entry) => {
      const match = entry.match(/^(.+?)\s*[=:]\s*(\d+(?:\.\d+)?)$/);
      if (match) baseBySize[match[1].trim()] = Number(match[2]);
    });
    const surchargeRules = String(draft.surcharges || "").split(/[,\n，、]+/).map((entry) => entry.trim()).filter(Boolean).map((entry) => {
      const match = entry.match(/^(\d+(?:\.\d+)?)\s*(\+)?\s*[=:]\s*\+?(\d+(?:\.\d+)?)$/);
      return match ? { threshold: Number(match[1]), amount: Number(match[3]), minimum: Boolean(match[2]) } : null;
    }).filter(Boolean).sort((first, second) => second.threshold - first.threshold);
    if (!Object.keys(baseBySize).length || !surchargeRules.length) return null;
    return {
      sizes: sizes.map((item) => {
        const base = baseBySize[item.size] ?? baseBySize[item.isTailored ? "裁碼" : ""];
        const lengthNumber = Number(String(item.length).replace(/[^\d.]/g, ""));
        const rule = surchargeRules.find((candidate) => candidate.minimum ? lengthNumber >= candidate.threshold : lengthNumber === candidate.threshold);
        const calculatedPrice = Number.isFinite(Number(base)) && rule ? Number(base) + rule.amount : null;
        if (preserveExistingPrices && isPricedSize(item)) return item;
        return calculatedPrice === null ? item : { ...item, price: calculatedPrice };
      }),
      pricing: { baseBySize, surchargeRules },
    };
  };

  const applyMatrixDraft = (product) => {
    const draft = matrixDrafts[product.id] || {};
    const lengths = String(draft.lengths || "").split(/[,\s，、]+/).map((value) => value.trim()).filter(Boolean);
    const sizes = String(draft.sizes || "").split(/[,\s，、]+/).map((value) => value.trim()).filter(Boolean);
    const uniqueLengths = [...new Set(lengths)];
    const uniqueSizes = [...new Set(sizes)];
    if (!uniqueLengths.length || !uniqueSizes.length) {
      window.alert("請先輸入至少一個長度／袖長及一個腰圍／上圍。");
      return;
    }

    // Build a map of existing size entries so we can merge and preserve prices
    const existing = new Map(product.sizes.map((item) => [sizeIdentityKey(item), { ...item }]));

    // Ensure every requested matrix combination exists; preserve previous entry (and price) when present
    uniqueLengths.forEach((rawLength) => {
      const tailoredMatch = rawLength.match(/^裁碼\s*(.+)$/);
      const length = tailoredMatch ? tailoredMatch[1].trim() : rawLength;
      const isTailored = Boolean(tailoredMatch);
      uniqueSizes.forEach((size) => {
        const key = sizeIdentityKey({ length, size, isTailored });
        const previous = existing.get(key);
        if (previous) {
          // preserve price and mark tailored flag if either indicates tailored
          existing.set(key, { ...previous, isTailored: Boolean(previous.isTailored) || isTailored });
        } else {
          existing.set(key, { length, size, isTailored, price: null });
        }
      });
    });

    // Keep any other existing sizes that were not affected, preserving their prices
    const finalSizes = Array.from(existing.values());
    const calculated = calculateMatrixPrices(finalSizes, draft, { preserveExistingPrices: true });
    updateProduct(product.id, {
      ...product,
      priceMode: "matrix",
      sizes: calculated ? calculated.sizes : finalSizes,
      ...(calculated ? { pricing: calculated.pricing } : {}),
    });
    updateMatrixDraft(product.id, "lengths", "");
    updateMatrixDraft(product.id, "sizes", "");
  };

  const applyMatrixPricing = (product) => {
    const draft = matrixDrafts[product.id] || {};
    const calculated = calculateMatrixPrices(product.sizes, draft);
    if (!calculated) {
      window.alert("請輸入按尺碼的基本價及按長度的加價規則，例如：21=93,22=93,30=128；30+=0,40=10,41.5=20,43+=30。");
      return;
    }
    updateProduct(product.id, { ...product, priceMode: "matrix", sizes: calculated.sizes, pricing: calculated.pricing });
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
    const currentProducts = productsRef.current;
    const target = currentProducts.find((p) => p.id === id);
    if (target && !window.confirm(`確定要刪除「${target.name}」呢個款式？呢個動作唔可以復原。`)) return;
    saveProducts(currentProducts.filter((p) => p.id !== id));
  };

  const deleteSchool = () => {
    if (!activeSchool) return;
    const schoolProductCount = visibleProducts.length;
    const confirmed = window.confirm(`確定要刪除學校「${activeSchool}」？\n\n將會刪除 ${schoolProductCount} 個款式及該校分類資料。\n此動作不能復原，請先確認。`);
    if (!confirmed) return;
    saveProducts(productsRef.current.filter((p) => schoolOf(p) !== activeSchool));
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
    setImportPreviewSearch("");
    setImporting(true);
    try {
      const extension = file.name.toLowerCase().split(".").pop();
      const xlsx = await import("xlsx");
      const workbook = xlsx.read(await file.arrayBuffer(), { type: "array" });
      const sheetRows = asSheetRows(workbook, xlsx);
      const headerText = sheetRows.slice(0, 6).flat().map((value) => normalizeImportHeader(value)).join("|");
      const isStandardFormat = ["學校", "款式名稱", "尺碼", "價錢"].every((header) => headerText.includes(normalizeImportHeader(header)));
      const converted = isStandardFormat
        ? { rows: xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" }), warnings: [] }
        : convertIrregularPriceList(sheetRows);
      const analysis = smartImportRows(converted.rows, products);

      // 基本信心評估（簡單版）：
      // - 以可解析行數比例為主體（最多 0.6）
      // - 若為標準格式加分（0.2）
      // - 無 conversion warnings 加分（0.2）
      let confidence = 0;
      const totalRows = Math.max(1, (analysis.summary && analysis.summary.rows) || converted.rows.length || 0);
      const errorCount = (analysis.errors && analysis.errors.length) || 0;
      const matchedRows = Math.max(0, totalRows - errorCount);
      confidence += Math.min(1, matchedRows / totalRows) * 0.6;
      if (isStandardFormat) confidence += 0.2;
      if (!converted.warnings || converted.warnings.length === 0) confidence += 0.2;
      if (!isStandardFormat && converted.rows.length > 0 && (!converted.warnings || converted.warnings.length === 0)) confidence += 0.15;
      confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));

      const timestamp = new Date().toISOString();
      const snapshot = {
        id: `snap-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        fileName: file.name,
        timestamp,
        conversionMode: isStandardFormat ? "標準格式" : "價目表格式轉換",
        conversionWarnings: converted.warnings,
        analysis,
        next: analysis.next,
        summary: analysis.summary,
        errors: [...(converted.warnings || []), ...(analysis.errors || [])],
        confidence,
        savedBy: 'ui',
      };

      // 保存 preview snapshot 到雲端 app_storage（shared）以及更新 index
      try {
        await saveSnapshotToCloud(snapshot);
      } catch (e) {
        console.warn("儲存匯入快照到雲端失敗", e);
      }

      const preview = { fileName: file.name, conversionMode: isStandardFormat ? "標準格式" : "價目表格式轉換", conversionWarnings: converted.warnings, ...analysis, errors: [...converted.warnings, ...analysis.errors], confidence, snapshotId: snapshot.id, timestamp };
      setImportPreview(preview);

      if (autoApplyHighConfidence && isHighConfidenceImport({ analysis, confidence, conversionWarnings: converted.warnings })) {
        saveProducts(analysis.next);
        const saved = await saveProductsNow();
        if (saved) {
          setImportResult({
            summary: analysis.summary,
            errors: [],
            message: `已自動套用高信心匯入（信心分數 ${Math.round(confidence * 100)}%）。`,
          });
          setImportPreview(null);
          setImportPreviewSearch("");
        } else {
          setImportResult({ summary: null, errors: ["分析符合自動匯入條件，但保存商品資料失敗；資料仍保留在預覽中，請重試。"] });
        }
      }

    } catch (err) {
      console.error(err);
      setImportResult({ summary: null, errors: ["讀取檔案失敗，請確認係 Excel 或 CSV 格式。"] });
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      saveProducts(importPreview.next);
      const saved = await saveProductsNow();
      if (!saved) {
        setImportResult({ summary: null, errors: ["匯入分析成功，但保存商品資料失敗，請重試。"] });
        return;
      }
      setImportResult({ summary: importPreview.summary, errors: [] });
      setImportPreview(null);
      setImportPreviewSearch("");
    } catch (error) {
      console.error("智能匯入保存失敗", error);
      setImportResult({ summary: null, errors: ["匯入分析成功，但保存商品資料失敗，請重試。"] });
    } finally {
      setImporting(false);
    }
  };

  const handleNoticeFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setNoticeAnalyzing(true);
    try {
      const extension = file.name.toLowerCase().split(".").pop();
      let text = "";
      if (extension === "pdf") text = await noticeTextFromPdf(file);
      else if (extension === "docx") text = await noticeTextFromDocx(file);
      else if (["jpg", "jpeg", "png", "webp"].includes(extension)) text = await noticeTextFromImage(file);
      else throw new Error("只支援 PDF、DOCX、JPG、PNG 或 WEBP 通告。");
      setNoticePreview(analyzeNoticeText(text, file.name));
    } catch (error) {
      console.error("通告分析失敗", error);
      setNoticePreview({ fileName: file.name, warnings: [error.message || "通告分析失敗，請重試。"], text: "" });
    } finally {
      setNoticeAnalyzing(false);
    }
  };

  const activeSchoolProducts = activeSchool ? products.filter((p) => schoolOf(p) === activeSchool) : [];
  const visibleProducts = activeSchoolProducts;
  const filteredImportPreviewRows = importPreview
    ? importPreview.previewRows.filter((row) => {
        const query = importPreviewSearch.trim().toLowerCase();
        if (!query) return true;
        return [row.school, row.name, row.length, row.size, row.price, row.action]
          .some((value) => String(value ?? "").toLowerCase().includes(query));
      })
    : [];
  const noticeImportFusion = noticePreview && importPreview
    ? buildNoticeImportFusion(noticePreview, importPreview)
    : null;

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
          type="button"
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
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>學校通告分析</div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 10, lineHeight: 1.5 }}>
          免費在本機瀏覽器分析 PDF、Word 或圖片通告；文件不會上傳。通告只提供學校、季節及產品背景，價格仍以 Excel 預覽為準。
        </div>
        <button
          className="pos-btn"
          onClick={() => noticeInputRef.current && noticeInputRef.current.click()}
          disabled={noticeAnalyzing}
          style={{ width: "100%", padding: "10px 0", borderRadius: 10, background: "#6B4F2A", color: "#fff", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <Upload size={14} /> {noticeAnalyzing ? "分析通告緊…" : "匯入學校通告"}
        </button>
        <input
          ref={noticeInputRef}
          type="file"
          accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
          onChange={handleNoticeFile}
          style={{ display: "none" }}
        />
        {noticePreview && (
          <div style={{ marginTop: 10, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: 10, fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: "#7C2D12" }}>通告分析預覽：{noticePreview.fileName}</div>
            {noticePreview.school && <div style={{ marginTop: 5 }}>學校：{noticePreview.school}</div>}
            {noticePreview.schoolYear && <div>學年：{noticePreview.schoolYear}</div>}
            {noticePreview.season && <div>季節：{noticePreview.season}</div>}
            <div style={{ marginTop: 5 }}>識別到產品：{noticePreview.productsFound?.length ? noticePreview.productsFound.join("、") : "暫未識別"}</div>
            {noticePreview.warnings?.map((warning, index) => <div key={index} style={{ color: "#B42318", marginTop: 5 }}>• {warning}</div>)}
            {noticePreview.text && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer", color: "#7C2D12" }}>查看抽取文字</summary>
                <div style={{ marginTop: 5, maxHeight: 140, overflowY: "auto", whiteSpace: "pre-wrap", background: "#fff", padding: 6, borderRadius: 6 }}>{noticePreview.text}</div>
              </details>
            )}
            <button className="pos-btn" onClick={() => setNoticePreview(null)} style={{ marginTop: 8, padding: "6px 10px", borderRadius: 7, background: "#fff", color: "#7C2D12", border: "1px solid #FDBA74" }}>清除通告預覽</button>
          </div>
        )}

        <div style={{ borderTop: "1px solid #E5E5E0", marginTop: 14, paddingTop: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>批量匯入 / 匯出</div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 10, lineHeight: 1.5 }}>
          支援 Excel／CSV。系統會自動識別學校、款式、長度／袖長、尺碼及價錢；高信心資料會直接寫入，其他資料仍然先預覽。
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, fontSize: 12, color: "#475569", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={autoApplyHighConfidence}
            onChange={(event) => setAutoApplyHighConfidence(event.target.checked)}
          />
          高信心匯入自動落 production（信心至少 95%、零錯誤／警告）
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="pos-btn"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            disabled={importing}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "#1F3A5F", color: "#fff", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Upload size={14} /> {importing ? "分析緊…" : "智能匯入 Excel／CSV"}
          </button>
          <button
            className="pos-btn"
            onClick={handleExport}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "#fff", border: "1px solid #1F3A5F", color: "#1F3A5F", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Download size={14} /> 匯出 CSV
          </button>

          <button
            className="pos-btn"
            onClick={async () => { await loadImportHistory(); setShowImportHistory((v) => !v); }}
            style={{ padding: "10px 0", borderRadius: 10, background: "#fff", border: "1px solid #CBD5E1", color: "#1F3A5F", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            匯入歷史
          </button>

          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleImportFile} style={{ display: "none" }} />
        </div>

        {importPreview && (
          <div style={{ marginTop: 10, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: 10, fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: "#1F3A5F" }}>分析預覽：{importPreview.fileName}</div>
            <div style={{ marginTop: 4, color: "#52657A" }}>模式：{importPreview.conversionMode}</div>
            <div style={{ marginTop: 5 }}>讀取 {importPreview.summary.rows} 行；新增 {importPreview.summary.addedProducts} 款、新增 {importPreview.summary.addedSizes} 個尺碼、更新 {importPreview.summary.updatedSizes} 個價格。</div>
            {importPreview.previewRows.length > 0 && (
              <>
                <input
                  value={importPreviewSearch}
                  onChange={(event) => setImportPreviewSearch(event.target.value)}
                  placeholder="搜尋款式、尺碼、長度或價錢"
                  style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: "7px 9px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 12 }}
                />
                <div style={{ marginTop: 4, color: "#52657A" }}>
                  顯示 {filteredImportPreviewRows.length} / {importPreview.previewRows.length} 筆
                </div>
                <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 5, background: "#fff", borderRadius: 6, padding: 6 }}>
                  {filteredImportPreviewRows.map((row, index) => (
                  <div key={index} style={{ padding: "3px 0", borderBottom: "1px solid #EEF2F7" }}>
                    {row.school} · {row.name} · {row.length ? `${row.length}/` : ""}{row.size} · ${row.price}（{row.action}）
                  </div>
                  ))}
                  {filteredImportPreviewRows.length === 0 && <div style={{ padding: "8px 3px", color: "#64748B" }}>找不到符合資料。</div>}
                </div>
              </>
            )}
            {importPreview.errors.length > 0 && (
              <div style={{ color: "#B42318", marginTop: 6 }}>
                <div>發現 {importPreview.errors.length} 個問題，錯誤行不會匯入：</div>
                {importPreview.errors.slice(0, 8).map((error, index) => <div key={index} style={{ marginTop: 2 }}>• {error}</div>)}
                {importPreview.errors.length > 8 && <div>其餘問題請整理原表後再試。</div>}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="pos-btn" onClick={confirmImport} disabled={importing} style={{ flex: 1, padding: 8, background: "#28784B", color: "#fff", borderRadius: 7 }}>確認匯入</button>
              <button className="pos-btn" onClick={() => { setImportPreview(null); setImportPreviewSearch(""); }} disabled={importing} style={{ flex: 1, padding: 8, background: "#fff", color: "#475569", border: "1px solid #CBD5E1", borderRadius: 7 }}>取消</button>
            </div>
          </div>
        )}

        {noticeImportFusion && (
          <div style={{ marginTop: 10, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: 10, fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: "#166534" }}>通告＋Excel 融合預覽</div>
            <div style={{ marginTop: 5 }}>學校配對：<strong>{noticeImportFusion.schoolMatch}</strong></div>
            <div style={{ marginTop: 5 }}>季節：{noticePreview.season || "通告未能確定，請確認"}</div>
            <div style={{ marginTop: 7, fontWeight: 600 }}>產品配對</div>
            {noticeImportFusion.matches.length === 0 ? (
              <div style={{ marginTop: 3, color: "#92400E" }}>通告未識別到產品名稱，不能自動配對。</div>
            ) : (
              noticeImportFusion.matches.map((item) => (
                <div key={item.noticeProduct} style={{ marginTop: 3 }}>
                  {item.noticeProduct} → {item.matchedExcel || "未能在 Excel 找到"}
                </div>
              ))
            )}
            {noticeImportFusion.unmatchedNotice.length > 0 && (
              <div style={{ marginTop: 6, color: "#B42318" }}>
                通告有但 Excel 沒有：{noticeImportFusion.unmatchedNotice.join("、")}
              </div>
            )}
            {noticeImportFusion.excelOnly.length > 0 && (
              <div style={{ marginTop: 4, color: "#92400E" }}>
                Excel 有但通告未提及：{noticeImportFusion.excelOnly.slice(0, 12).join("、")}
                {noticeImportFusion.excelOnly.length > 12 ? "…" : ""}
              </div>
            )}
            <div style={{ marginTop: 8, padding: 7, background: "#fff", borderRadius: 6, color: "#166534" }}>
              目前只係分析及配對預覽，未有寫入商品庫。確認名稱、學校及季節後，先按 Excel 預覽中的「確認匯入」。
            </div>
          </div>
        )}

        {importResult && (
          <div style={{ marginTop: 10, fontSize: 12, background: "#fff", borderRadius: 8, padding: 10, border: "1px solid #E5E5E0" }}>
            {importResult.message && (
              <div style={{ color: "#28784B", marginBottom: importResult.summary || importResult.errors.length ? 6 : 0, display: "flex", alignItems: "flex-start", gap: 6 }}>
                <Check size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{importResult.message}</span>
              </div>
            )}
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

        {showImportHistory && (
          <div style={{ marginTop: 10, background: "#FEFCE8", border: "1px solid #FDE68A", borderRadius: 8, padding: 10 }}>
            <div style={{ fontWeight: 700, color: "#92400E", marginBottom: 8 }}>匯入歷史（最近 {importHistory.length} 次）</div>
            {importHistory.length === 0 ? (
              <div style={{ color: "#92400E" }}>未有匯入紀錄。</div>
            ) : (
              <div style={{ maxHeight: 220, overflowY: "auto", display: "grid", gap: 8 }}>
                {importHistory.map((h) => (
                  <div key={h.id} style={{ background: "#fff", border: "1px solid #F3F4F6", borderRadius: 6, padding: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{h.fileName}</div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>{new Date(h.timestamp).toLocaleString()} · 信心分數: {typeof h.confidence === 'number' ? Math.round(h.confidence*100) + '%' : 'N/A'}</div>
                      {h.summary && <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>新增 {h.summary.addedProducts} 款 · 新增 {h.summary.addedSizes} 碼 · 更新 {h.summary.updatedSizes} 價</div>}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="pos-btn" onClick={async () => {
                        try {
                          const snap = await window.storage.get(`import_snapshot:${h.id}`, true).catch(() => null);
                          if (snap && snap.value) {
                            const parsed = JSON.parse(snap.value);
                            setImportPreview({ fileName: parsed.fileName || h.fileName, conversionMode: parsed.conversionMode || '', conversionWarnings: parsed.conversionWarnings || [], ...parsed.analysis, errors: parsed.errors || [], confidence: parsed.confidence, snapshotId: parsed.id, timestamp: parsed.timestamp });
                            setShowImportHistory(false);
                          } else {
                            alert('未能讀取該快照，可能已刪除。');
                          }
                        } catch (e) { console.error(e); alert('載入快照失敗'); }
                      }} style={{ padding: "6px 8px", borderRadius: 6, background: "#FFFFFF", border: "1px solid #D1D5DB", color: "#374151", fontSize: 12 }}>查看</button>

                      <button className="pos-btn" onClick={async () => {
                        if (!window.confirm('確定要把該快照合併到現有預覽（不直接寫入 master）嗎？')) return;
                        try {
                          const snap = await window.storage.get(`import_snapshot:${h.id}`, true).catch(() => null);
                          if (snap && snap.value) {
                            const parsed = JSON.parse(snap.value);
                            setImportPreview({ fileName: parsed.fileName || h.fileName, conversionMode: parsed.conversionMode || '', conversionWarnings: parsed.conversionWarnings || [], ...parsed.analysis, errors: parsed.errors || [], confidence: parsed.confidence, snapshotId: parsed.id, timestamp: parsed.timestamp });
                            setShowImportHistory(false);
                          } else {
                            alert('未能讀取該快照，可能已刪除。');
                          }
                        } catch (e) { console.error(e); alert('載入快照失敗'); }
                      }} style={{ padding: "6px 8px", borderRadius: 6, background: "#E6FFFA", border: "1px solid #C7F3E9", color: "#065F46", fontSize: 12 }}>合併到預覽</button>

                      <button className="pos-btn" onClick={async () => {
                        if (!window.confirm('確定要把該快照直接套用到 Production(master) 嗎？此動作會覆蓋現有商品資料。')) return;
                        try {
                          const snap = await window.storage.get(`import_snapshot:${h.id}`, true).catch(() => null);
                          if (snap && snap.value) {
                            const parsed = JSON.parse(snap.value);
                            await saveProducts(parsed.next);
                            alert('已把該快照套用到產品資料。');
                            setShowImportHistory(false);
                          } else {
                            alert('未能讀取該快照，可能已刪除。');
                          }
                        } catch (e) { console.error(e); alert('套用快照失敗'); }
                      }} style={{ padding: "6px 8px", borderRadius: 6, background: "#1F3A5F", border: "1px solid #1F3A5F", color: "#FFFFFF", fontSize: 12 }}>合併到 master</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button className="pos-btn" onClick={() => setShowImportHistory(false)} style={{ padding: "8px 10px", borderRadius: 8, background: "#fff", border: "1px solid #E5E7EB", color: "#374151" }}>關閉</button>
              <button className="pos-btn" onClick={async () => { if (!confirm('確定清空匯入歷史？此動作會從雲端刪除索引，但不會刪除每個快照項。')) return; await window.storage.set(IMPORT_HISTORY_KEY, JSON.stringify([]), true); setImportHistory([]); }} style={{ padding: "8px 10px", borderRadius: 8, background: "#fff7ed", border: "1px solid #FCD34D", color: "#92400E" }}>清空歷史</button>
            </div>
          </div>
        )}
        </div>
      </div>
      )}

      <div style={{ background: "#1F3A5F", color: "#fff", borderRadius: 10, padding: "4px 12px", marginBottom: 12 }}>
        <StoreSchoolSwitcher
          schools={schools}
          schoolMeta={schoolMeta}
          selectedSchool={selectedSchool}
          onPick={(school) => {
            if (school && school !== "all") onPickSchool(school);
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
              <MapPin size={13} /> 學校設定（分店／階段／地區／18區）
            </span>
            {showClassifyPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showClassifyPanel && (
            <div style={{ background: "#fff", border: "1px solid #E5E5E0", borderRadius: 10, marginTop: 6, padding: 10 }}>
              <div style={{ fontSize: 11, color: "#999", marginBottom: 8, lineHeight: 1.5 }}>
                幫每間學校揀返分店、教育階段同所屬18區，「銷售」分頁揀學校時就可以逐層篩選，唔使成頁滾動搵。分店會先自動配對，你可以再手動更改；未設定嘅學校會歸類做「未分類」。
              </div>
              <input
                value={schoolSettingsQuery}
                onChange={(e) => setSchoolSettingsQuery(e.target.value)}
                placeholder="搜尋學校名稱…"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #D5DDE5", boxSizing: "border-box", marginBottom: 10, fontSize: 12 }}
              />
              {(() => {
                const q = schoolSettingsQuery.trim().toLocaleLowerCase();
                if (q.length < 2) {
                  return <div style={{ fontSize: 12, color: "#6B7280" }}>請至少輸入 2 個中文字或英文字母，才會開始搜尋。</div>;
                }
                const matchingSchools = schools
                  .map((school) => {
                    const normalizedSchool = school.trim().toLocaleLowerCase();
                    const score = normalizedSchool === q ? 0 : normalizedSchool.startsWith(q) ? 1 : normalizedSchool.includes(q) ? 2 : -1;
                    return { school, score };
                  })
                  .filter(({ score }) => score >= 0)
                  .sort((first, second) => first.score - second.score || first.school.localeCompare(second.school, "zh-Hant"));
                if (!matchingSchools.length) {
                  return <div style={{ fontSize: 12, color: "#6B7280" }}>找不到相符學校。</div>;
                }
                const visibleSchools = matchingSchools.slice(0, 30);
                return (
                  <>
                    {visibleSchools.map(({ school: sc }) => {
                  const m = metaOf(schoolMeta, sc);
                  const region = m.region && HK_REGIONS.includes(m.region) ? m.region : "";
                  return (
                    <div key={sc} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) repeat(4, minmax(0, 1fr))", gap: 6, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F0F0EC" }}>
                      <div style={{ minWidth: 0, fontSize: 12, fontWeight: 500, overflowWrap: "anywhere" }}>{sc}</div>
                      <select
                        value={m.outletName || outletNameForSchool(sc, {})}
                        onChange={(e) => saveSchoolMeta({ ...schoolMeta, [sc]: { ...m, outletName: e.target.value } })}
                        style={{ width: "100%", minWidth: 0, padding: 5, borderRadius: 6, border: "1px solid #ccc", fontSize: 11, boxSizing: "border-box" }}
                      >
                        <option value="">分店？</option>
                        {OUTLETS.map((outlet) => (
                          <option key={outlet.name} value={outlet.name}>{outlet.name}</option>
                        ))}
                      </select>
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
                      {matchingSchools.length > visibleSchools.length && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280" }}>
                          找到 {matchingSchools.length} 間學校，現只顯示最相關的 30 間；請輸入更多字元縮小結果。
                        </div>
                      )}
                    </>
                );
              })()}
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
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{productPriceMode(p) === "matrix" ? `款式名稱（${sizeDimensionLabels(p)} → 價錢）` : productPriceMode(p) === "fixed" ? "款式名稱（所有尺寸同價）" : "款式名稱（尺碼 → 價錢）"}</div>
              <input
                value={p.name}
                onChange={(e) => updateProduct(p.id, { ...p, name: e.target.value })}
                placeholder="款式名稱"
                style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }}
              />
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>價格模式</div>
              <select
                value={productPriceMode(p)}
                onChange={(e) => updateProduct(p.id, { ...p, priceMode: e.target.value })}
                style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
              >
                {Object.entries(PRICE_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {productPriceMode(p) === "matrix" && (
                <div style={{ padding: 9, marginBottom: 10, background: "#F0F7FF", border: "1px solid #B8D8F5", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "#1F3A5F", fontWeight: 600, marginBottom: 5 }}>批量建立長度 × 尺碼組合</div>
                  <div style={{ fontSize: 11, color: "#52657A", marginBottom: 6 }}>先建立組合，價格可稍後補上；留空會標記為「待補價」。</div>
                  <input
                    value={matrixDrafts[p.id]?.lengths || ""}
                    onChange={(e) => updateMatrixDraft(p.id, "lengths", e.target.value)}
                    placeholder={`${lengthDimensionLabel(p)}，例如：30,31,32,33,裁碼42`}
                    style={{ width: "100%", padding: 7, marginBottom: 6, borderRadius: 7, border: "1px solid #B8C7D8", fontSize: 12, boxSizing: "border-box" }}
                  />
                  <input
                    value={matrixDrafts[p.id]?.sizes || ""}
                    onChange={(e) => updateMatrixDraft(p.id, "sizes", e.target.value)}
                    placeholder={`${sizeDimensionLabel(p)}，例如：32,34,36,38,40,42`}
                    style={{ width: "100%", padding: 7, marginBottom: 6, borderRadius: 7, border: "1px solid #B8C7D8", fontSize: 12, boxSizing: "border-box" }}
                  />
                  <button className="pos-btn" onClick={() => applyMatrixDraft(p)} style={{ padding: "7px 10px", borderRadius: 7, background: "#1F3A5F", color: "#fff", fontSize: 12 }}>建立組合（保留已有價格）</button>
                  <div style={{ borderTop: "1px solid #D9E2EC", marginTop: 9, paddingTop: 9 }}>
                    <div style={{ fontSize: 11, color: "#52657A", marginBottom: 5 }}>可選：自動套用基本價及長度加價；建立組合時只會填待補價，不會覆蓋已有價格</div>
                    <input
                      value={matrixDrafts[p.id]?.basePrices || ""}
                      onChange={(e) => updateMatrixDraft(p.id, "basePrices", e.target.value)}
                      placeholder="按尺碼基本價，例如：21=93,22=93,30=128,裁碼=139"
                      style={{ width: "100%", padding: 7, marginBottom: 6, borderRadius: 7, border: "1px solid #B8C7D8", fontSize: 12, boxSizing: "border-box" }}
                    />
                    <input
                      value={matrixDrafts[p.id]?.surcharges || ""}
                      onChange={(e) => updateMatrixDraft(p.id, "surcharges", e.target.value)}
                      placeholder={`長度／袖長加價，例如：40=10,41.5=20,43+=30`}
                      style={{ width: "100%", padding: 7, marginBottom: 6, borderRadius: 7, border: "1px solid #B8C7D8", fontSize: 12, boxSizing: "border-box" }}
                    />
                    <button className="pos-btn" onClick={() => applyMatrixPricing(p)} style={{ padding: "7px 10px", borderRadius: 7, background: "#28784B", color: "#fff", fontSize: 12 }}>重新套用價格（會更新每格價格）</button>
                  </div>
                </div>
              )}
              {p.sizes.some((size) => !isPricedSize(size)) && (
                <div style={{ marginBottom: 8, padding: 8, borderRadius: 7, background: "#FFF8E7", color: "#9A6700", fontSize: 12 }}>
                  尚有 {p.sizes.filter((size) => !isPricedSize(size)).length} 個組合待補價，未補價格不可銷售。
                </div>
              )}
              {p.sizes.map((s, i) => ({ s, i })).sort((a, b) => sizeEntrySort(a.s, b.s)).map(({ s, i }) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  {hasLengthOptions(p) && (
                    <>
                      {s.isTailored && <span style={{ alignSelf: "center", fontSize: 11, color: "#9A6700" }}>裁碼</span>}
                      <input
                        value={s.length || ""}
                        onChange={(e) => {
                          updateProduct(p.id, (current) => ({
                            sizes: current.sizes.map((size, index) => index === i
                              ? { ...size, length: e.target.value.replace(/^裁碼\s*/, ""), isTailored: s.isTailored }
                              : size),
                          }));
                        }}
                        placeholder={lengthDimensionLabel(p)}
                        style={{ width: 70, padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 }}
                      />
                    </>
                  )}
                  <input
                    value={s.size}
                    onChange={(e) => {
                      updateProduct(p.id, (current) => ({
                        sizes: current.sizes.map((size, index) => index === i
                          ? { ...size, size: e.target.value }
                          : size),
                      }));
                    }}
                    placeholder={hasLengthOptions(p) ? sizeDimensionLabel(p) : "尺碼"}
                    style={{ width: 70, padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 }}
                  />
                  <input
                    type="number"
                    value={s.price ?? ""}
                    onChange={(e) => {
                      updateProduct(p.id, (current) => ({
                        sizes: current.sizes.map((size, index) => index === i
                          ? { ...size, price: e.target.value === "" ? null : Number(e.target.value) }
                          : size),
                      }));
                    }}
                    placeholder="價錢（待補）"
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 }}
                  />
                  <button
                    type="button"
                    className="pos-btn"
                    onClick={() => {
                      updateProduct(p.id, (current) => ({
                        sizes: current.sizes.filter((_, index) => index !== i),
                      }));
                    }}
                    style={{ width: 34, borderRadius: 8, background: "#fff", border: "1px solid #eee", color: "#c33" }}
                  >
                    <X size={14} style={{ margin: "auto" }} />
                  </button>
                </div>
              ))}
              <button
                className="pos-btn"
                onClick={() => updateProduct(p.id, (current) => ({
                  sizes: [...current.sizes, { size: "", length: "", price: null }],
                }))}
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

function RecordsTab({ salesLog, selectedSchool = "", onReprint, canViewAllDates, canExportSales, schoolMeta = {} }) {
  const [date, setDate] = useState(todayStr());
  const [outletFilter, setOutletFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [receiptSearch, setReceiptSearch] = useState("");
  const effectiveDate = canViewAllDates ? date : todayStr();
  const normalizedPhoneSearch = phoneSearch.replace(/\D/g, "").slice(-4);
  const normalizedReceiptSearch = receiptSearch.trim().toLowerCase().replace(/^#/, "");
  const dateOrders = normalizedReceiptSearch
    ? salesLog.filter((o) => String(o.id || "").toLowerCase().includes(normalizedReceiptSearch))
    : normalizedPhoneSearch.length === 4
      ? salesLog.filter((o) => customerPhoneLast4(o.customerPhone || o.phone) === normalizedPhoneSearch)
      : salesLog.filter((o) => o.date === effectiveDate);
  const outletForOrder = (order) => {
    const configuredOutlet = outletNameForSchool(order.school, schoolMeta);
    if (configuredOutlet !== "未指定門店") return configuredOutlet;
    return String(order.outletName || order.outlet_name || "").trim();
  };
  const selectedOutlet = OUTLETS.find((outlet) => outlet.name === outletFilter);
  const outletMatches = (order) => {
    if (!outletFilter) return true;
    if (outletForOrder(order) === outletFilter) return true;
    return Boolean(
      selectedOutlet
      && ((selectedOutlet.phone && order.outletPhone === selectedOutlet.phone)
        || (selectedOutlet.address && order.outletAddress === selectedOutlet.address))
    );
  };
  const availableSchools = Array.from(new Set(dateOrders.filter(outletMatches).map((o) => o.school).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "zh-Hant"));
  const dayOrders = dateOrders.filter((o) => outletMatches(o) && (!schoolFilter || o.school === schoolFilter));
  const dayTotal = dayOrders.reduce((s, o) => s + netOrderTotal(o), 0);
  const dayItems = dayOrders.reduce((s, o) => s + o.itemCount, 0);
  const knownCustomerPhones = new Set(dayOrders.map((o) => customerPhoneLast4(o.customerPhone || o.phone)).filter(Boolean));
  const customerCount = knownCustomerPhones.size;
  const missingCustomerPhoneCount = dayOrders.filter((o) => !customerPhoneLast4(o.customerPhone || o.phone)).length;

  const byOutlet = {};
  const bySchool = {};
  dayOrders.forEach((o) => {
    const outlet = outletForOrder(o);
    const school = o.school || "（未指定學校）";
    if (!byOutlet[outlet]) byOutlet[outlet] = { total: 0, count: 0 };
    if (!bySchool[school]) bySchool[school] = { total: 0, count: 0 };
    byOutlet[outlet].total += netOrderTotal(o);
    byOutlet[outlet].count += 1;
    bySchool[school].total += netOrderTotal(o);
    bySchool[school].count += 1;
  });

  const byCashier = {};
  dayOrders.forEach((o) => {
    const key = o.cashierName || "（未記名）";
    if (!byCashier[key]) byCashier[key] = { total: 0, count: 0 };
    byCashier[key].total += netOrderTotal(o);
    byCashier[key].count += 1;
  });

  const handleExportCSV = () => {
    const rows = [["日期", "時間", "單號", "開單員工", "學校", "門店", "單據件數", "單據總額", "款式", "尺碼", "長度", "數量", "單價", "款式小計"]];
    dateOrders.forEach((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach((item) => {
        rows.push([
          o.date,
          o.time,
          o.id,
          o.cashierName || "",
          o.school || "",
          o.outletName || outletNameForSchool(o.school, schoolMeta),
          o.itemCount,
          o.total,
          item.name || "",
          item.size || "",
          item.length || "",
          item.qty,
          item.price,
          Number(item.price || 0) * Number(item.qty || 0),
        ]);
      });
    });
    downloadCSV(Papa.unparse(rows), `銷售紀錄_${todayStr()}.csv`);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          value={phoneSearch}
          onChange={(e) => setPhoneSearch(e.target.value.replace(/\D/g, "").slice(-4))}
          inputMode="numeric"
          maxLength={4}
          placeholder="電話尾4位搜尋全部記錄"
          aria-label="電話最後4位搜尋"
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 14, width: 170 }}
        />
        <input
          value={receiptSearch}
          onChange={(e) => setReceiptSearch(e.target.value)}
          placeholder="搜尋單號"
          aria-label="搜尋單號"
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 14, width: 170 }}
        />
        {canViewAllDates ? (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }}
          />
        ) : (
          <div style={{ fontSize: 13, background: "#EEF1F5", padding: "8px 12px", borderRadius: 8, color: "#1F3A5F", fontWeight: 500 }}>
            {normalizedReceiptSearch || normalizedPhoneSearch.length === 4 ? "搜尋全部歷史記錄" : `即時銷售紀錄（${todayStr()}）`}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 14 }}>
        <div style={{ background: "#EEF1F5", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, color: "#666" }}>總收入</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{fmt(dayTotal)}</div>
        </div>
        <div style={{ background: "#EEF1F5", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, color: "#666" }}>賣出件數</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{dayItems}</div>
        </div>
        <div style={{ background: "#EEF1F5", borderRadius: 10, padding: "12px 14px" }} title="按已保存的電話最後4位去重；未有電話資料的單據不會計入">
          <div style={{ fontSize: 12, color: "#666" }}>客人數（按電話尾4位）</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{customerCount}</div>
          {missingCustomerPhoneCount > 0 && <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>另有 {missingCustomerPhoneCount} 張單無電話資料</div>}
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
        <div
          key={o.id}
          role="button"
          tabIndex={0}
          onClick={() => onReprint(o)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onReprint(o);
            }
          }}
          style={{ background: "#fff", border: "1px solid #E5E5E0", borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, cursor: "pointer" }}
          title="按此查看單據記錄"
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflowWrap: "anywhere" }}>{o.time} · {o.itemCount}件 · #{(o.id || "").toUpperCase()}</div>
            {o.exchangeSourceReceiptId && <div style={{ fontSize: 12, color: "#9A3412", fontWeight: 600 }}>來源單據：#{String(o.exchangeSourceReceiptId).toUpperCase()}</div>}
            <div style={{ fontSize: 12, color: "#888" }}>{o.items.map((it) => `${it.name}(${sizeLabel({ size: it.size, length: it.length })})x${it.qty}`).join("、")}</div>
            {o.cashierName && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>開單：{o.cashierName}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(o.total)}</div>
            <button className="pos-btn" onClick={(event) => { event.stopPropagation(); onReprint(o); }} style={{ fontSize: 10, color: "#64748B", background: "none", marginTop: 2, padding: "2px 4px" }}>
              重印
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReceiptQR({ order, language = "zh" }) {
  const [status, setStatus] = useState("loading");
  const [modules, setModules] = useState(null);
  const qrText = buildReceiptUrl(order, language);

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

function ReceiptModal({ order, language = "zh", onLanguageChange, onClose, onRedoSale, onExchange, onPrintBrowser, onPrintBluetooth, btStatus }) {
  const [exchangeSelection, setExchangeSelection] = useState(null);
  const english = language === "en";
  const labels = receiptFieldLabels(language);
  const canTranslate = isEnglishReceiptSchool(order.school);
  const openCustomerReceipt = () => {
    const receiptUrl = buildReceiptUrl(order, language);
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
          <div style={{ fontSize: 16, fontWeight: 600 }}>{english ? "Transaction completed" : "交易完成"}</div>
          <button className="pos-btn" onClick={onClose} style={{ background: "none" }}>
            <X size={18} />
          </button>
        </div>

        <ReceiptQR order={order} language={language} />

        <div style={{ background: "#FAFAF8", border: "1px dashed #ccc", borderRadius: 8, padding: 12, fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13 }}>{english ? "Victoria Uniform" : "Victoria Uniform 校服銷售"}</div>
          <div style={{ textAlign: "center", color: "#888", fontSize: 11 }}>{english ? "ELECTRONIC RECEIPT" : "電子銷售單 ELECTRONIC RECEIPT"}</div>
          <div style={{ marginTop: 4 }}>{labels.receiptNo}: #{(order.id || "").toUpperCase()}</div>
          {order.exchangeSourceReceiptId && <div>{labels.sourceReceipt}: #{String(order.exchangeSourceReceiptId).toUpperCase()}</div>}
          <div>{labels.date}: {order.date} {order.time}</div>
          <div>{labels.school}: {english ? "YMCA of Hong Kong Christian College" : order.school || "-"}</div>
          <div>{labels.customer}: {customerSurname(order.customerName) || "-"}</div>
          <div>{labels.phone}: {customerPhoneLast4(order.customerPhone) || "-"}</div>
          <div>--------------------------------</div>
          <div>{labels.items}</div>
          {order.items.map((it, i) => (
            <div key={i}>
              <div>{it.exchangeReturn ? labels.exchangeOut : ""}{it.name}</div>
              <div>  {formatSizeForReceipt(it.name, it.size, it.length)}</div>
              <div>  {labels.quantity} {it.qty} {receiptProductUnit(it.name, language)} x {fmt(Math.abs(it.price))} = {fmt((it.exchangeReturn ? -1 : 1) * Math.abs(it.price) * it.qty)}</div>
            </div>
          ))}
          <div>--------------------------------</div>
          <div>{labels.itemCount}: {order.itemCount}</div>
          <div>{order.exchangeSourceReceiptId ? labels.exchangeTotal : labels.total}: {fmt(order.total)}</div>
          <div>{labels.cash}: {fmt(order.cashReceived ?? order.total)}</div>
          {order.refundDue > 0 ? (
            <div style={{ fontWeight: 700, color: "#166534" }}>{labels.refund}: {fmt(order.refundDue)}</div>
          ) : (
            <div style={{ fontWeight: 700 }}>{labels.change}: {fmt(Math.max(order.changeDue ?? 0, 0))}</div>
          )}
          <div>{labels.status}: {order.exchangeSourceReceiptId ? labels.exchanged : labels.completed}</div>
          <div style={{ marginTop: 8, color: "#555", lineHeight: 1.5 }}>
            <strong>{labels.returnPolicy}</strong><br />
            <strong>{labels.careTitle}</strong><br />
            {labels.care}
          </div>
          <div style={{ textAlign: "center", marginTop: 6, color: "#888" }}>{labels.thanks}</div>
        </div>

        {canTranslate && (
          <button
            className="pos-btn"
            onClick={() => onLanguageChange?.(english ? "zh" : "en")}
            style={{ width: "100%", padding: "11px 0", borderRadius: 10, background: english ? "#EAF0F8" : "#FFF7ED", color: "#1F3A5F", border: "1px solid #B8CBE1", fontSize: 13, fontWeight: 700, marginBottom: 8 }}
          >
            {english ? "切換中文收據" : "轉換英文收據"}
          </button>
        )}
        <button
          className="pos-btn"
          onClick={openCustomerReceipt}
          title="打開客人可以掃描及查看的電子收據頁"
          style={{ width: "100%", padding: "13px 0", borderRadius: 10, background: "#1F3A5F", color: "#fff", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}
        >
          <QrCode size={16} /> {english ? "View customer receipt" : "查看客人電子收據"}
        </button>
        <button
          className="pos-btn"
          onClick={() => onRedoSale?.(order)}
          title="將此收據所有商品帶入銷售頁，重新進行退／換貨處理"
          style={{ width: "100%", padding: "13px 0", borderRadius: 10, background: "#FFF7ED", color: "#9A3412", border: "1px solid #FDBA74", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}
        >
          <ShoppingCart size={16} /> {english ? "Return / exchange this sale" : "退／換貨：重新進行此單銷售"}
        </button>
        {exchangeSelection ? (
          <div style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ color: "#9A3412", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>揀選需要更換的貨品（可多選）</div>
            {order.items.map((item, index) => (
              <label
                key={`${item.name}-${item.size}-${index}`}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", boxSizing: "border-box", padding: "10px", marginBottom: 6, borderRadius: 8, background: "#fff", border: "1px solid #FDBA74", color: "#7C2D12", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={exchangeSelection.some((selected) => selected.index === index)}
                  onChange={() => setExchangeSelection((current) => current.some((selected) => selected.index === index)
                    ? current.filter((selected) => selected.index !== index)
                    : [...current, { ...item, index }])}
                />
                <span>{item.name}（{sizeLabel(item)}）× {item.qty}，原價 {fmt(item.price)}</span>
              </label>
            ))}
            <button className="pos-btn" disabled={exchangeSelection.length === 0} onClick={() => onExchange?.(order, exchangeSelection)} style={{ width: "100%", padding: "10px", marginTop: 4, borderRadius: 8, background: "#166534", border: "none", color: "#fff", fontWeight: 700 }}>
              確定換選貨品（{exchangeSelection.length}款）
            </button>
            <button className="pos-btn" onClick={() => setExchangeSelection(null)} style={{ width: "100%", padding: "8px", borderRadius: 8, background: "transparent", color: "#9A3412" }}>
              取消
            </button>
          </div>
        ) : (
          <button
            className="pos-btn"
            onClick={() => setExchangeSelection([])}
            title="選擇此收據一件或多件貨品進行換貨，並自動計算差額"
            style={{ width: "100%", padding: "13px 0", borderRadius: 10, background: "#ECFDF3", color: "#166534", border: "1px solid #86EFAC", fontSize: 14, fontWeight: 700, marginBottom: 8 }}
          >
            快速換貨／補差額（可換多件）
          </button>
        )}
        <button
          className="pos-btn"
          onClick={() => onPrintBluetooth?.(language)}
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
  const availableOutlets = OUTLETS.filter((outlet) => schools.some((school) => outletNameForSchool(school, schoolMeta) === outlet.name));
  if (!selectedOutlet) return <div style={{ marginTop: 12, paddingBottom: 4 }}><div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>第一步：揀門店</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{availableOutlets.map((outlet) => <SchoolChip key={outlet.name} label={outlet.name} sub={`${schools.filter((school) => outletNameForSchool(school, schoolMeta) === outlet.name).length}間學校`} selected={false} onClick={() => { setSelectedOutlet(outlet.name); setSchoolType(null); setQuery(""); }} />)}</div></div>;
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
        {OUTLETS.filter((outlet) => schools.some((school) => outletNameForSchool(school, schoolMeta) === outlet.name)).map((outlet) => {
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
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedSchoolForRegistration, setSelectedSchoolForRegistration] = useState("");

  const schoolOptions = [...new Set(schools.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));

  const levelOptions = SCHOOL_LEVELS.map((level) => ({
    level,
    count: schoolOptions.filter((school) => {
      const schoolLevel = normalizeSchoolLevel(school, schoolMeta);
      return level === "其他" ? schoolLevel === "其他" : schoolLevel === level;
    }).length,
  }));

  const levelFilteredSchools = selectedLevel
    ? schoolOptions.filter((school) => {
        const schoolLevel = normalizeSchoolLevel(school, schoolMeta);
        return selectedLevel === "其他" ? schoolLevel === "其他" : schoolLevel === selectedLevel;
      })
    : schoolOptions;

  const districtOptions = [...new Set(levelFilteredSchools.map((school) => normalizeSchoolDistrict(school, schoolMeta)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));

  const districtFilteredSchools = selectedDistrict
    ? levelFilteredSchools.filter((school) => normalizeSchoolDistrict(school, schoolMeta) === selectedDistrict)
    : levelFilteredSchools;

  const handleLevelSelect = (level) => {
    setSelectedLevel(level);
    setSelectedDistrict(null);
    setSelectedSchoolForRegistration("");
  };

  const handleDistrictSelect = (district) => {
    setSelectedDistrict(district);
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
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8, fontWeight: 700 }}>第二步：選擇地區（18區）</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {districtOptions.length > 0 ? (
                    districtOptions.map((district) => (
                      <button
                        key={district}
                        type="button"
                        className="pos-btn"
                        onClick={() => handleDistrictSelect(district)}
                        style={{
                          padding: "9px 12px",
                          borderRadius: 10,
                          background: selectedDistrict === district ? "#D97757" : "#F3F6FA",
                          color: selectedDistrict === district ? "#fff" : "#1F3A5F",
                          border: "1px solid " + (selectedDistrict === district ? "#D97757" : "#D5DDE5"),
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {district}
                      </button>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: "#66717D" }}>此類別暫無地區資料</div>
                  )}
                </div>
              </div>
            )}

            {selectedDistrict && (
              <div>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8, fontWeight: 700 }}>第三步：選擇學校</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
                  {districtFilteredSchools.length > 0 ? (
                    districtFilteredSchools.map((school) => (
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
  const [branches, setBranches] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [role, setRole] = useState(ROLES.STAFF);
  const [branchId, setBranchId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStaff = async () => {
    const result = await manageStaff({ action: "list" });
    if (result.error) setMessage("讀取員工失敗：" + result.error);
    else setStaff(result.data?.staff || []);
  };

  useEffect(() => { loadStaff(); }, []);
  useEffect(() => {
    manageStaff({ action: "list_branches" }).then((result) => {
      if (result.error) setMessage("讀取分店失敗：" + result.error);
      else {
        setBranches(result.data?.branches || []);
        if (!branchId && result.data?.branches?.length === 1) setBranchId(result.data.branches[0].id);
      }
    });
  }, []);

  const invite = async () => {
    if (!email.trim() || !name.trim()) {
      setMessage("請輸入員工姓名及電郵。");
      return;
    }
    setBusy(true);
    const result = await manageStaff({ action: "invite", email: email.trim(), display_name: name.trim(), role, branch_id: branchId });
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
    try {
      const result = await manageStaff({ action: "create_password", email: email.trim(), display_name: name.trim(), password: temporaryPassword, role, branch_id: branchId });
      if (result.error) {
        setMessage(`建立帳戶失敗：${result.error}`);
        return;
      }
      setMessage("帳戶已建立，可以直接登入。");
      setEmail("");
      setName("");
      setTemporaryPassword("");
      await loadStaff();
    } catch (error) {
      console.error("建立員工帳戶失敗", error);
      setMessage(`建立帳戶失敗：${error?.message || "無法連線至員工管理服務"}`);
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (id, nextRole) => {
    setBusy(true);
    const result = await manageStaff({ action: "update_role", id, role: nextRole });
    setMessage(result.error || "角色已更新。");
    if (!result.error) await loadStaff();
    setBusy(false);
  };

  const changeBranch = async (id, nextBranchId) => {
    setBusy(true);
    const result = await manageStaff({ action: "update_role", id, role: staff.find((member) => member.id === id)?.role || ROLES.STAFF, branch_id: nextBranchId });
    setMessage(result.error || "分店已更新。");
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
          <option value={ROLES.SALES}>銷售</option>
          <option value={ROLES.MANAGER}>店長</option>
          <option value={ROLES.ADMIN}>管理員</option>
        </select>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid #ccc", boxSizing: "border-box", marginBottom: 8 }}>
          <option value="">選擇分店</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <button className="pos-btn" onClick={invite} disabled={busy} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#1F3A5F", color: "#fff", fontWeight: 600 }}>{busy ? "處理中…" : "發送員工邀請"}</button>
        <button className="pos-btn" onClick={createWithPassword} disabled={busy} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#fff", color: "#1F3A5F", border: "1px solid #1F3A5F", fontWeight: 600, marginTop: 8 }}>直接建立帳戶（免電郵）</button>
      </div>
      {message && <div style={{ fontSize: 12, color: message.includes("失敗") || message.includes("請") || message.includes("無法") ? "#B42318" : "#28784B", marginBottom: 10 }}>{message}</div>}
      {staff.map((member) => (
        <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid #eee" }}>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{member.display_name}</div><div style={{ fontSize: 10, color: "#999", overflow: "hidden", textOverflow: "ellipsis" }}>{member.id}</div></div>
          <select value={member.role} onChange={(e) => changeRole(member.id, e.target.value)} disabled={busy} style={{ padding: 6, borderRadius: 6, border: "1px solid #ccc" }}>
            <option value={ROLES.ADMIN}>管理員</option><option value={ROLES.MANAGER}>店長</option><option value={ROLES.SALES}>銷售</option><option value={ROLES.STAFF}>店員</option>
          </select>
          <select value={member.branch_id || ""} onChange={(e) => changeBranch(member.id, e.target.value)} disabled={busy} style={{ maxWidth: 110, padding: 6, borderRadius: 6, border: "1px solid #ccc", fontSize: 11 }}>
            <option value="">未分配分店</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
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
