export const mergeOrderUpdates = (currentOrders = [], updatedOrders = []) => {
  const ordersById = new Map(currentOrders.map((order) => [String(order.id), order]));
  updatedOrders.forEach((order) => ordersById.set(String(order.id), order));
  return [...ordersById.values()].sort((first, second) => (
    Date.parse(second.createdAt || second.date || 0) - Date.parse(first.createdAt || first.date || 0)
  ));
};
