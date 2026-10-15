export const validTwoPiecePrice = (unitPrice, value) => {
  if (value === null || value === undefined || value === "") return null;
  const price = Number(unitPrice);
  const twoPiecePrice = Number(value);
  if (!Number.isInteger(price) || price <= 0
    || !Number.isInteger(twoPiecePrice) || twoPiecePrice < 0
    || twoPiecePrice >= price * 2) return null;
  return twoPiecePrice;
};

export const quantityPromotionTotal = (unitPrice, twoPiecePrice, quantity) => {
  const price = Number(unitPrice);
  const qty = Math.max(0, Math.floor(Number(quantity) || 0));
  const promotionPrice = validTwoPiecePrice(price, twoPiecePrice);
  if (promotionPrice === null) return price * qty;
  return Math.floor(qty / 2) * promotionPrice + (qty % 2) * price;
};

const promotionGroupKey = (item, promotionPrice) => [
  item.productId || item.name || "",
  Number(item.price),
  promotionPrice,
].join("\u0000");

export const calculateCartLineTotals = (items = []) => {
  const result = items.map((item) => ({
    ...item,
    discountAmount: Math.max(0, Number(item.discountAmount) || 0),
  }));
  const groups = new Map();

  result.forEach((item, index) => {
    if (item.applyPromotion === false || item.exchangeReturn || item.sourceOrderId) return;
    const twoPiecePrice = validTwoPiecePrice(item.price, item.twoPiecePrice);
    if (twoPiecePrice === null) return;
    const key = promotionGroupKey(item, twoPiecePrice);
    const group = groups.get(key) || { indexes: [], unitPrice: Number(item.price), twoPiecePrice };
    group.indexes.push(index);
    groups.set(key, group);
    result[index].discountAmount = 0;
  });

  groups.forEach(({ indexes, unitPrice, twoPiecePrice }) => {
    const discountPerPair = unitPrice * 2 - twoPiecePrice;
    let unitIndex = 0;
    indexes.forEach((index) => {
      const quantity = Math.max(0, Math.floor(Number(result[index].qty) || 0));
      let lineDiscount = 0;
      for (let itemIndex = 0; itemIndex < quantity; itemIndex += 1) {
        if (unitIndex % 2 === 1) lineDiscount += discountPerPair;
        unitIndex += 1;
      }
      result[index].discountAmount = lineDiscount;
    });
  });

  return result.map((item) => ({
    ...item,
    lineTotal: (Number(item.price) * Number(item.qty || 0) - item.discountAmount)
      * (item.exchangeReturn ? -1 : 1),
  }));
};

const returnPromotionGroupKey = (item, twoPiecePrice) => [
  item.name || "",
  Number(item.price),
  twoPiecePrice,
].join("\u0000");

export const calculateReturnDiscounts = (sourceItems = [], selectedItems = [], previousReturns = []) => {
  const discounts = selectedItems.map(() => 0);
  const returnGroups = new Map();

  selectedItems.forEach((selectedItem, selectedIndex) => {
    const sourceItem = sourceItems.find((item) => String(item.id || "") === String(selectedItem.id || ""));
    if (!sourceItem || sourceItem.exchangeReturn) return;
    const twoPiecePrice = validTwoPiecePrice(sourceItem.price, sourceItem.twoPiecePrice);
    if (twoPiecePrice === null) return;
    const key = returnPromotionGroupKey(sourceItem, twoPiecePrice);
    const group = returnGroups.get(key) || { selected: [], price: Number(sourceItem.price), twoPiecePrice };
    group.selected.push({ selectedItem, selectedIndex });
    returnGroups.set(key, group);
  });

  returnGroups.forEach(({ selected, price, twoPiecePrice }) => {
    const groupName = String(selected[0]?.selectedItem?.name || "");
    const fullSourceGroup = sourceItems.filter((item) => !item.exchangeReturn
      && String(item.name || "") === groupName
      && Number(item.price) === price
      && validTwoPiecePrice(item.price, item.twoPiecePrice) === twoPiecePrice);
    const sourceIds = new Set(fullSourceGroup.map((item) => String(item.id || "")));
    const originalQuantity = fullSourceGroup.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0);
    const originalTotal = fullSourceGroup.reduce((sum, item) => sum
      + Number(item.price) * Math.max(0, Number(item.qty) || 0)
      - Math.max(0, Number(item.discountAmount) || 0), 0);
    const returnedQuantity = selected.reduce((sum, { selectedItem }) => sum + Math.max(0, Number(selectedItem.qty) || 0), 0);
    const previousGroupReturns = previousReturns.filter((item) => item.exchangeReturn
      && sourceIds.has(String(item.sourceOrderItemId || "")));
    const previousReturnedQuantity = previousGroupReturns.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0);
    const previousRefundTotal = previousGroupReturns.reduce((sum, item) => sum
      + Number(item.price || price) * Math.max(0, Number(item.qty) || 0)
      - Math.max(0, Number(item.discountAmount) || 0), 0);
    const remainingTotal = quantityPromotionTotal(
      price,
      twoPiecePrice,
      Math.max(0, originalQuantity - previousReturnedQuantity - returnedQuantity),
    );
    const refundTotal = Math.max(0, originalTotal - previousRefundTotal - remainingTotal);
    let discountToAllocate = Math.max(0, selected.reduce((sum, { selectedItem }) => sum
      + price * Math.max(0, Number(selectedItem.qty) || 0), 0) - refundTotal);

    selected.forEach(({ selectedItem, selectedIndex }) => {
      const lineBase = price * Math.max(0, Number(selectedItem.qty) || 0);
      const lineDiscount = Math.min(lineBase, discountToAllocate);
      discounts[selectedIndex] = lineDiscount;
      discountToAllocate -= lineDiscount;
    });
  });

  return discounts;
};
