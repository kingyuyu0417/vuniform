export const dimensionLabels = (name = "") => {
  const normalizedName = String(name || "").replace(/\s+/g, "");
  if (/裙/.test(normalizedName)) return { length: "裙長", size: "上圍" };
  if (/長袖.*(?:恤衫|襯衫)|(?:恤衫|襯衫).*長袖/.test(normalizedName)) return { length: "袖長", size: "領圍" };
  if (/(?:西褲|長褲|短褲|運動褲|褲)/.test(normalizedName)) return { length: "褲長", size: "腰圍" };
  return { length: "", size: "尺碼" };
};

export const sizeDimensionLabel = (product) => dimensionLabels(product?.name).size;
export const lengthDimensionLabel = (product) => dimensionLabels(product?.name).length;
