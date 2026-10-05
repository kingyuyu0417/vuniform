export const PRODUCT_GENDER_OPTIONS = [
  { value: "boys", label: "男生" },
  { value: "girls", label: "女生" },
  { value: "unisex", label: "男女生" },
];

const productGenderOverrides = {
  "藍／紫色短袖恤衫": "boys",
  "黑色短西褲": "boys",
  "藍／紫色連身校裙": "girls",
  "男生長西褲": "boys",
  "女生背心校裙": "girls",
  "男生黑色短襪（3對）": "boys",
  "女生黑色長襪": "girls",
};

export const getProductGender = (product = {}) => {
  if (PRODUCT_GENDER_OPTIONS.some(({ value }) => value === product.gender)) return product.gender;

  const name = String(product.name || "");
  if (productGenderOverrides[name]) return productGenderOverrides[name];
  const hasUnisexLabel = /(?:男女生|男女通用|【男女生】)/.test(name);
  const hasMaleLabel = /男生|男裝|\bBoy[`'’]s\b/i.test(name);
  const hasFemaleLabel = /女生|女裝|\bGirl[`'’]s\b/i.test(name);
  if (hasUnisexLabel || (hasMaleLabel && hasFemaleLabel) || (!hasMaleLabel && !hasFemaleLabel && name.includes("運動"))) return "unisex";
  if (hasFemaleLabel) return "girls";
  if (hasMaleLabel) return "boys";
  return "unisex";
};

export const productGenderBackground = () => "#fff";
