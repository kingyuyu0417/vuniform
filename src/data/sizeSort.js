const APPAREL_SIZE_ORDER = new Map(
  ["XXS", "XS", "S", "M", "L", "XL", "XXL"].map((size, index) => [size, index]),
);
const englishSizeCollator = new Intl.Collator("en", { numeric: true });
const chineseStrokeCollator = new Intl.Collator("zh-Hant-u-co-stroke", { numeric: true });

const sizeCategory = (value) => {
  const text = String(value ?? "").trim();
  const normalized = text.toLocaleUpperCase("en");
  if (APPAREL_SIZE_ORDER.has(normalized)) return 0;
  if (/\p{Script=Han}/u.test(text)) return 2;
  if (/^[+-]?\d+(?:\.\d+)?(?:\s*\/\s*[A-Za-z]+)?$/.test(text)) return 1;
  if (/[A-Za-z]/.test(text)) return 0.5;
  return 2;
};

export const naturalSizeSort = (first, second) => {
  const firstText = String(first ?? "").trim();
  const secondText = String(second ?? "").trim();
  const firstTailored = /^裁碼(?:\s|$)/.test(firstText);
  const secondTailored = /^裁碼(?:\s|$)/.test(secondText);
  if (firstTailored || secondTailored) {
    if (firstTailored === secondTailored) return 0;
    return firstTailored ? 1 : -1;
  }

  const firstCategory = sizeCategory(firstText);
  const secondCategory = sizeCategory(secondText);
  if (firstCategory !== secondCategory) return firstCategory - secondCategory;

  if (firstCategory === 0) {
    const firstRank = APPAREL_SIZE_ORDER.get(firstText.toLocaleUpperCase("en"));
    const secondRank = APPAREL_SIZE_ORDER.get(secondText.toLocaleUpperCase("en"));
    if (firstRank !== undefined || secondRank !== undefined) {
      if (firstRank === undefined) return 1;
      if (secondRank === undefined) return -1;
      if (firstRank !== secondRank) return firstRank - secondRank;
    }
    return englishSizeCollator.compare(firstText, secondText);
  }

  if (firstCategory === 1) {
    const firstNumber = Number.parseFloat(firstText);
    const secondNumber = Number.parseFloat(secondText);
    if (firstNumber !== secondNumber) return firstNumber - secondNumber;
    return englishSizeCollator.compare(firstText, secondText);
  }

  return chineseStrokeCollator.compare(firstText, secondText);
};
