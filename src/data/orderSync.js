export const mergeOrderUpdates = (currentOrders = [], updatedOrders = []) => {
  const ordersById = new Map(currentOrders.map((order) => [String(order.id), order]));
  updatedOrders.forEach((order) => ordersById.set(String(order.id), order));
  return [...ordersById.values()].sort((first, second) => (
    Date.parse(second.createdAt || second.date || 0) - Date.parse(first.createdAt || first.date || 0)
  ));
};

export const getOrderDateRangeBounds = (startDate, endDate) => {
  const isValidDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
  };
  if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) return null;

  const endExclusive = new Date(Date.parse(`${endDate}T00:00:00.000Z`) + 86400000)
    .toISOString();
  return {
    startInclusive: `${startDate}T00:00:00.000Z`,
    endExclusive,
  };
};
