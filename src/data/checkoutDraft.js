const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const TAB_ID_STORAGE_KEY = "uniform-pos-checkout-draft-tab";

export const getCheckoutDraftTabId = (storage) => {
  const existingId = storage.getItem(TAB_ID_STORAGE_KEY);
  if (existingId) return existingId;

  const tabId = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  storage.setItem(TAB_ID_STORAGE_KEY, tabId);
  return tabId;
};

export const getCheckoutDraftStorageKey = (cashierId, tabId) => (
  `uniform-pos-checkout-draft:${cashierId || "local"}:${tabId || "default"}`
);

export const parseCheckoutDraft = (value, now = Date.now()) => {
  let draft;
  try {
    draft = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }

  if (!draft || typeof draft !== "object" || !Array.isArray(draft.cart)) return null;
  const savedAt = Date.parse(draft.savedAt || "");
  if (!Number.isFinite(savedAt) || savedAt > now || now - savedAt > DRAFT_MAX_AGE_MS) return null;
  if (draft.cart.length === 0 && !draft.fullSaleReplacement) return null;
  return draft;
};
