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

export const getPickupSpeechErrorMessage = (errorCode) => {
  if (errorCode === "interrupted") {
    return "語音播報被裝置中斷，系統已重試；如仍未播出，請按「繼續叫號播報」。";
  }
  if (errorCode === "canceled") {
    return "語音播報已取消，請按「繼續叫號播報」重試。";
  }
  if (errorCode === "not-allowed") {
    return "瀏覽器未允許語音播報，請按「繼續叫號播報」。";
  }
  return "語音播報失敗，請檢查裝置語音設定後按「繼續叫號播報」。";
};

export const retryInterruptedPickupSpeech = async (
  speak,
  { resume = () => {}, wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)), delayMs = 300 } = {},
) => {
  try {
    return await speak();
  } catch (error) {
    if (error?.name !== "interrupted") throw error;
    resume();
    await wait(delayMs);
    return speak();
  }
};

export const getPickupSpeechStartDelayMs = (chimeDurationSeconds, leadMs = 300) => (
  Math.max(0, Math.round(chimeDurationSeconds * 1000 - leadMs))
);
