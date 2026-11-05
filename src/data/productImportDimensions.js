const normalizeHeader = (value) => String(value || "").replace(/\s+/g, "").toLowerCase();

const dimensionAliases = {
  length: ["length", "長度", "領圍", "褲長", "裙長"],
  size: ["size", "尺碼", "碼數", "腰圍", "袖長", "上圍"],
};

export const getProductImportDimensions = (row = {}) => {
  const valuesByHeader = new Map(
    Object.entries(row).map(([header, value]) => [normalizeHeader(header), value]),
  );
  const getValue = (aliases) => {
    for (const alias of aliases) {
      const value = valuesByHeader.get(normalizeHeader(alias));
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  };

  return {
    length: getValue(dimensionAliases.length),
    size: getValue(dimensionAliases.size),
  };
};
