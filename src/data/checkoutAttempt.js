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
  exchangeSourceReceiptId: order.exchangeSourceReceiptId || "",
  ...(order.adjustmentReason ? { adjustmentReason: order.adjustmentReason } : {}),
  ...(order.paymentMethod && order.paymentMethod !== "cash" ? { paymentMethod: order.paymentMethod } : {}),
  ...(order.refundMethod && order.refundMethod !== "cash" ? { refundMethod: order.refundMethod } : {}),
  ...(order.duplicateConfirmed ? {
    duplicateConfirmed: true,
    duplicateSourceReceiptId: order.duplicateSourceReceiptId || "",
  } : {}),
});

export const getOrCreateCheckoutAttempt = (storage, order, createId = createCheckoutKey) => {
  const storageKey = checkoutStorageKey(order.cashierId);
  const fingerprint = checkoutFingerprint(order);
  const stored = storage.getItem(storageKey);

  if (stored) {
    let pending;
    try {
      pending = JSON.parse(stored);
    } catch {
      throw new Error("上次結帳狀態無法讀取；為避免重覆落單，請聯絡管理員處理後再結帳。");
    }
    if (!pending || typeof pending.checkoutKey !== "string" || typeof pending.fingerprint !== "string") {
      throw new Error("上次結帳狀態不完整；為避免重覆落單，請聯絡管理員處理後再結帳。");
    }
    if (pending.fingerprint !== fingerprint) {
      throw new Error("上次結帳結果尚未確認。請恢復相同商品及金額後重試，避免產生重覆單。");
    }
    return pending.checkoutKey;
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
