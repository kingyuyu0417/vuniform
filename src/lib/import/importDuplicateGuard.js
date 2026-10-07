const priceOf = (row) => Number(row.price ?? row.價錢);

const sameProduct = (first, second, isIdentityCompatible) => (
  first.key === second.key && isIdentityCompatible(first.gender, second.gender)
);

export const validateAndDeduplicateImportRows = ({
  rows,
  existingProducts,
  getProductIdentity,
  getSizeIdentity,
  isIdentityCompatible,
  getSource = (row) => row.sourceLocation || "來源未標示",
  getNotes = (row) => String(row.note || ""),
}) => {
  const acceptedRows = [];
  const errors = [];

  rows.forEach((row) => {
    const identity = getProductIdentity(row);
    const sizeIdentity = getSizeIdentity(row);
    const source = getSource(row);
    const fileDuplicate = acceptedRows.find((candidate) => (
      sameProduct(candidate.identity, identity, isIdentityCompatible)
      && candidate.sizeIdentity === sizeIdentity
    ));

    if (fileDuplicate) {
      const previousPrice = priceOf(fileDuplicate.row);
      const currentPrice = priceOf(row);
      if (previousPrice !== currentPrice) {
        errors.push(
          `${source}：「${row.name}」${row.length ? `${row.length}/` : ""}${row.size} $${currentPrice}，與檔案內 ${fileDuplicate.sources[0]} 同規格 $${previousPrice} 價格衝突。`,
        );
        return;
      }

      fileDuplicate.sources.push(source);
      if (
        getNotes(fileDuplicate.row) !== getNotes(row)
        || fileDuplicate.identity.gender !== identity.gender
      ) fileDuplicate.detailsDiffer = true;
      return;
    }

    const existingMatches = existingProducts
      .filter((product) => sameProduct(getProductIdentity(product), identity, isIdentityCompatible))
      .flatMap((product) => (product.sizes || [])
        .filter((size) => getSizeIdentity(size) === sizeIdentity)
        .map((size) => ({ product, size })));
    const currentPrice = priceOf(row);
    const conflictingExisting = existingMatches.find(({ size }) => (
      size.price !== null
      && size.price !== undefined
      && Number.isFinite(Number(size.price))
      && Number(size.price) !== currentPrice
    ));
    if (conflictingExisting) {
      errors.push(
        `${source}：「${row.name}」${row.length ? `${row.length}/` : ""}${row.size} 匯入價 $${currentPrice}，與現有商品 ID ${conflictingExisting.product.id} 的同規格價格 $${conflictingExisting.size.price} 衝突。`,
      );
      return;
    }

    acceptedRows.push({
      row: { ...row, sourceLocations: [source] },
      identity,
      sizeIdentity,
      sources: [source],
      detailsDiffer: false,
    });
  });

  return {
    rows: acceptedRows.map(({ row, sources, detailsDiffer }) => ({
      ...row,
      sourceLocations: sources,
      duplicateDetailsDiffer: detailsDiffer,
    })),
    errors,
    warnings: acceptedRows
      .filter(({ sources }) => sources.length > 1)
      .map(({ row, sources, detailsDiffer }) => (
        `同規格同價已去重：${row.name} ${row.length ? `${row.length}/` : ""}${row.size} $${priceOf(row)}；來源：${sources.join("、")}${detailsDiffer ? "；備註或商品資料不同，請核對" : ""}`
      )),
  };
};
