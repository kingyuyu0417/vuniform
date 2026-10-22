export const dimensionLabels = (name = "") => {
  const normalizedName = String(name || "").replace(/\s+/g, "");
  if (/裙/.test(normalizedName)) return { length: "裙長", size: "胸寬" };
  if (/長袖.*(?:恤(?:衫)?|襯衫)|(?:恤(?:衫)?|襯衫).*長袖/.test(normalizedName)) return { length: "領圍", size: "袖長" };
  if (/(?:西褲|長褲|短褲|運動褲|褲)/.test(normalizedName)) return { length: "褲長", size: "腰圍" };
  return { length: "", size: "尺碼" };
};

export const hasMatrixSizeOptions = (product = {}) => {
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  if (sizes.some((size) => String(size?.length || "").trim())) return true;

  const normalizedName = String(product.name || "").replace(/\s+/g, "");
  const supportsCombinedMatrixSizes = /裙/.test(normalizedName)
    || /長袖.*(?:恤衫|襯衫)|(?:恤衫|襯衫).*長袖|長恤/.test(normalizedName)
    || (/(?:長西褲|長褲|西褲)/.test(normalizedName) && !/短褲/.test(normalizedName));
  if (!supportsCombinedMatrixSizes) return false;

  return sizes.some((size) => /^\s*\d+(?:\.\d+)?\s*[×xX＊*]\s*\d+(?:\.\d+)?\s*\*?\s*$/.test(String(size?.size || "")));
};

export const sizeDimensionLabel = (product) => dimensionLabels(product?.name).size;
export const lengthDimensionLabel = (product) => dimensionLabels(product?.name).length;
