export const getDraftExchangeReturnQuantity = (cart = [], sourceItemId, sourceReceiptId) => {
  if (sourceItemId == null || sourceItemId === "") return 0;
  return cart
    .filter((item) => item.exchangeReturn
      && !item.untrackedExchange
      && String(item.sourceOrderItemId || "") === String(sourceItemId)
      && String(item.exchangeSourceReceiptId || "") === String(sourceReceiptId || ""))
    .reduce((total, item) => total + Math.max(0, Number(item.qty || 0)), 0);
};

export const appendExchangeDraft = (cart, newReturnItems, replacementQueue) => ({
  cart: [...cart, ...newReturnItems],
  replacementQueue: [...replacementQueue, ...newReturnItems.map((item) => item.productId)],
});
