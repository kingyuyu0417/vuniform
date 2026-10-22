export const cleanProductName = (name) => {
  const cleaned = String(name || "").replace(/\s+/g, " ").trim();
  if (cleaned.length > 50) {
    const matches = [...cleaned.matchAll(/(?:男生|女生|男女生|Boy[`'’]s|Girl[`'’]s)/g)];
    if (matches.length > 1) return cleaned.slice(matches[matches.length - 1].index).trim();
  }
  return cleaned;
};
