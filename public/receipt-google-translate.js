export const buildGoogleTranslateUrl = (receiptUrl) => {
  const sourceUrl = new URL(receiptUrl);
  if (!["http:", "https:"].includes(sourceUrl.protocol)) {
    throw new Error("Google Translate requires an HTTP or HTTPS receipt URL.");
  }
  if (sourceUrl.pathname === "/receipt") sourceUrl.pathname = "/receipt.html";

  const translateUrl = new URL("https://translate.google.com/translate");
  translateUrl.searchParams.set("sl", "zh-TW");
  translateUrl.searchParams.set("tl", "en");
  translateUrl.searchParams.set("u", sourceUrl.href);
  return translateUrl.href;
};
