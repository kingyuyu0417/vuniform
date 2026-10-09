const checkoutStorageKey = (cashierId) => `uniform-pos-pending-checkout:${cashierId || "local"}`;

const createCheckoutKey = () => {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("此瀏覽器不支援安全交易識別碼，請更新瀏覽器後再結帳。");
  }
  return globalThis.crypto.randomUUID();
};

const checkoutFingerprint = (order) => JSON.stringify({
  cashierId: order.cashierId || "",
  branchId: order.branchId || "",
  school: order.school || "",
  customerName: order.customerName || "",
  customerPhoneLast4: String(order.customerPhone || "").replace(/\D/g, "").slice(-4),
  items: (order.items || []).map((item) => ({
    name: item.name || "",
    size: item.size || "",
    length: item.length || "",
    isTailored: Boolean(item.isTailored),
    price: Number(item.price || 0),
    qty: Number(item.qty || 1),
    exchangeReturn: Boolean(item.exchangeReturn),
    exchangeSourceReceiptId: item.exchangeSourceReceiptId || "",
    sourceOrderItemId: item.sourceOrderItemId || "",
  })),
  total: Number(order.total || 0),
  cashReceived: Number(order.cashReceived || 0),
  changeDue: Number(order.changeDue || 0),
  refundDue: Number(order.refundDue || 0),
  ...(order.untrackedExchange ? { untrackedExchange: true } : {}),
  exchangeSourceReceiptId: order.exchangeSourceReceiptId || "",
  replacementSourceReceiptId: order.replacementSourceReceiptId || "",
  replacementReason: order.replacementReason || "",
  settlementDelta: Number(order.settlementDelta || 0),
  ...(order.adjustmentReason ? { adjustmentReason: order.adjustmentReason } : {}),
  ...(order.paymentMethod && order.paymentMethod !== "cash" ? { paymentMethod: order.paymentMethod } : {}),
  ...(order.refundMethod && order.refundMethod !== "cash" ? { refundMethod: order.refundMethod } : {}),
  ...(order.duplicateConfirmed ? {
    duplicateConfirmed: true,
    duplicateSourceReceiptId: order.duplicateSourceReceiptId || "",
  } : {}),
});

const isReplacementBranchOnlyRetry = (previousFingerprint, nextFingerprint) => {
  let previous;
  let next;
  try {
    previous = JSON.parse(previousFingerprint);
    next = JSON.parse(nextFingerprint);
  } catch {
    return false;
  }
  if (!previous?.replacementSourceReceiptId
    || previous.replacementSourceReceiptId !== next?.replacementSourceReceiptId) return false;
  delete previous.branchId;
  delete next.branchId;
  return JSON.stringify(previous) === JSON.stringify(next);
};

export const getOrCreateCheckoutAttempt = (storage, order, createId = createCheckoutKey) => {
  const storageKey = checkoutStorageKey(order.cashierId);
  const fingerprint = checkoutFingerprint(order);
  const stored = storage.getItem(storageKey);

  if (stored) {
    let pending = null;
    try {
      pending = JSON.parse(stored);
    } catch {
      pending = null;
    }
    if (pending
      && typeof pending.checkoutKey === "string"
      && pending.checkoutKey
      && pending.fingerprint === fingerprint) {
      return pending.checkoutKey;
    }
    if (pending
      && typeof pending.checkoutKey === "string"
      && pending.checkoutKey
      && typeof pending.fingerprint === "string"
      && (pending.fingerprint === fingerprint
        || isReplacementBranchOnlyRetry(pending.fingerprint, fingerprint))) {
      return pending.checkoutKey;
    }
  }

  const checkoutKey = createId();
  if (!checkoutKey) throw new Error("無法建立交易識別碼，請重新載入系統後再試。");
  storage.setItem(storageKey, JSON.stringify({ checkoutKey, fingerprint }));
  return checkoutKey;
};

export const clearCheckoutAttempt = (storage, cashierId, checkoutKey) => {
  const storageKey = checkoutStorageKey(cashierId);
  const stored = storage.getItem(storageKey);
  if (!stored) return;
  const pending = JSON.parse(stored);
  if (pending?.checkoutKey === checkoutKey) storage.removeItem(storageKey);
};
