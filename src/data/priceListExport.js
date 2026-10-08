export const buildPriceListRows = (products, schoolOf) => [
  ["學校", "款式名稱", "尺碼", "長度", "價錢"],
  ...products.flatMap((product) => (product.sizes || []).map((size) => [
    schoolOf(product),
    product.name,
    size.size || "",
    size.length || "",
    Number(size.price),
  ])),
];

export const createPriceListWorkbook = (xlsx, products, schoolOf) => {
  const worksheet = xlsx.utils.aoa_to_sheet(buildPriceListRows(products, schoolOf));
  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];
  worksheet["!autofilter"] = { ref: `A1:E${Math.max(1, products.reduce((count, product) => count + (product.sizes || []).length, 0) + 1)}` };

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "價目表");
  return workbook;
};
