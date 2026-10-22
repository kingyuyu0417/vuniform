const isPricedSize = (size) => size && size.price !== null && size.price !== undefined && Number.isFinite(Number(size.price)) && Number(size.price) >= 0;

export const calculateMatrixPrices = (
  sizes,
  draft,
  { preserveExistingPrices = false, baseDimension = "length", surchargeDimension = "size" } = {},
) => {
  const basePricesByValue = {};
  String(draft.basePrices || "").split(/[,\n，、]+/).map((entry) => entry.trim()).filter(Boolean).forEach((entry) => {
    const match = entry.match(/^(.+?)\s*[=:]\s*(\d+(?:\.\d+)?)$/);
    if (match) basePricesByValue[match[1].trim()] = Number(match[2]);
  });
  const surchargeRules = String(draft.surcharges || "").split(/[,\n，、]+/).map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const match = entry.match(/^(\d+(?:\.\d+)?)\s*(\+)?\s*[=:]\s*\+?(\d+(?:\.\d+)?)$/);
    return match ? { threshold: Number(match[1]), amount: Number(match[3]), minimum: Boolean(match[2]) } : null;
  }).filter(Boolean).sort((first, second) => second.threshold - first.threshold);
  if (!Object.keys(basePricesByValue).length || !surchargeRules.length) return null;

  let matchedCount = 0;
  const calculatedSizes = sizes.map((item) => {
    const base = basePricesByValue[item[baseDimension]] ?? basePricesByValue[item.isTailored ? "裁碼" : ""];
    const surchargeValue = String(item[surchargeDimension] ?? "").replace(/[^\d.]/g, "");
    const surchargeNumber = surchargeValue ? Number(surchargeValue) : Number.NaN;
    const rule = surchargeRules.find((candidate) => candidate.minimum ? surchargeNumber >= candidate.threshold : surchargeNumber === candidate.threshold);
    const calculatedPrice = Number.isFinite(Number(base)) && rule ? Number(base) + rule.amount : null;
    if (calculatedPrice !== null) matchedCount += 1;
    if (preserveExistingPrices && isPricedSize(item)) return item;
    return calculatedPrice === null ? item : { ...item, price: calculatedPrice };
  });

  return {
    sizes: calculatedSizes,
    pricing: {
      baseByLength: baseDimension === "length" ? basePricesByValue : undefined,
      baseBySize: baseDimension === "size" ? basePricesByValue : undefined,
      baseDimension,
      surchargeDimension,
      surchargeRules,
    },
    matchedCount,
  };
};
