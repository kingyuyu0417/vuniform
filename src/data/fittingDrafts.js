export const getFittingDraft = (drafts, schoolId, orderId) => {
  if (!schoolId || !orderId || !drafts || typeof drafts !== "object") return null;
  return drafts[schoolId]?.[orderId] || null;
};

export const setFittingDraft = (drafts, schoolId, orderId, items) => {
  if (!schoolId || !orderId) return drafts;
  const current = drafts && typeof drafts === "object" ? drafts : {};
  return {
    ...current,
    [schoolId]: {
      ...(current[schoolId] || {}),
      [orderId]: { items },
    },
  };
};

export const removeFittingDraft = (drafts, schoolId, orderId) => {
  if (!schoolId || !orderId || !drafts || typeof drafts !== "object") return drafts;
  const schoolDrafts = { ...(drafts[schoolId] || {}) };
  delete schoolDrafts[orderId];
  return {
    ...drafts,
    [schoolId]: schoolDrafts,
  };
};
