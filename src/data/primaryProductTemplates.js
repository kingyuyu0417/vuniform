export const PRODUCT_SEASON_OPTIONS = [
  { value: "summer", label: "夏季" },
  { value: "winter", label: "冬季" },
  { value: "all", label: "兩季通用" },
];

export const PRODUCT_GENDER_OPTIONS = [
  { value: "boys", label: "男裝" },
  { value: "girls", label: "女裝" },
  { value: "unisex", label: "男女通用" },
];

export const PRIMARY_PRODUCT_CATEGORIES = [
  {
    value: "shirt",
    label: "恤衫",
    selectors: [
      { key: "sleeve", label: "袖長", options: [{ value: "short", label: "短袖" }, { value: "long", label: "長袖" }] },
      { key: "collar", label: "領型", options: [
        { value: "round", label: "圓領" },
        { value: "point", label: "尖領" },
        { value: "up-down", label: "上下級領" },
        { value: "hawaiian", label: "夏威夷領" },
        { value: "swallow", label: "燕子領" },
        { value: "eight-character", label: "八字領" },
        { value: "other", label: "其他" },
        { value: "unspecified", label: "" },
      ] },
    ],
  },
  {
    value: "skirt",
    label: "裙",
    selectors: [{ key: "style", label: "款式", options: [
      { value: "short", label: "短裙" },
      { value: "long", label: "長裙" },
      { value: "skort", label: "裙褲" },
      { value: "pinafore", label: "背心裙" },
    ] }],
  },
  {
    value: "trousers",
    label: "西褲",
    selectors: [{ key: "length", label: "褲長", options: [{ value: "short", label: "短褲" }, { value: "long", label: "長褲" }] }],
  },
  {
    value: "sweater",
    label: "冷衫",
    selectors: [{ key: "style", label: "款式", options: [
      { value: "cardigan-vest", label: "開胸背心" },
      { value: "cardigan-long", label: "開胸長袖" },
      { value: "v-neck-vest", label: "V領背心" },
      { value: "v-neck-long", label: "V領長袖" },
    ] }],
  },
  { value: "school-jacket", label: "校褸", selectors: [] },
  {
    value: "sports-top",
    label: "運動上衣",
    selectors: [{ key: "sleeve", label: "袖長", options: [{ value: "short", label: "短袖" }, { value: "long", label: "長袖" }] }],
  },
  {
    value: "sports-trousers",
    label: "運動褲",
    selectors: [{ key: "length", label: "褲長", options: [{ value: "short", label: "短褲" }, { value: "long", label: "長褲" }] }],
  },
  { value: "sports-jacket", label: "運動外套", selectors: [] },
  {
    value: "undershirt",
    label: "底衫",
    selectors: [{ key: "style", label: "款式", options: [{ value: "vest", label: "背心" }, { value: "long-sleeve", label: "長袖" }] }],
  },
  {
    value: "tie",
    label: "校呔",
    selectors: [{ key: "style", label: "款式", options: [
      { value: "regular", label: "一般校呔" },
      { value: "bow-tie", label: "男煲呔" },
      { value: "butterfly-tie", label: "女蝴蝶呔" },
    ] }],
  },
  {
    value: "socks",
    label: "襪",
    selectors: [{ key: "style", label: "款式", options: [
      { value: "tights", label: "襪褲" },
      { value: "long", label: "長襪" },
      { value: "short", label: "短襪" },
    ] }],
  },
  { value: "belt", label: "皮帶", selectors: [] },
];

const tailoredSizes = (sizes) => [...sizes, "裁碼"];
const numericSizes = (start, end, step = 2) => {
  const sizes = [];
  for (let size = start; size <= end; size += step) sizes.push(String(size));
  return sizes;
};

const SUZHOU_SIZE_PRESETS = [
  { season: "winter", gender: "boys", category: "shirt", options: { sleeve: "long" }, source: "冬 2026 男白長袖恤連章", sizes: tailoredSizes(["10", "10.5", "11", "11.5", "12", "12.5", "13"]) },
  { season: "winter", gender: "girls", category: "shirt", options: { sleeve: "long", collar: "round" }, source: "冬 2026 女圓領白長袖恤", sizes: tailoredSizes(numericSizes(14, 26)) },
  { season: "winter", gender: "boys", category: "trousers", options: { length: "long" }, source: "冬 2026 藍色長西褲", sizes: tailoredSizes(numericSizes(24, 36)) },
  { season: "winter", gender: "boys", category: "trousers", options: { length: "short" }, source: "冬 2026 藍色短西褲", sizes: tailoredSizes(["10", "11", "12", "13", "14", "15", "16"]) },
  { season: "winter", gender: "girls", category: "skirt", options: { style: "pinafore" }, source: "冬 2026 藍色背心裙", sizes: tailoredSizes(numericSizes(24, 36)) },
  { season: "winter", gender: "girls", category: "sweater", options: { style: "cardigan-long" }, source: "冬 2026 藍色冷衫（開胸長袖）", sizes: tailoredSizes(numericSizes(6, 18)) },
  { season: "winter", gender: "girls", category: "sweater", options: { style: "v-neck-vest" }, source: "冬 2026 藍色冷衫（V領背心）", sizes: tailoredSizes(numericSizes(6, 18)) },
  { season: "winter", gender: "unisex", category: "sports-top", options: { sleeve: "long" }, source: "冬 2026 長袖運動衣", sizes: tailoredSizes(numericSizes(24, 36)) },
  { season: "winter", gender: "unisex", category: "sports-trousers", options: { length: "long" }, source: "冬 2026 長運褲", sizes: tailoredSizes(numericSizes(24, 36)) },
  { season: "winter", gender: "unisex", category: "school-jacket", source: "冬 2026 藍色西裝校褸", sizes: tailoredSizes(numericSizes(16, 22)) },
  { season: "winter", gender: "unisex", category: "undershirt", options: { style: "long-sleeve" }, source: "冬 2026 長袖底衫", sizes: numericSizes(20, 36) },
  { season: "winter", gender: "boys", category: "tie", options: { style: "bow-tie" }, source: "冬 2026 男煲呔", sizes: ["均碼"] },
  { season: "winter", gender: "girls", category: "tie", options: { style: "butterfly-tie" }, source: "冬 2026 女蝴蝶呔", sizes: ["均碼"] },
  { season: "winter", gender: "unisex", category: "socks", options: { style: "tights" }, source: "冬 2026 灰襪褲", sizes: ["均碼"] },
  { season: "winter", gender: "unisex", category: "socks", options: { style: "long" }, source: "冬 2026 灰長襪", sizes: ["均碼"] },
  { season: "winter", gender: "unisex", category: "belt", source: "冬 2026 黑皮帶", sizes: ["均碼"] },
  { season: "summer", gender: "girls", category: "skirt", source: "夏 2027 女白色校裙", sizes: tailoredSizes(numericSizes(22, 36)) },
  { season: "summer", gender: "boys", category: "shirt", options: { sleeve: "short" }, source: "夏 2027 男白短袖恤衫", sizes: tailoredSizes(numericSizes(14, 28)) },
  { season: "summer", gender: "boys", category: "trousers", options: { length: "short" }, source: "夏 2027 男白色短西褲", sizes: tailoredSizes(["10", "11", "12", "13", "14", "15", "16", "17"]) },
  { season: "summer", gender: "unisex", category: "sports-top", options: { sleeve: "short" }, source: "夏 2027 夏運衣", sizes: tailoredSizes(numericSizes(22, 36)) },
  { season: "summer", gender: "unisex", category: "sports-trousers", options: { length: "short" }, source: "夏 2027 夏運褲", sizes: tailoredSizes(["XS", "S", "M", "L", "XL"]) },
  { season: "summer", gender: "unisex", category: "school-jacket", source: "夏 2027 白秋褸", sizes: tailoredSizes(["6", "8", "10", "12", "14", "16"]) },
  { season: "summer", gender: "unisex", category: "undershirt", options: { style: "vest" }, source: "夏 2027 背心底衫", sizes: ["2-6", "8-12", "14-18", "S-XL"] },
  { season: "summer", gender: "unisex", category: "socks", options: { style: "short" }, source: "夏 2027 白短襪", sizes: ["一對", "三對", "半打", "一打"] },
  { season: "summer", gender: "unisex", category: "socks", options: { style: "long" }, source: "夏 2027 白長襪", sizes: ["均碼"] },
  { season: "summer", gender: "unisex", category: "belt", source: "夏 2027 小學黑皮帶", sizes: ["均碼"] },
];

const SUZHOU_PRIMARY_SCHOOL = "蘇浙小學";
const PRIMARY_SHIRT_COLLAR_SIZES = ["11", "11.5", "12", "12.5", "13", "13.5", "14", "14.5", "15", "15.5", "16", "16.5", "17", "17.5", "18", "18.5", "19", "19.5", "20", "21", "22"];
const PRIMARY_SHORT_SHIRT_SIZES = ["18", "20", "22", "24", "26", "28", "30", "32", "34", "36"];
const PRIMARY_GIRLS_LONG_ROUND_SHIRT_SIZES = ["14", "16", "18", "20", "22", "24", "26", "28", "30", "32", "34"];
const SECONDARY_GIRLS_LONG_ROUND_SHIRT_SIZES = ["34", "36", "38", "40", "43", "46"];
const UNISEX_LONG_POINT_SHIRT_SIZES = [
  "11.5×22", "12×23", "12×24", "12×25", "12.5×24*", "12.5×26", "12.5×27",
  "13×25*", "13×28", "13.5×26*", "13.5×29", "14×27*", "14×30",
  "14.5×28*", "14.5×31", "15×29*", "15×32", "15.5×32", "15.5×34",
  "16×32", "16×33", "16×34", "16.5×33", "16.5×34", "17×33",
  "17.5×34", "17.5×35", "18×33", "18.5×34", "19.5×35",
  "20.5×36**", "21.5×36**",
];
const PRIMARY_SHORT_TROUSER_SIZES = ["12", "13", "14", "15", "16", "17", "18", "19", "20", "22"];
const PRIMARY_LONG_TROUSER_SIZES = ["26", "28", "30", "32", "34", "36", "38", "40", "42"];
const SECONDARY_TROUSER_LENGTHS = ["33", "34", "35", "36", "37", "38", "38.5", "40", "41.5", "42", "43", "44", "44.5", "46", "48", "50"];
const SECONDARY_TROUSER_WAISTS = ["24", "25", "26", "27", "28", "29", "30", "32", "34", "36", "38", "40", "42", "44", "46", "48", "50", "52"];
export const SECONDARY_TROUSER_SURCHARGE_RULES = "32+=0,40=10,41.5+=20,43+=30";

export const getProductCategory = (categoryValue) => PRIMARY_PRODUCT_CATEGORIES
  .find((category) => category.value === categoryValue) || null;

export const getProductSelectorOptions = (categoryValue, selectorKey, gender, context = {}) => {
  const selector = getProductCategory(categoryValue)?.selectors
    .find((candidate) => candidate.key === selectorKey);
  if (!selector) return [];
  if (categoryValue === "shirt" && selectorKey === "collar") {
    const optionalCollars = selector.options.filter((option) => ["other", "unspecified"].includes(option.value));
    if (context.sleeve === "short" && context.schoolLevel === "小學") {
      return [
        ...selector.options.filter((option) => ["up-down", "hawaiian", "swallow", "eight-character"].includes(option.value)),
        ...optionalCollars,
      ];
    }
    if (context.sleeve === "long") {
      return [
        ...selector.options.filter((option) => ["round", "point"].includes(option.value)),
        ...optionalCollars,
      ];
    }
  }
  if (categoryValue === "tie" && selectorKey === "style") {
    return selector.options.filter((option) => (
      (option.value === "bow-tie" && gender === "boys")
      || (option.value === "butterfly-tie" && gender === "girls")
      || (option.value === "regular" && gender === "unisex")
    ));
  }
  return selector.options;
};

export const getProductStyleLabel = (categoryValue, options = {}) => {
  const category = getProductCategory(categoryValue);
  if (!category) return "";
  return category.selectors
    .map((selector) => {
      const selected = selector.options.find((option) => option.value === options[selector.key]);
      if (categoryValue === "shirt" && selector.key === "collar" && options.collar === "other" && options.collarCustom?.trim()) {
        return options.collarCustom.trim();
      }
      return selected?.label;
    })
    .filter(Boolean)
    .join("／");
};

export const getDefaultProductOptions = (categoryValue, gender = "unisex", context = {}) => {
  const category = getProductCategory(categoryValue);
  return Object.fromEntries((category?.selectors || []).map((selector) => [
    selector.key,
    getProductSelectorOptions(categoryValue, selector.key, gender, { ...context, sleeve: context.sleeve || (selector.key === "collar" ? "short" : "") })[0]?.value || "",
  ]));
};

export const normalizeProductOptions = (categoryValue, gender, options = {}, context = {}) => {
  const category = getProductCategory(categoryValue);
  return {
    ...Object.fromEntries((category?.selectors || []).map((selector) => {
      const allowedOptions = getProductSelectorOptions(categoryValue, selector.key, gender, {
        ...context,
        sleeve: options.sleeve || context.sleeve,
      });
      const requestedValue = options[selector.key];
      const selectedValue = allowedOptions.some((option) => option.value === requestedValue)
        ? requestedValue
        : (allowedOptions[0]?.value || "");
      return [selector.key, selectedValue];
    })),
    ...(options.collarCustom ? { collarCustom: options.collarCustom } : {}),
  };
};

export const buildDefaultProductName = ({ season, gender, category, options }) => {
  const seasonLabel = PRODUCT_SEASON_OPTIONS.find((option) => option.value === season)?.label || "";
  const genderLabel = PRODUCT_GENDER_OPTIONS.find((option) => option.value === gender)?.label || "";
  const categoryLabel = getProductCategory(category)?.label || "";
  const styleLabel = getProductStyleLabel(category, options);
  return [seasonLabel, genderLabel, categoryLabel].filter(Boolean).join(" ")
    + (styleLabel ? `（${styleLabel}）` : "");
};

export const getPrimaryProductSizePreset = ({ school, schoolLevel, season, gender, category, options = {} }) => {
  if (!["summer", "winter"].includes(season)) return null;
  if (category === "shirt") {
    if (options.sleeve === "long" && options.collar === "point") {
      return { source: "男女尖領長袖恤衫尺碼總表", sizes: [...UNISEX_LONG_POINT_SHIRT_SIZES] };
    }
    if (options.sleeve === "long" && options.collar === "round" && gender === "girls") {
      if (schoolLevel === "小學") return { source: "小學女生圓領長袖恤衫（衫長）", sizes: [...PRIMARY_GIRLS_LONG_ROUND_SHIRT_SIZES] };
      if (schoolLevel === "中學") return { source: "中學女生圓領長袖恤衫（胸寬）", sizes: [...SECONDARY_GIRLS_LONG_ROUND_SHIRT_SIZES] };
    }
    if (schoolLevel === "小學" && options.sleeve === "short") {
      const sizes = options.collar === "up-down" ? PRIMARY_SHIRT_COLLAR_SIZES : PRIMARY_SHORT_SHIRT_SIZES;
      if (["up-down", "hawaiian", "swallow", "eight-character"].includes(options.collar)) {
        return { source: `小學男女短恤（${getProductStyleLabel(category, options)}）`, sizes: [...sizes] };
      }
    }
  }
  if (category === "trousers") {
    if (schoolLevel === "小學" && options.length === "short") {
      return { source: "小學短西褲", sizes: [...PRIMARY_SHORT_TROUSER_SIZES] };
    }
    if (schoolLevel === "小學" && options.length === "long") {
      return { source: "小學長西褲", sizes: [...PRIMARY_LONG_TROUSER_SIZES] };
    }
    if (schoolLevel === "中學" && options.length === "long") {
      return {
        source: "中學長西褲（褲長 × 腰圍）",
        matrix: { lengths: [...SECONDARY_TROUSER_LENGTHS], sizes: [...SECONDARY_TROUSER_WAISTS] },
        surchargeRules: SECONDARY_TROUSER_SURCHARGE_RULES,
      };
    }
  }
  if (school !== SUZHOU_PRIMARY_SCHOOL) return null;
  const candidates = SUZHOU_SIZE_PRESETS
    .filter((preset) => preset.season === season
      && preset.category === category
      && (preset.gender === gender || preset.gender === "unisex")
      && Object.entries(preset.options || {}).every(([key, value]) => options[key] === value))
    .sort((first, second) => Object.keys(second.options || {}).length - Object.keys(first.options || {}).length);
  const preset = candidates[0];
  return preset ? { source: preset.source, sizes: [...preset.sizes] } : null;
};

export const parseProductSizeLabels = (value) => [...new Set(
  String(value || "")
    .split(/[,\n，、]+/)
    .map((size) => size.trim())
    .filter(Boolean),
)];
