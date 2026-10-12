export const getActiveFittingOrder = (selectedOrder, pendingOrders, requestedOrderId = "", selectedOrderId = "") => {
  if (selectedOrder) return selectedOrder.status === "PENDING" ? selectedOrder : null;
  if (requestedOrderId && !selectedOrderId) return null;
  return pendingOrders[0] || null;
};
