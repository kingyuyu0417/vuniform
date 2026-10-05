export const productUnit = (name = "", size = "") => {
  const normalizedName = String(name || "").replace(/\s+/g, "");
  const normalizedSize = String(typeof size === "object" && size !== null ? size.size || "" : size || "").replace(/\s+/g, "");
  if (/襪/.test(normalizedName) && /^\d+對$/.test(normalizedSize)) return "包";
  if (/襪.*[（(]?\d+對|[（(]3對[）)]/.test(normalizedName)) return "包";
  if (/襪|鞋|手套/.test(normalizedName)) return "對";
  if (/套裝|套服/.test(normalizedName)) return "套";
  if (/皮帶|腰帶|領帶|頸巾|圍巾/.test(normalizedName)) return "條";
  if (/書包|背囊|袋|筆袋/.test(normalizedName)) return "個";
  return "件";
};
