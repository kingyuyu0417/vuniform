const normalizeSize = (size = {}) => {
  const normalized = { ...size };
  if (normalized.size === undefined || normalized.size === null) normalized.size = "";
  if (normalized.length === undefined || normalized.length === null) normalized.length = "";
  if (normalized.price === undefined || normalized.price === null) normalized.price = 0;
  return normalized;
};

export const normalizeProducts = (products = []) => {
  if (!Array.isArray(products)) return [];

  return products.map((product) => {
    const normalized = {
      ...product,
      id: String(product.id || `product-${Math.random().toString(36).slice(2, 10)}`),
      school: String(product.school || "").trim(),
      name: String(product.name || "").trim(),
      sizes: Array.isArray(product.sizes) ? product.sizes.map(normalizeSize) : [],
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
  try {
    if (isSupabaseAuthEnabled && supabase) {
      const { data, error } = await supabase
        .from("products")
        .select("id, school, name, sizes, display_order")
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("name");

      if (!error && Array.isArray(data) && data.length > 0) {
        return normalizeProducts(data);
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
  if (isDemoFallbackProductSet(fallbackProducts)) {
    warnSingleSourceFallback();
    return [];
  }
  if (fallbackProducts.length > 0 && !isKnownAuthoritativeProductSet(fallbackProducts)) {
    warnSingleSourceFallback();
    return [];
  }
  warnSingleSourceFallback();
  return fallback;
};

export const saveProducts = async ({ products, storage, supabase, isSupabaseAuthEnabled }) => {
  const normalized = normalizeProducts(products);
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
        const exists = sizes.some((item) => item.size === size.size && (item.length || "") === (size.length || ""));
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

    const { error } = await supabase.from("products").upsert(uniqueProducts.map(({ id, school, name, sizes }, index) => ({
      id,
      school: school || "",
      name,
      sizes,
      display_order: index,
    })));

    if (error) throw error;
  }

  if (storage) {
    await storage.set("products", JSON.stringify(normalized), true).catch(() => {});
  }

  return normalized;
};
