export const normalizeQueueLookup = (rawValue) => {
  const text = String(rawValue || "").trim();
  if (!text) return "";

  if (/[?&](?:queue|id)=/i.test(text)) {
    try {
      const url = new URL(text, "https://queue-lookup.invalid");
      return url.searchParams.get("id") || url.searchParams.get("queue") || text;
    } catch {
      const match = text.match(/[?&](?:queue|id)=([^&]+)/i);
      if (match) return decodeURIComponent(match[1]);
    }
  }

  return text.toUpperCase();
};

export const findQueueOrders = (orders, rawLookup) => {
  const lookup = normalizeQueueLookup(rawLookup).toUpperCase();
  if (!lookup) return [];

  return (Array.isArray(orders) ? orders : []).filter((order) => (
    String(order?.id || "").toUpperCase() === lookup
    || String(order?.queueNo || order?.queue_number || order?.queueNumber || "").toUpperCase() === lookup
  ));
};

export const clearQueueCallMarker = (tailorInfo, serviceType) => {
  const nextInfo = tailorInfo && typeof tailorInfo === "object" ? { ...tailorInfo } : {};
  delete nextInfo[serviceType === "PICKUP" ? "pickup_called_at" : "fitting_called_at"];
  return nextInfo;
};
