export const receiptProductTranslationTerms = {
  "環保袋": "Reusable Bag",
  "膠袋": "Plastic Bag",
};

export const translateReceiptAttribute = (value) => {
  const normalized = String(value || "").trim();
  const pairSize = normalized.match(/^(\d+)\s*對$/);
  if (pairSize) return `${pairSize[1]} pairs`;
  return receiptProductTranslationTerms[normalized] || normalized;
};

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
