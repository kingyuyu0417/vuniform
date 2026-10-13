export const normalizeManualPickupNumber = (value) => {
  const input = String(value ?? "").trim();
  if (!/^\d{1,3}$/.test(input)) return "";

  const number = Number(input);
  return number >= 1 && number <= 999 ? String(number) : "";
};

export const formatManualPickupAnnouncement = (value, language = "yue") => {
  const number = normalizeManualPickupNumber(value);
  if (!number) return "";

  if (language === "en") return `Number ${number}, please collect your order.`;
  if (language === "zh") return `${number}号请取货`;
  if (language === "yue") return `${number}號請取貨`;
  return "";
};
