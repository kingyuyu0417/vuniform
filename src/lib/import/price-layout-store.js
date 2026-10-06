const layoutKey = (layout) => `${layout.school}\u0000${layout.sheet}`;

const isValidBlock = (block) => (
  block
  && typeof block.id === "string"
  && Number.isInteger(block.dataFirst)
  && Number.isInteger(block.dataLast)
  && block.dataFirst > 0
  && block.dataLast >= block.dataFirst
  && (block.sizeCol == null || /^[A-Z]+$/.test(block.sizeCol))
  && Array.isArray(block.priceCols)
  && block.priceCols.length > 0
  && block.priceCols.every((column) => (
    column
    && /^[A-Z]+$/.test(column.col)
    && ["unit", "bundle", "setTotal"].includes(column.kind)
  ))
);

export const isVerifiedPriceLayoutRow = (row) => {
  const config = row?.config;
  return row?.verified === true
    && typeof row.school === "string"
    && row.school.trim().length > 0
    && typeof row.sheet === "string"
    && row.sheet.trim().length > 0
    && config
    && config.school === row.school
    && config.sheet === row.sheet
    && typeof config.signature === "string"
    && config.signature.length > 0
    && Array.isArray(config.blocks)
    && config.blocks.length > 0
    && config.blocks.every(isValidBlock);
};

export const mergePriceLayouts = (builtInLayouts, storedRows = []) => {
  const overrides = new Map(
    storedRows
      .filter(isVerifiedPriceLayoutRow)
      .map((row) => [layoutKey(row.config), row.config]),
  );
  const merged = builtInLayouts.map((layout) => {
    const key = layoutKey(layout);
    const stored = overrides.get(key);
    overrides.delete(key);
    return stored ? { ...stored, learned: true } : layout;
  });
  return [...merged, ...[...overrides.values()].map((layout) => ({ ...layout, learned: true }))];
};

export const toVerifiedPriceLayoutRows = (layouts) => layouts.map((layout) => ({
  school: layout.school,
  sheet: layout.sheet,
  season: layout.season || "",
  config: layout,
  verified: true,
  source: "confirmed-generic-import",
  note: "由管理員核對通用辨識預覽後保存",
  updated_at: new Date().toISOString(),
}));
