export const getReplacementSettlement = (originalTotal, replacementTotal) => {
  const original = Number(originalTotal);
  const replacement = Number(replacementTotal);
  if (!Number.isFinite(original) || !Number.isFinite(replacement) || original < 0 || replacement < 0) {
    throw new Error("Replacement totals must be non-negative numbers");
  }

  const difference = replacement - original;
  return {
    difference,
    collectDue: Math.max(0, difference),
    refundDue: Math.max(0, -difference),
  };
};

export const getReplacementBranchId = (order, fallbackBranchId = "") => (
  String(order?.branchId ?? order?.branch_id ?? fallbackBranchId ?? "")
);

export const canReplaceOrder = (order, orders) => Boolean(
  order?.id
  && !order.voidedAt
  && !order.exchangeSourceReceiptId
  && !order.replacementSourceReceiptId
  && !orders.some((candidate) => (
    !candidate.voidedAt
    && (
      candidate.exchangeSourceReceiptId === order.id
      || candidate.replacementSourceReceiptId === order.id
    )
  )),
);
