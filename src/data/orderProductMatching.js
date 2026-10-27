export const findProductForOrderItem = (products = [], order = {}, item = {}) => {
  const school = String(order.school || order.school_id || order.schoolId || "").trim();
  const branchId = String(order.branchId || order.branch_id || "").trim();
  const productId = String(item.productId || item.product_id || "").trim();
  const name = String(item.name || item.productName || item.product_name || "").trim();
  const schoolProducts = school
    ? products.filter((product) => String(product.school || "").trim() === school)
    : products;
  const branchProducts = branchId
    ? schoolProducts.filter((product) => String(product.branch_id || product.branchId || "").trim() === branchId)
    : [];
  const candidateGroups = branchProducts.length ? [branchProducts, schoolProducts] : [schoolProducts];

  for (const candidates of candidateGroups) {
    const product = candidates.find((candidate) => String(candidate.id || "") === productId);
    if (product) return product;
  }

  for (const candidates of candidateGroups) {
    const matchingProducts = candidates.filter((candidate) => String(candidate.name || "").trim() === name);
    if (matchingProducts.length === 1) return matchingProducts[0];
    if (school && matchingProducts.length > 1) return matchingProducts[0];
  }

  return null;
};
