export const normalizeManualPickupNumber = (value) => {
  const input = String(value ?? "").trim();
  if (!/^\d{1,3}$/.test(input)) return "";

  const number = Number(input);
  return number >= 1 && number <= 999 ? String(number) : "";
};

export const formatManualPickupAnnouncement = (value) => {
  const number = normalizeManualPickupNumber(value);
  return number ? `${number}號請取貨` : "";
};
