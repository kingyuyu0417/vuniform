import { translateReceiptProductName } from "../../public/receipt-translations.js";

const normalizeMatchName = (value) => String(value || "")
  .replace(/[（(].*?[）)]/g, "")
  .replace(/男生|女生|男女生|男裝|女裝|校服|同學/g, "")
  .replace(/[\s/／、，。]/g, "");

export const buildReceiptNameCandidates = (notice, products, school = "") => {
  if (!school) return [];
  const noticeProducts = (notice?.productsFound || []).map((name) => ({
    name,
    normalized: normalizeMatchName(name),
  })).filter(({ normalized }) => normalized);

  return (products || [])
    .filter((product) => product.school === school)
    .flatMap((product) => {
      const normalizedProduct = normalizeMatchName(product.name);
      const noticeMatch = noticeProducts.find(({ normalized }) => (
        normalizedProduct.includes(normalized) || normalized.includes(normalizedProduct)
      ));
      if (!noticeMatch) return [];

      const translation = translateReceiptProductName(product.name);
      return [{
        productId: product.id,
        productName: product.name,
        noticeName: noticeMatch.name,
        existingEnglishName: product.receiptNameEn || "",
        suggestedEnglishName: translation.translated ? translation.text : "",
        needsManualTranslation: !translation.translated,
      }];
    });
};
