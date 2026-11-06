const SCHOOL_SELECTABLE_STAFF_PATHS = new Set([
  "/menu",
  "/sale",
  "/products",
  "/records",
  "/staff",
  "/fitting",
  "/pickup",
  "/cashier",
  "/track",
  "/queue",
]);

export const getSchoolFromStaffRoute = (pathname, search) => {
  if (!SCHOOL_SELECTABLE_STAFF_PATHS.has(pathname)) return "";
  const params = new URLSearchParams(search);
  return params.get("school_id") || params.get("school") || "";
};
