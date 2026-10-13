export const QUEUE_FEATURES_ENABLED = false;

const QUEUE_FEATURE_IDS = new Set(["guest", "queue", "track", "fitting", "pickup", "cashier"]);
const QUEUE_FEATURE_PATHS = new Set([
  "/checkin",
  "/queue-status",
  "/queue-display",
  "/track",
  "/fitting",
  "/pickup",
  "/cashier",
]);
const PUBLIC_QUEUE_PATHS = new Set(["/checkin", "/queue-status", "/queue-display"]);

export const availableFeatureIds = (ids = []) => (
  QUEUE_FEATURES_ENABLED ? ids : ids.filter((id) => !QUEUE_FEATURE_IDS.has(id))
);

export const getDisabledQueueRedirect = (pathname, hasQueueQuery = false) => {
  if (QUEUE_FEATURES_ENABLED) return null;
  if (hasQueueQuery) return "/";
  if (!QUEUE_FEATURE_PATHS.has(pathname)) return null;
  return PUBLIC_QUEUE_PATHS.has(pathname) ? "/" : "/menu";
};
