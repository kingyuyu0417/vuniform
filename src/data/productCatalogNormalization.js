const SIZE_TERMINALS = [
  "背心冷衫",
  "背心毛衣",
  "長袖冷衫",
  "運動長袖衛衣",
  "運動短袖衫",
  "運動外套",
  "運動風褸",
  "運動長褲",
  "運動套裝",
  "長袖衛衣",
  "短袖恤衫",
  "短袖衫",
  "短西褲",
  "長西褲",
  "校裙",
  "女恤",
  "恤衫",
  "冷衫",
  "衛衣",
  "風褸",
  "外套",
  "長褲",
  "短褲",
  "套裝",
  "裙",
  "褲",
  "Vest",
  "Sweater",
  "Jacket",
  "Long Pants",
];

const genderPrefix = /^(男生|女生|男女生)\s*[-–—:：]?\s*/;
const englishGroupPrefix = /^(Boy[`'’]s\s*&\s*Girl[`'’]s)\s*/i;
const normalizeNameKey = (name) => String(name || "").replace(/[\s\-–—:：]/g, "").toLowerCase();
const productGender = (name) => String(name || "").match(genderPrefix)?.[1]
  || (englishGroupPrefix.test(String(name || "")) ? "unisex" : "");
const productIdentityName = (name) => String(name || "")
  .replace(/^(?:Boy[`'’]s\s*&\s*Girl[`'’]s|男生|女生|男女生)\s*[-–—:：]?\s*/i, "")
  .replace(/[／/、，,\s\-–—:：]/g, "")
  .toLowerCase();

const withPrefix = (name, prefix) => {
  const cleanName = String(name || "").replace(/^[-–—:：\s]+/, "").trim();
  if (!cleanName) return "";
  if (genderPrefix.test(cleanName) || englishGroupPrefix.test(cleanName)) return cleanName;
  return prefix ? `${prefix} - ${cleanName}` : cleanName;
};

const splitWhitespaceJoinedName = (name) => {
  const candidates = [];
  for (const terminal of [...SIZE_TERMINALS].sort((first, second) => second.length - first.length)) {
    const pattern = new RegExp(terminal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    for (const match of name.matchAll(pattern)) {
      const end = match.index + match[0].length;
      const remainder = name.slice(end).trim();
      if (!remainder || !/\s/.test(name.slice(end - 1, end + 1))) continue;
      if (!SIZE_TERMINALS.some((nextTerminal) => new RegExp(`${nextTerminal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i").test(remainder))) continue;
      candidates.push([name.slice(0, end).trim(), remainder]);
    }
  }
  const selected = candidates.sort((first, second) => first[0].length - second[0].length)[0];
  if (!selected) return null;
  const names = selected.map((segment) => withPrefix(segment, ""));
  return new Set(names.map(normalizeNameKey)).size === names.length ? names : null;
};

export const splitCompositeProductName = (name) => {
  const original = String(name || "").trim();
  const chinesePrefix = original.match(genderPrefix);
  const englishPrefix = original.match(englishGroupPrefix);
  const prefix = chinesePrefix?.[1] || englishPrefix?.[1] || "";
  const body = original.replace(genderPrefix, "").replace(englishGroupPrefix, "").trim();

  const segments = body.split(/\s+(?=(?:男生|女生|男女生)\s*[-–—:：])/)
    .flatMap((segment) => {
      const localPrefix = segment.match(genderPrefix)?.[1] || prefix;
      return segment.replace(genderPrefix, "").split(/\s+[-–—]\s*/)
        .map((part) => ({ name: part.trim(), prefix: localPrefix }))
        .filter((part) => part.name);
    });

  if (segments.length <= 1) {
    const joinedSegments = splitWhitespaceJoinedName(body);
    if (!joinedSegments) return null;
    const names = joinedSegments.map((segment) => withPrefix(segment, prefix));
    return new Set(names.map(normalizeNameKey)).size === names.length ? names : null;
  }

  const names = segments.map(({ name, prefix: segmentPrefix }) => withPrefix(name, segmentPrefix)).filter(Boolean);
  if (names.length < 2 || new Set(names.map(normalizeNameKey)).size !== names.length) return null;
  return names;
};

const sizeIdentity = (size = {}) => {
  const length = String(size.length || "").replace(/^裁碼\s*/, "");
  const isTailored = Boolean(size.isTailored || String(size.size || "").trim() === "裁碼" || /^裁碼(?:\s|$)/.test(String(size.length || "").trim()));
  return `${isTailored ? "tailored" : "regular"}\u0000${length}\u0000${size.size || ""}`;
};

export const splitCompositeProductRecord = (product) => {
  const names = splitCompositeProductName(product?.name);
  const sizes = Array.isArray(product?.sizes) ? product.sizes : [];
  if (!names || sizes.length < names.length) return [product];

  const sizeGroups = new Map();
  sizes.forEach((size) => {
    const key = sizeIdentity(size);
    if (!sizeGroups.has(key)) sizeGroups.set(key, []);
    sizeGroups.get(key).push(size);
  });
  if ([...sizeGroups.values()].some((group) => group.length !== names.length)) return [product];

  return names.map((name, index) => ({
    ...product,
    sourceProductId: product.sourceProductId || product.id,
    id: `${product.id}-style-${index + 1}`,
    name,
    sizes: [...sizeGroups.values()].map((group) => group[index]),
  }));
};

export const splitCompositeImportRows = (rows = []) => {
  const importRows = rows.map((row) => ({ ...row }));
  const groups = new Map();
  importRows.forEach((row, rowIndex) => {
    const names = splitCompositeProductName(row.name);
    if (!names) return;
    const key = `${String(row.school || "").trim()}\u0000${row.name}`;
    if (!groups.has(key)) groups.set(key, { names, rowsBySize: new Map() });
    const group = groups.get(key);
    const size = String(row.size ?? "").trim();
    const length = String(row.length || "").trim().replace(/^裁碼\s*/, "");
    const tailored = Boolean(
      row.isTailored === true
      || ["true", "1", "yes", "是", "裁碼"].includes(String(row.isTailored || "").trim().toLowerCase())
      || size === "裁碼"
      || /^裁碼(?:\s|$)/.test(String(row.length || "").trim()),
    );
    const sizeKey = sizeIdentity({ size, length, isTailored: tailored });
    if (!group.rowsBySize.has(sizeKey)) group.rowsBySize.set(sizeKey, []);
    group.rowsBySize.get(sizeKey).push(rowIndex);
  });

  const unresolvedNames = [];
  groups.forEach((group) => {
    const canSplit = group.rowsBySize.size > 0
      && [...group.rowsBySize.values()].every((indexes) => indexes.length === group.names.length);
    if (!canSplit) {
      unresolvedNames.push(group.names);
      return;
    }
    group.rowsBySize.forEach((indexes) => {
      indexes.forEach((rowIndex, styleIndex) => {
        importRows[rowIndex].name = group.names[styleIndex];
      });
    });
  });

  return { rows: importRows, unresolvedNames };
};

export const findProductCatalogReviewGroups = (products = []) => {
  const families = new Map();
  products.forEach((product) => {
    const nameKey = productIdentityName(product.name);
    const familyKey = `${product.school || ""}\u0000${product.branch_id || ""}\u0000${productGender(product.name)}\u0000${nameKey}`;
    if (!families.has(familyKey)) families.set(familyKey, { id: familyKey, school: product.school || "", products: [] });
    const family = families.get(familyKey);
    family.products.push(product);
  });

  return [...families.values()].flatMap((family) => {
    const entries = family.products.flatMap((product) => (product.sizes || []).map((size, sizeIndex) => ({
      key: `${product.id}::${sizeIndex}`,
      productId: product.id,
      sizeIndex,
      size,
      sourceName: product.name,
    })));
    const pricesBySize = new Map();
    entries.forEach((entry) => {
      const key = sizeIdentity(entry.size);
      const price = Number(entry.size.price);
      if (!pricesBySize.has(key)) pricesBySize.set(key, new Set());
      if (Number.isFinite(price)) pricesBySize.get(key).add(price);
    });
    if (![...pricesBySize.values()].some((prices) => prices.size > 1)) return [];

    return [{
      ...family,
      entries,
    }];
  });
};

export const removeProductCatalogReviewProducts = (products, groups) => {
  const ids = new Set(groups.flatMap((group) => group.products.map((product) => product.sourceProductId || product.id)));
  return {
    products: products.filter((product) => !ids.has(product.sourceProductId || product.id)),
    productIds: [...ids],
    removedCount: ids.size,
  };
};
