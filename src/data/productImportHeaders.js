export const PRODUCT_IMPORT_HEADER_ALIASES = {
  school: ["學校", "学校", "school"],
  name: ["款式名稱", "款式", "商品名稱", "品名", "name", "product"],
  size: ["size", "尺碼", "碼數", "腰圍", "袖長", "上圍"],
  length: ["length", "長度", "領圍", "褲長", "裙長"],
  price: ["價錢", "價格", "單價", "price"],
  branchId: ["分店ID", "branch_id", "branch"],
  gender: ["性別區", "性別", "gender"],
};

export const normalizeProductImportHeader = (value) => String(value ?? "").replace(/\s+/g, "").toLowerCase();
