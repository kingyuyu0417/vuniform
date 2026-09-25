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
        .select("id, school, name, sizes, display_order, branch_id")
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

    const { data: existing, error: existingError } = await supabase.from("products").select("id");
    if (existingError) throw existingError;

    const nextIds = new Set(uniqueProducts.map((product) => product.id));
    const deletedIds = (existing || []).map((product) => product.id).filter((id) => !nextIds.has(id));
    if (deletedIds.length > 0) {
      const { error: deleteError } = await supabase.from("products").delete().in("id", deletedIds);
      if (deleteError) throw deleteError;
    }

    const { error } = await supabase.from("products").upsert(uniqueProducts.map(({ id, school, name, sizes, priceMode, branch_id: branchId }, index) => ({
      id,
      school: school || "",
      name,
      sizes: sizes.map((size) => ({ ...size, __priceMode: priceMode })),
      display_order: index,
      branch_id: branchId || null,
    })));

    if (error) throw error;

    const { data: savedProducts, error: verifyError } = await supabase
      .from("products")
      .select("id, school, name, sizes")
      .in("id", uniqueProducts.map((product) => product.id));
    if (verifyError) throw verifyError;
    const { data: remainingDeletedProducts, error: deleteVerifyError } = deletedIds.length > 0
      ? await supabase.from("products").select("id").in("id", deletedIds)
      : { data: [], error: null };
    if (deleteVerifyError) throw deleteVerifyError;
    if ((remainingDeletedProducts || []).length > 0) {
      throw new Error("雲端仍保留已刪除商品，修改未被完整保存。");
    }
    const savedById = new Map((savedProducts || []).map((product) => [product.id, product]));
    const hasMismatch = uniqueProducts.some((expected) => {
      const saved = savedById.get(expected.id);
      if (!saved || saved.school !== (expected.school || "") || saved.name !== expected.name) return true;
      const expectedSizes = new Map((expected.sizes || []).map((size) => [sizeIdentityKey(size), size.price]));
      const savedSizes = new Map((saved.sizes || []).map((size) => [sizeIdentityKey(size), size.price]));
      if (expectedSizes.size !== savedSizes.size) return true;
      return [...expectedSizes].some(([key, price]) => Number(savedSizes.get(key)) !== Number(price));
    });
    if (hasMismatch) throw new Error("雲端商品資料驗證不一致，修改未被完整保存。");
  }

  if (storage) {
    await storage.set("products", JSON.stringify(normalized), true).catch(() => {});
  }

  return normalized;
};
