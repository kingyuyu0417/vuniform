export const validTwoPiecePrice = (unitPrice, value) => {
  if (value === null || value === undefined || value === "") return null;
  const price = Number(unitPrice);
  const promotionPrice = Number(value);
  if (!Number.isInteger(price) || price <= 0
    || !Number.isInteger(promotionPrice) || promotionPrice < 0
    || promotionPrice >= price * 2) return null;
  return promotionPrice;
};

export const validThreePiecePrice = (unitPrice, value) => {
  if (value === null || value === undefined || value === "") return null;
  const price = Number(unitPrice);
  const promotionPrice = Number(value);
  if (!Number.isInteger(price) || price <= 0
    || !Number.isInteger(promotionPrice) || promotionPrice < 0
    || promotionPrice >= price * 3) return null;
  return promotionPrice;
};

const promotionComposition = (unitPrice, twoPiecePrice, threePiecePrice, quantity) => {
  const price = Number(unitPrice);
  const qty = Math.max(0, Math.floor(Number(quantity) || 0));
  const pairPrice = validTwoPiecePrice(price, twoPiecePrice);
  const triplePrice = validThreePiecePrice(price, threePiecePrice);
  const maxTriples = triplePrice === null ? 0 : Math.floor(qty / 3);
  const maxEvenTriples = maxTriples - (maxTriples % 2);
  const maxOddTriples = maxTriples - (maxTriples % 2 === 1 ? 0 : 1);
  const candidates = [...new Set([0, 1, maxEvenTriples, maxOddTriples])]
    .filter((triples) => triples >= 0 && triples <= maxTriples)
    .sort((left, right) => left - right);
  let best = null;

  candidates.forEach((triples) => {
    const remaining = qty - triples * 3;
    const pairs = pairPrice === null ? 0 : Math.floor(remaining / 2);
    const singles = remaining - pairs * 2;
    const total = triples * (triplePrice ?? price * 3)
      + pairs * (pairPrice ?? price * 2)
      + singles * price;
    if (!best || total < best.total) best = { triples, pairs, singles, total };
  });

  return best || { triples: 0, pairs: 0, singles: qty, total: price * qty };
};

export const quantityPromotionTotal = (unitPrice, twoPiecePrice, threePiecePrice, quantity) => (
  promotionComposition(unitPrice, twoPiecePrice, threePiecePrice, quantity).total
);

const promotionGroupKey = (item, twoPiecePrice, threePiecePrice) => [
  item.productId || item.name || "",
  Number(item.price),
  twoPiecePrice,
  threePiecePrice,
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
    const threePiecePrice = validThreePiecePrice(item.price, item.threePiecePrice);
    if (twoPiecePrice === null && threePiecePrice === null) return;
    const key = promotionGroupKey(item, twoPiecePrice, threePiecePrice);
    const group = groups.get(key) || {
      indexes: [],
      unitPrice: Number(item.price),
      twoPiecePrice,
      threePiecePrice,
    };
    group.indexes.push(index);
    groups.set(key, group);
    result[index].discountAmount = 0;
  });

  groups.forEach(({ indexes, unitPrice, twoPiecePrice, threePiecePrice }) => {
    const quantity = indexes.reduce((sum, index) => (
      sum + Math.max(0, Math.floor(Number(result[index].qty) || 0))
    ), 0);
    const composition = promotionComposition(unitPrice, twoPiecePrice, threePiecePrice, quantity);
    const unitDiscounts = Array(quantity).fill(0);
    let unitIndex = 0;

    for (let bundle = 0; bundle < composition.triples; bundle += 1) {
      unitDiscounts[unitIndex + 2] += unitPrice * 3 - threePiecePrice;
      unitIndex += 3;
    }
    for (let bundle = 0; bundle < composition.pairs; bundle += 1) {
      unitDiscounts[unitIndex + 1] += unitPrice * 2 - twoPiecePrice;
      unitIndex += 2;
    }

    unitIndex = 0;
    indexes.forEach((index) => {
      const lineQuantity = Math.max(0, Math.floor(Number(result[index].qty) || 0));
      let lineDiscount = 0;
      for (let itemIndex = 0; itemIndex < lineQuantity; itemIndex += 1) {
        lineDiscount += unitDiscounts[unitIndex] || 0;
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

const returnPromotionGroupKey = (item, twoPiecePrice, threePiecePrice) => [
  item.name || "",
  Number(item.price),
  twoPiecePrice,
  threePiecePrice,
].join("\u0000");

export const calculateReturnDiscounts = (sourceItems = [], selectedItems = [], previousReturns = []) => {
  const discounts = selectedItems.map(() => 0);
  const returnGroups = new Map();

  selectedItems.forEach((selectedItem, selectedIndex) => {
    const sourceItem = sourceItems.find((item) => String(item.id || "") === String(selectedItem.id || ""));
    if (!sourceItem || sourceItem.exchangeReturn) return;
    const twoPiecePrice = validTwoPiecePrice(sourceItem.price, sourceItem.twoPiecePrice);
    const threePiecePrice = validThreePiecePrice(sourceItem.price, sourceItem.threePiecePrice);
    if (twoPiecePrice === null && threePiecePrice === null) return;
    const key = returnPromotionGroupKey(sourceItem, twoPiecePrice, threePiecePrice);
    const group = returnGroups.get(key) || {
      selected: [],
      price: Number(sourceItem.price),
      twoPiecePrice,
      threePiecePrice,
    };
    group.selected.push({ selectedItem, selectedIndex });
    returnGroups.set(key, group);
  });

  returnGroups.forEach(({ selected, price, twoPiecePrice, threePiecePrice }) => {
    const groupName = String(selected[0]?.selectedItem?.name || "");
    const fullSourceGroup = sourceItems.filter((item) => !item.exchangeReturn
      && String(item.name || "") === groupName
      && Number(item.price) === price
      && validTwoPiecePrice(item.price, item.twoPiecePrice) === twoPiecePrice
      && validThreePiecePrice(item.price, item.threePiecePrice) === threePiecePrice);
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
      threePiecePrice,
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
