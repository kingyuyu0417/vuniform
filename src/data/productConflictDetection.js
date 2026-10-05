export const findConflictingProductIds = (
  products,
  { getProductIdentity, getSizeIdentity, isIdentityCompatible },
) => {
  const conflictingIds = new Set();
  const productsByIdentity = new Map();

  (Array.isArray(products) ? products : []).forEach((product) => {
    const pricesBySize = new Map();
    (product.sizes || []).forEach((size) => {
      const key = getSizeIdentity(size);
      const price = Number(size.price);
      if (!pricesBySize.has(key)) pricesBySize.set(key, new Set());
      if (Number.isFinite(price)) pricesBySize.get(key).add(price);
    });
    if ([...pricesBySize.values()].some((prices) => prices.size > 1)) {
      conflictingIds.add(product.id);
    }

    const identity = getProductIdentity(product);
    const duplicates = productsByIdentity.get(identity.key) || [];
    const productPrices = new Map((product.sizes || []).map((size) => [getSizeIdentity(size), Number(size.price)]));
    duplicates.forEach((duplicate) => {
      if (!isIdentityCompatible(duplicate.identity, identity)) return;
      const hasConflictingPrice = (product.sizes || []).some((size) => {
        const key = getSizeIdentity(size);
        const price = Number(size.price);
        const previousPrice = duplicate.prices.get(key);
        return Number.isFinite(previousPrice) && Number.isFinite(price) && previousPrice !== price;
      });
      if (hasConflictingPrice) {
        conflictingIds.add(duplicate.product.id);
        conflictingIds.add(product.id);
      }
    });
    duplicates.push({ product, identity, prices: productPrices });
    productsByIdentity.set(identity.key, duplicates);
  });

  return conflictingIds;
};
