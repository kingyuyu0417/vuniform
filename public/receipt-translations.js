export const receiptProductTranslationTerms = {
  "環保袋": "Reusable Bag",
  "膠袋": "Plastic Bag",
};

const exactProductTranslations = {
  "男生白色長袖恤衫": "Boys' White Long-sleeve Shirt",
  "男生白色短袖恤衫": "Boys' White Short-sleeve Shirt",
  "女生白色長袖恤衫": "Girls' White Long-sleeve Shirt",
  "女生白色短袖恤衫": "Girls' White Short-sleeve Shirt",
  "深炭灰色半截校裙": "Dark Charcoal Grey Half-length Skirt",
  "男生深炭灰色長西褲": "Boys' Dark Charcoal Grey Long Trousers",
  "男生西裝褸配背心": "Boys' Blazer with Waistcoat",
  "女裝西裝褸配背心": "Girls' Blazer with Waistcoat",
  "深炭灰色西裝褸配厚抓毛背心": "Dark Charcoal Grey Blazer with Fleece Waistcoat",
  "V領長冷": "V-neck Long-sleeve Jumper",
  "男呔": "Boys' Tie",
  "男女生 - 運動衫": "Unisex Sports Shirt",
  "男女生 - 運動套裝": "Unisex Sports Set",
  "男女生 - 冷衫": "Unisex Jumper",
  "男女生 - 混合毛冷衫": "Unisex Wool-blend Jumper",
};

const productTerms = {
  "深炭灰色": "Dark Charcoal Grey", "寶藍色": "Royal Blue", "炭灰色": "Charcoal Grey",
  "粉紅色": "Pink", "咖啡色": "Brown", "紫色": "Purple", "藍色": "Blue",
  "灰色": "Grey", "黑色": "Black", "白色": "White", "啡色": "Brown",
  "杏色": "Beige", "綠色": "Green", "黃色": "Yellow", "紅色": "Red",
  "男女生": "Unisex", "男生": "Boys'", "女生": "Girls'", "男裝": "Men's", "女裝": "Women's",
  "半截校裙": "Half-length School Skirt", "連身校裙": "One-piece School Dress",
  "西裝褸配厚抓毛背心": "Blazer with Fleece Waistcoat", "西裝褸配背心": "Blazer with Waistcoat",
  "長西褲": "Long Trousers", "短西褲": "Short Trousers", "運動短褲": "Sports Shorts",
  "運動長褲": "Sports Trousers", "運動褲": "Sports Trousers", "長褲": "Trousers", "西褲": "Trousers",
  "運動上衣": "Sports Top", "運動外套": "Sports Jacket", "運動套裝": "Sports Set",
  "運動衫": "Sports Shirt", "運動衣": "Sports Top", "運動服": "Sportswear",
  "運動風褸": "Sports Windbreaker", "風褸": "Windbreaker", "校褸": "School Jacket",
  "西裝褸": "Blazer", "抓毛背心": "Fleece Waistcoat", "背心": "Waistcoat",
  "長袖": "Long-sleeve", "短袖": "Short-sleeve", "連身": "One-piece",
  "恤衫": "Shirt", "襯衫": "Shirt", "半截": "Half-length", "校裙": "School Skirt",
  "裙褲": "Skort", "裙": "Skirt", "毛冷衫": "Wool Jumper", "冷衫": "Jumper",
  "衛衣": "Sweatshirt", "外套": "Jacket", "校服": "School Uniform",
  "混合毛": "Wool-blend", "羊毛": "Wool", "棉": "Cotton", "長褸": "Long Coat",
  "短褸": "Short Jacket", "褸": "Coat", "POLO": "Polo", "領帶": "Tie",
  "皮帶": "Belt", "腰帶": "Belt", "校徽": "School Badge", "繡章": "Embroidered Badge",
  "連繡章": "with Embroidered Badge", "底衫": "Undershirt", "底裙": "Underskirt",
  "襪": "Socks", "鞋": "Shoes", "手套": "Gloves", "書包": "School Bag",
  "背囊": "Backpack", "筆袋": "Pencil Case", "格仔": "Checked", "水手領": "Sailor Collar",
  "V領": "V-neck", "圓領": "Crew-neck", "長冷": "Long-sleeve Jumper", "冷": "Jumper",
  "校呔": "School Tie", "呔": "Tie", "開胸": "Open-front", "半橡筋": "Half-elastic Waist",
  "領圍": "Collar", "上圍": "Chest", "褲長": "Trouser Length", "裙長": "Skirt Length",
  "袖長": "Sleeve Length", "長度": "Length", "短": "Short", "長": "Long", "裁碼": "Tailored",
  "尺碼不合": "Wrong size", "款式不合": "Style not suitable", "品質問題": "Quality issue",
  "買錯": "Bought by mistake", "更換款式": "Style exchange", "整單更正": "Full transaction correction",
  "不合身退貨": "Fit issue",
  ...receiptProductTranslationTerms,
};

const productTranslationKeys = Object.keys(productTerms).sort((first, second) => second.length - first.length);

export const translateReceiptAttribute = (value) => {
  const normalized = String(value || "").trim();
  const pairSize = normalized.match(/^(\d+)\s*對$/);
  if (pairSize) return `${pairSize[1]} pairs`;
  const numericSize = normalized.match(/^(\d+)\s*碼$/);
  if (numericSize) return numericSize[1];
  if (normalized === "均碼") return "One size";
  return productTerms[normalized] || normalized;
};

export const translateReceiptAttributeDetails = (value) => {
  const original = String(value == null ? "" : value).trim();
  const translatedAttribute = translateReceiptAttribute(original);
  if (translatedAttribute !== original) return { text: translatedAttribute, translated: true, original };
  return translateReceiptProductName(original);
};

export const translateReceiptProductName = (value) => {
  const name = String(value || "").trim();
  if (exactProductTranslations[name]) return { text: exactProductTranslations[name], translated: true, original: name };

  let translated = "";
  let hasUntranslatedText = false;
  for (let index = 0; index < name.length;) {
    if (/\s/.test(name[index])) {
      translated += " ";
      index += 1;
      continue;
    }
    const term = productTranslationKeys.find((candidate) => name.startsWith(candidate, index));
    if (term) {
      translated += `${translated && !/\s$/.test(translated) ? " " : ""}${productTerms[term]}`;
      index += term.length;
      continue;
    }
    const character = name[index];
    if (/[\u3400-\u9fff]/.test(character)) {
      hasUntranslatedText = true;
      index += 1;
      continue;
    }
    if (/[（(]/.test(character)) translated += " (";
    else if (/[）)]/.test(character)) translated = `${translated.trimEnd()})`;
    else if (/[／/、，,]/.test(character)) translated = `${translated.trimEnd()} / `;
    else translated += character;
    index += 1;
  }
  const text = translated.replace(/\s+/g, " ").replace(/\s+([,)])/g, "$1").trim();
  return {
    text: text || (hasUntranslatedText ? "Untranslated" : name || "Untranslated"),
    translated: !hasUntranslatedText,
    original: name,
  };
};

export const translateReceiptSchool = (value) => {
  const name = String(value || "").trim();
  if (name === "港青基信書院") return { text: "YMCA of Hong Kong Christian College", translated: true };
  return { text: name, translated: !/[\u3400-\u9fff]/.test(name) };
};

export const receiptDimensionLabels = (productName = "") => {
  const name = String(productName || "").replace(/\s+/g, "");
  if (/裙/.test(name)) return { length: "裙長", size: "上圍" };
  if (/長袖.*(?:恤衫|襯衫)|(?:恤衫|襯衫).*長袖/.test(name)) return { length: "袖長", size: "領圍" };
  if (/(?:西褲|長褲|短褲|運動褲|褲)/.test(name)) return { length: "褲長", size: "腰圍" };
  return { length: "", size: "尺碼" };
};

export const formatReceiptSize = (productName, size, length, english = false) => {
  const labels = receiptDimensionLabels(productName);
  const englishLabels = {
    length: labels.length === "裙長" ? "Skirt length" : labels.length === "袖長" ? "Sleeve length" : labels.length === "褲長" ? "Trouser length" : "Length",
    size: labels.size === "上圍" ? "Chest" : labels.size === "領圍" ? "Collar" : labels.size === "腰圍" ? "Waist" : "Size",
  };
  const displayLabels = english ? englishLabels : labels;
  const formattedValue = (value) => {
    if (!english) return String(value || "");
    const translated = translateReceiptAttributeDetails(value);
    return `${translated.text}${translated.translated ? "" : ` (English translation unavailable: ${translated.original})`}`;
  };
  const displayedLength = formattedValue(length);
  const displayedSize = formattedValue(size);
  if (length && size) return english
    ? `${displayLabels.length}: ${displayedLength} (${displayLabels.size}: ${displayedSize})`
    : `${displayLabels.length}：${displayedLength}（${displayLabels.size}：${displayedSize}）`;
  if (length) return `${displayLabels.length || (english ? "Length" : "長度")}${english ? ": " : "："}${displayedLength}`;
  return `${displayLabels.size}${english ? ": " : "："}${displayedSize || "-"}`;
};

export const createCustomerReceiptOrder = (order = {}) => ({
  id: order.id || "",
  date: order.date || "",
  time: order.time || "",
  school: order.school || "",
  customerName: String(order.customerName || "").trim().replace(/\s+/g, "").slice(0, 1),
  customerPhone: String(order.customerPhone || "").replace(/\D/g, "").slice(-4),
  outletName: order.outletName || "",
  outletAddress: order.outletAddress || "",
  outletPhone: order.outletPhone || "",
  cashierName: order.cashierName || "",
  items: (Array.isArray(order.items) ? order.items : []).map((item) => ({
    name: item.name || "",
    size: item.size || "",
    length: item.length || "",
    qty: Number(item.qty) || 0,
    price: Number(item.price) || 0,
    exchangeReturn: Boolean(item.exchangeReturn),
  })),
  itemCount: Number(order.itemCount) || 0,
  total: Number(order.total) || 0,
  paymentMethod: order.paymentMethod || "cash",
  cashReceived: order.cashReceived == null ? null : Number(order.cashReceived) || 0,
  changeDue: Number(order.changeDue) || 0,
  refundDue: Number(order.refundDue) || 0,
  refundMethod: order.refundMethod || "cash",
  exchangeSourceReceiptId: order.exchangeSourceReceiptId || "",
  duplicateConfirmed: Boolean(order.duplicateConfirmed),
  duplicateSourceReceiptId: order.duplicateSourceReceiptId || "",
  adjustmentReason: order.adjustmentReason || "",
  replacementSourceReceiptId: order.replacementSourceReceiptId || "",
  settlementDelta: Number(order.settlementDelta) || 0,
  settlementCashReceived: Number(order.settlementCashReceived) || 0,
  settlementChangeDue: Number(order.settlementChangeDue) || 0,
  voidedAt: order.voidedAt || "",
  voidReason: order.voidReason || "",
});

export const receiptProductUnit = (productName = "", size = "") => {
  const name = String(productName || "").replace(/\s+/g, "");
  const normalizedSize = String(size || "").replace(/\s+/g, "");
  if (/襪/.test(name) && /^\d+對$/.test(normalizedSize)) return "包";
  if (/襪.*[（(]?\d+對|[（(]3對[）)]/.test(name)) return "包";
  if (/襪|鞋|手套/.test(name)) return "對";
  if (/套裝|套服/.test(name)) return "套";
  if (/皮帶|腰帶|領帶|頸巾|圍巾/.test(name)) return "條";
  if (/書包|背囊|袋|筆袋/.test(name)) return "個";
  return "件";
};

export const englishReceiptProductUnit = (productName, size = "", quantity = 1) => {
  const unit = receiptProductUnit(productName, size);
  if (unit === "包") return Number(quantity) === 1 ? "pack" : "packs";
  return {
    "件": "pcs",
    "對": "pairs",
    "套": "sets",
    "條": "pcs",
    "個": "pcs",
  }[unit] || "pcs";
};
