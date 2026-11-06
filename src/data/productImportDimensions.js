import { PRODUCT_IMPORT_HEADER_ALIASES, normalizeProductImportHeader } from "./productImportHeaders.js";

export const getProductImportDimensions = (row = {}) => {
  const valuesByHeader = new Map(
    Object.entries(row).map(([header, value]) => [normalizeProductImportHeader(header), value]),
  );
  const getValue = (aliases) => {
    for (const alias of aliases) {
      const value = valuesByHeader.get(normalizeProductImportHeader(alias));
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  };

  return {
    length: getValue(PRODUCT_IMPORT_HEADER_ALIASES.length),
    size: getValue(PRODUCT_IMPORT_HEADER_ALIASES.size),
  };
};
