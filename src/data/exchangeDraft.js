export const getDraftExchangeReturnQuantity = (cart = [], sourceItemId, sourceReceiptId) => {
  if (sourceItemId == null || sourceItemId === "") return 0;
  return cart
    .filter((item) => item.exchangeReturn
      && !item.untrackedExchange
      && String(item.sourceOrderItemId || "") === String(sourceItemId)
      && String(item.exchangeSourceReceiptId || "") === String(sourceReceiptId || ""))
    .reduce((total, item) => total + Math.max(0, Number(item.qty || 0)), 0);
};

export const buildExchangeReplacementQueue = (returnItems = []) => returnItems.flatMap((item) => {
  const quantity = Number(item.qty);
  const replacementCount = Number.isInteger(quantity) && quantity > 0
    ? Math.min(quantity, 99)
    : 1;
  return Array.from({ length: replacementCount }, () => item.productId);
});

export const appendExchangeDraft = (cart, newReturnItems, replacementQueue) => ({
  cart: [...cart, ...newReturnItems],
  replacementQueue: [...replacementQueue, ...buildExchangeReplacementQueue(newReturnItems)],
});
