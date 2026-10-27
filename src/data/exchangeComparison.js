const exchangeProductKey = (item) => String(item.productId || item.name || "")
  .trim()
  .toLocaleLowerCase();

export const buildExchangeComparisonRows = (returnedItems = [], replacementItems = []) => {
  const rows = new Map();

  returnedItems.forEach((item) => {
    const key = exchangeProductKey(item);
    const row = rows.get(key) || { key, returnedItems: [], replacementItems: [] };
    row.returnedItems.push(item);
    rows.set(key, row);
  });

  replacementItems.forEach((item) => {
    const key = exchangeProductKey(item);
    const row = rows.get(key) || { key, returnedItems: [], replacementItems: [] };
    row.replacementItems.push(item);
    rows.set(key, row);
  });

  return [...rows.values()];
};
