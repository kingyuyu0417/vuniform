const PAYMENT_METHODS = ["cash", "card", "transfer"];

const amountOf = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const orderNet = (order) => amountOf(order.total) - Math.max(0, amountOf(order.refundDue));
export const isExchangeAdjustmentOrder = (order) => Boolean(order?.exchangeSourceReceiptId || order?.untrackedExchange);
const orderTime = (order) => {
  const value = order.createdAt || (order.date && order.time ? `${order.date}T${order.time}:00` : "");
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const itemKey = (item) => [
  item.name || "",
  item.size || "",
  item.length || "",
  Number(item.price || 0),
  Number(item.qty || 1),
  Boolean(item.exchangeReturn),
  item.sourceOrderItemId || "",
].join("\u0000");

const basketKey = (items) => (Array.isArray(items) ? items : [])
  .map(itemKey)
  .sort()
  .join("\u0001");

export const findPossibleDuplicateSale = (candidate, orders, now = Date.now(), windowMs = 2 * 60 * 1000) => {
  if (!candidate?.cashierId || !Array.isArray(candidate.items) || candidate.items.length === 0) return null;
  const candidateTime = orderTime(candidate) ?? now;
  const candidateBasket = basketKey(candidate.items);

  return orders.find((order) => {
    if (order.voidedAt || order.cashierId !== candidate.cashierId) return false;
    if (orderNet(order) !== orderNet(candidate) || basketKey(order.items) !== candidateBasket) return false;
    const previousTime = orderTime(order);
    return previousTime !== null && Math.abs(candidateTime - previousTime) <= windowMs;
  }) || null;
};

export const calculateCashSettlement = (amountDue, amountTendered) => {
  const due = Math.max(0, amountOf(amountDue));
  const tendered = Math.max(0, amountOf(amountTendered));
  return {
    changeDue: Math.max(0, tendered - due),
    shortfall: Math.max(0, due - tendered),
  };
};

export const summarizeDailyCloseout = (orders, reportDate = "") => {
  const allOrders = Array.isArray(orders) ? orders : [];
  const replacementSources = new Set(allOrders
    .filter((order) => !order.voidedAt && order.replacementSourceReceiptId)
    .map((order) => order.replacementSourceReceiptId));
  const reportOrders = reportDate
    ? allOrders.filter((order) => order.date === reportDate)
    : allOrders;
  const channels = Object.fromEntries(PAYMENT_METHODS.map((method) => [method, { received: 0, refunded: 0 }]));
  let salesAmount = 0;
  let exchangeDifference = 0;
  let returnedGoodsAmount = 0;
  let untrackedReturnOrders = 0;

  reportOrders.forEach((order) => {
    if (order.voidedAt) {
      if (!replacementSources.has(order.id)) return;
      const paymentMethod = channels[order.paymentMethod] ? order.paymentMethod : "cash";
      const received = paymentMethod === "cash"
        ? amountOf(order.cashReceived ?? order.total) - amountOf(order.changeDue)
        : amountOf(order.total);
      channels[paymentMethod].received += Math.max(0, received);
      return;
    }

    const refundDue = Math.max(0, amountOf(order.refundDue));
    const amount = Math.max(0, amountOf(order.total));
    const isAdjustment = isExchangeAdjustmentOrder(order);
    if (isAdjustment) {
      exchangeDifference += orderNet(order);
      const returnItems = (Array.isArray(order.items) ? order.items : []).filter((item) => item.exchangeReturn);
      if (refundDue > 0 && returnItems.length === 0) untrackedReturnOrders += 1;
      returnedGoodsAmount += returnItems.reduce(
        (sum, item) => sum + Math.abs(amountOf(item.price)) * Math.max(0, amountOf(item.qty)),
        0,
      );
    } else {
      salesAmount += amount;
    }

    const paymentMethod = channels[order.paymentMethod] ? order.paymentMethod : "cash";
    const replacementSettlement = order.replacementSourceReceiptId
      ? amountOf(order.settlementDelta)
      : null;
    const received = replacementSettlement !== null
      ? Math.max(0, paymentMethod === "cash"
        ? amountOf(order.settlementCashReceived ?? replacementSettlement) - amountOf(order.settlementChangeDue)
        : replacementSettlement)
      : paymentMethod === "cash"
        ? Math.max(0, amountOf(order.cashReceived ?? amount) - amountOf(order.changeDue))
        : amount;
    channels[paymentMethod].received += received;

    const refundMethod = channels[order.refundMethod] ? order.refundMethod : "cash";
    channels[refundMethod].refunded += replacementSettlement !== null
      ? Math.max(0, -replacementSettlement)
      : refundDue;
  });

  return {
    salesAmount,
    returnedGoodsAmount,
    exchangeDifference,
    netRevenue: salesAmount + exchangeDifference,
    totalReceived: Object.values(channels).reduce((sum, channel) => sum + channel.received, 0),
    totalRefunded: Object.values(channels).reduce((sum, channel) => sum + channel.refunded, 0),
    untrackedReturnOrders,
    channels,
  };
};

export const PAYMENT_METHOD_LABELS = {
  cash: "現金",
  card: "信用卡",
  transfer: "轉帳",
};

export const PAYMENT_METHOD_LABELS_EN = {
  cash: "Cash",
  card: "Credit card",
  transfer: "Bank transfer",
};
