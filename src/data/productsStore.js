import { getProductGender } from "./productGender.js";

const normalizeSize = (size = {}) => {
  const normalized = { ...size };
  if (normalized.size === undefined || normalized.size === null) normalized.size = "";
  if (normalized.length === undefined || normalized.length === null) normalized.length = "";
  if (normalized.price === undefined) normalized.price = null;
  normalized.isTailored = Boolean(
    normalized.isTailored
    || String(normalized.size || "").trim() === "裁碼"
    || /^裁碼(?:\s|$)/.test(String(normalized.length || "").trim()),
  );
  return normalized;
};
const sizeIdentityKey = (size = {}) => `${size.isTailored ? "tailored" : "regular"}\u0000${size.length || ""}\u0000${size.size || ""}`;
const productDataSignature = (product) => JSON.stringify([
  product.school || "",
  product.name,
  product.gender,
  product.priceMode,
  product.sizes.map((size) => [size.size, size.length, size.price, Boolean(size.isTailored)]),
]);
const assertNoConflictingSizePrices = (products = []) => {
  products.forEach((product) => {
    const pricesByKey = new Map();
    (product.sizes || []).forEach((size) => {
      const key = sizeIdentityKey(size);
      const price = size.price === null || size.price === undefined ? null : Number(size.price);
      if (!pricesByKey.has(key)) {
        pricesByKey.set(key, price);
        return;
      }
      const previousPrice = pricesByKey.get(key);
      if (previousPrice !== null && price !== null && previousPrice !== price) {
        throw new Error(`拒絕保存「${product.name}」：${size.isTailored ? "裁碼" : "普通"}尺碼 ${size.size || size.length} 存在互相衝突的價格。請先修正資料，避免裁碼價格覆蓋普通尺碼。`);
      }
    });
  });
};

export const normalizeProducts = (products = []) => {
  if (!Array.isArray(products)) return [];

  return products.map((product) => {
    const storedMode = product.priceMode || product.sizes?.find((size) => ["simple", "matrix", "fixed"].includes(size?.__priceMode))?.__priceMode;
    const sizes = Array.isArray(product.sizes) ? product.sizes.map(({ __priceMode, ...size }) => {
      const legacyTailored = typeof size.length === "string" && size.length.trim().match(/^裁碼\s*(.+)$/);
      return normalizeSize({
        ...size,
        length: legacyTailored ? legacyTailored[1].trim() : size.length,
        isTailored: Boolean(size.isTailored || legacyTailored),
      });
    }) : [];
    const hasLengthOptions = sizes.some((size) => size.length);
    const normalized = {
      ...product,
      id: String(product.id || `product-${Math.random().toString(36).slice(2, 10)}`),
      school: String(product.school || "").trim(),
      name: String(product.name || "").trim(),
      gender: getProductGender(product),
      priceMode: hasLengthOptions
        ? "matrix"
        : (["simple", "matrix", "fixed"].includes(storedMode) ? storedMode : "simple"),
      sizes,
    };

    return normalized;
  });
};

const warnSingleSourceFallback = () => {
  console.warn("[productsStore] Single-source product mode active: only the authoritative product store is allowed. Legacy catalog data is ignored, and fallback is only for empty state recovery.");
};

const isDemoFallbackProductSet = (products = []) => {
  if (!Array.isArray(products) || products.length === 0) return false;
  return products.every((product) => {
    const name = String(product?.name || "");
    const school = String(product?.school || "");
    return school === "示範學校（可刪除）" || /白色恤衫|藏青色短褲|校裙|PE運動套裝/.test(name);
  });
};

const isKnownAuthoritativeProductSet = (products = []) => {
  if (!Array.isArray(products) || products.length === 0) return false;
  const authorities = [
    "香港中國婦女會馮堯敬紀念中學",
    "中華基督教會何福堂書院",
    "元朗商會中學",
  ];
  const schools = new Set(products.map((product) => String(product?.school || "")).filter(Boolean));
  return [...schools].some((school) => authorities.includes(school));
};

export const loadProducts = async ({ storage, supabase, isSupabaseAuthEnabled, fallbackProducts = [] }) => {
  let authoritativeStoreWasEmpty = false;
  try {
    if (isSupabaseAuthEnabled && supabase) {
      const { data, error } = await supabase
        .from("products")
        .select("id, school, name, gender, sizes, display_order, branch_id")
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("name");

      if (!error && Array.isArray(data) && data.length > 0) {
        return normalizeProducts(data);
      }

      if (!error && Array.isArray(data) && data.length === 0) {
        authoritativeStoreWasEmpty = true;
        console.warn("[productsStore] Supabase products query returned no rows; preserving the current catalog.");
      }

      if (error) {
        console.warn("Supabase products read failed; falling back to local data", error);
      }
    }

    if (storage) {
      const saved = await storage.get("products", true).catch(() => null);
      if (saved && saved.value) {
        try {
          const parsed = JSON.parse(saved.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return normalizeProducts(parsed);
          }
        } catch (error) {
          console.warn("local products payload was invalid; falling back to defaults", error);
        }
      }
    }
  } catch (error) {
    console.warn("loadProducts failed; using fallback", error);
  }

  const fallback = normalizeProducts(fallbackProducts);
  if (authoritativeStoreWasEmpty && isKnownAuthoritativeProductSet(fallback)) {
    console.warn("[productsStore] Using the bundled authoritative catalog while Supabase has no product rows.");
    return fallback;
  }

  if (isDemoFallbackProductSet(fallbackProducts)) {
    warnSingleSourceFallback();
    return null;
  }
  if (fallbackProducts.length > 0 && !isKnownAuthoritativeProductSet(fallbackProducts)) {
    warnSingleSourceFallback();
    return null;
  }
  warnSingleSourceFallback();
  return fallback.length > 0 ? fallback : null;
};

export const saveProducts = async ({ products, storage, supabase, isSupabaseAuthEnabled }) => {
  const normalized = normalizeProducts(products);
  if (normalized.length === 0) {
    throw new Error("拒絕保存空商品清單，避免刪除整個商品庫。請先載入或匯入商品資料。");
  }
  console.info("[productsStore] Saving authoritative product list to the configured single source.");

  if (isSupabaseAuthEnabled && supabase) {
    const uniqueProducts = normalized.reduce((result, product) => {
      const duplicate = result.find((item) => item.id === product.id);
      if (!duplicate) {
        result.push(product);
        return result;
      }

      const sizes = [...(duplicate.sizes || [])];
      (product.sizes || []).forEach((size) => {
        const exists = sizes.some((item) => sizeIdentityKey(item) === sizeIdentityKey(size));
        if (!exists) sizes.push(size);
      });
      duplicate.sizes = sizes;
      return result;
    }, []);

    const { data: existing, error: existingError } = await supabase.from("products").select("id, school, name, gender, sizes");
    if (existingError) throw existingError;
    const existingById = new Map(normalizeProducts(existing || []).map((product) => [product.id, product]));
    const changedProducts = uniqueProducts.filter((product) => {
      const saved = existingById.get(product.id);
      return !saved || productDataSignature(saved) !== productDataSignature(product);
    });
    assertNoConflictingSizePrices(changedProducts);

    const nextIds = new Set(uniqueProducts.map((product) => product.id));
    const deletedIds = (existing || []).map((product) => product.id).filter((id) => !nextIds.has(id));

    const batchSize = 50;
    const savedProducts = [];
    for (let index = 0; index < uniqueProducts.length; index += batchSize) {
      const batch = uniqueProducts.slice(index, index + batchSize);
      const { error } = await supabase.from("products").upsert(batch.map(({ id, school, name, gender, sizes, priceMode, branch_id: branchId }, batchIndex) => ({
        id,
        school: school || "",
        name,
        gender,
        sizes: sizes.map((size) => ({ ...size, __priceMode: priceMode })),
        display_order: index + batchIndex,
        branch_id: branchId || null,
      })));
      if (error) throw error;

      const { data, error: verifyError } = await supabase
        .from("products")
        .select("id, school, name, gender, sizes")
        .in("id", batch.map((product) => product.id));
      if (verifyError) throw verifyError;
      savedProducts.push(...(data || []));
    }

    for (let index = 0; index < deletedIds.length; index += batchSize) {
      const batch = deletedIds.slice(index, index + batchSize);
      const { error: deleteError } = await supabase.from("products").delete().in("id", batch);
      if (deleteError) throw deleteError;

      const { data: remainingDeletedProducts, error: deleteVerifyError } = await supabase
        .from("products")
        .select("id")
        .in("id", batch);
      if (deleteVerifyError) throw deleteVerifyError;
      if ((remainingDeletedProducts || []).length > 0) {
        throw new Error(`雲端仍保留已刪除商品，修改未被完整保存（${remainingDeletedProducts.length} 款）。`);
      }
    }
    const savedById = new Map((savedProducts || []).map((product) => [product.id, product]));
    const hasMismatch = uniqueProducts.some((expected) => {
      const saved = savedById.get(expected.id);
      if (!saved || saved.school !== (expected.school || "") || saved.name !== expected.name || saved.gender !== expected.gender) return true;
      const expectedSizes = new Map((expected.sizes || []).map((size) => [sizeIdentityKey(size), size.price]));
      const savedSizes = new Map((saved.sizes || []).map((size) => [sizeIdentityKey(size), size.price]));
      if (expectedSizes.size !== savedSizes.size) return true;
      return [...expectedSizes].some(([key, price]) => Number(savedSizes.get(key)) !== Number(price));
    });
    if (hasMismatch) throw new Error("雲端商品資料驗證不一致，修改未被完整保存。");
  }

  if (!(isSupabaseAuthEnabled && supabase)) assertNoConflictingSizePrices(normalized);

  if (storage) {
    await storage.set("products", JSON.stringify(normalized), true).catch(() => {});
  }

  return normalized;
};

export const deleteProductsByIds = async ({ productIds, supabase, isSupabaseAuthEnabled }) => {
  const ids = [...new Set((productIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (ids.length === 0) return 0;
  if (!isSupabaseAuthEnabled || !supabase) {
    throw new Error("未能連接雲端商品庫，請重新登入後再清除。");
  }

  const batchSize = 10;
  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize);
    const { error } = await supabase.from("products").delete().in("id", batch);
    if (error) {
      const details = [error.message, error.details, error.hint, error.code].filter(Boolean).join("：");
      throw new Error(`刪除商品失敗（${batch.length} 款）：${details || "雲端資料庫拒絕請求。"}`);
    }

    const { data: remaining, error: verifyError } = await supabase
      .from("products")
      .select("id")
      .in("id", batch);
    if (verifyError) {
      const details = [verifyError.message, verifyError.details, verifyError.hint, verifyError.code].filter(Boolean).join("：");
      throw new Error(`確認商品刪除失敗：${details || "無法確認雲端資料。"}`);
    }
    if ((remaining || []).length > 0) {
      throw new Error(`雲端仍保留 ${remaining.length} 款商品（${remaining.map((product) => product.id).join(", ")}）。請確認商品刪除權限已啟用。`);
    }
  }

  return ids.length;
};

export const insertProduct = async ({ products, productId, storage, supabase, isSupabaseAuthEnabled }) => {
  const normalized = normalizeProducts(products);
  const matches = normalized.filter((product) => product.id === productId);
  if (matches.length !== 1) throw new Error("新增商品資料不完整，未能保存。");
  const product = matches[0];
  assertNoConflictingSizePrices([product]);

  if (isSupabaseAuthEnabled && supabase) {
    const { data, error } = await supabase.from("products").insert({
      id: product.id,
      school: product.school || "",
      name: product.name,
      gender: product.gender,
      sizes: product.sizes.map((size) => ({ ...size, __priceMode: product.priceMode })),
      display_order: normalized.findIndex((item) => item.id === product.id),
      branch_id: product.branch_id || null,
    }).select("id").single();
    if (error) throw error;
    if (data?.id !== product.id) throw new Error("新增商品未能在雲端確認保存。");
  }

  if (storage) {
    await storage.set("products", JSON.stringify(normalized), true).catch(() => {});
  }
  return normalized;
};

export const updateProduct = async ({ products, productId, storage, supabase, isSupabaseAuthEnabled }) => {
  const normalized = normalizeProducts(products);
  const matches = normalized.filter((product) => product.id === productId);
  if (matches.length !== 1) throw new Error("更新商品資料不完整，未能保存。");
  const product = matches[0];
  assertNoConflictingSizePrices([product]);

  if (isSupabaseAuthEnabled && supabase) {
    const { data, error } = await supabase.from("products").update({
      school: product.school || "",
      name: product.name,
      gender: product.gender,
      sizes: product.sizes.map((size) => ({ ...size, __priceMode: product.priceMode })),
      branch_id: product.branch_id || null,
    }).eq("id", product.id).select("id").single();
    if (error) throw error;
    if (data?.id !== product.id) throw new Error("更新商品未能在雲端確認保存。");
  }

  if (storage) {
    await storage.set("products", JSON.stringify(normalized), true).catch(() => {});
  }
  return normalized;
};
