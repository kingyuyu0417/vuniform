const SCHOOL_NAME_ALIASES = new Map([
  ["保良局董玉梯紀念中學", "保良局董玉娣中學"],
  ["元朗朗屏屯邨東莞學校", "元朗朗屏邨東莞學校"],
]);

const SCHOOL_CATALOG_ALIASES = new Map([
  ["元朗朗屏邨東莞學校", "東莞學校"],
]);

export const canonicalSchoolName = (name) => {
  const normalized = String(name || "").trim();
  return SCHOOL_NAME_ALIASES.get(normalized) || normalized;
};

export const schoolCatalogKey = (name) => {
  const canonicalName = canonicalSchoolName(name);
  return SCHOOL_CATALOG_ALIASES.get(canonicalName) || canonicalName;
};
