export const hasUntrackedExchangeHistory = (sourceOrder, orders) => orders.some((order) =>
  !order.voidedAt
  && order.exchangeSourceReceiptId === sourceOrder?.id
  && !order.items?.some((item) => item.exchangeReturn),
);

export const getRemainingReturnQuantity = (sourceItem, orders) => {
  if (!sourceItem?.id || sourceItem.exchangeReturn) return 0;
  const sourceItemId = String(sourceItem.id);
  const sourceOrder = orders.find((order) => (order.items || [])
    .some((item) => String(item.id || "") === sourceItemId));
  if (sourceOrder && hasUntrackedExchangeHistory(sourceOrder, orders)) return 0;
  const alreadyReturned = orders
    .filter((order) => !order.voidedAt)
    .flatMap((order) => Array.isArray(order.items) ? order.items : [])
    .filter((item) => item.exchangeReturn && String(item.sourceOrderItemId || "") === sourceItemId)
    .reduce((total, item) => total + Math.max(0, Number(item.qty || 0)), 0);

  return Math.max(0, Number(sourceItem.qty || 0) - alreadyReturned);
};
