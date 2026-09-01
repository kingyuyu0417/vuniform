import { supabase, isSupabaseConfigured } from "../supabaseClient";

export const ORDER_STATUS = {
  PENDING: "PENDING",
  PREPARING: "PREPARING",
  READY: "READY",
  COMPLETED: "COMPLETED",
  SKIPPED: "SKIPPED",
};

const STORAGE_KEY = "uniform-pos-customer-flow-cache";
const DAY_PREFIX = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");

const safeSchoolId = (schoolId = "") => String(schoolId || "").trim() || "default-school";
const toRecord = (value) => (value && typeof value === "object" ? value : {});

const makeQueueNumber = (schoolId, sequence) => {
  const prefix = String(schoolId || "").trim();
  const schoolPrefix = prefix ? prefix.slice(0, 1).toUpperCase() : "A";
  return `${schoolPrefix}-${String(sequence).padStart(3, "0")}`;
};

const readQueueCache = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("queue cache read failed", error);
    return [];
  }
};

const writeQueueCache = (rows) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch (error) {
    console.warn("queue cache write failed", error);
  }
};

const normalizeOrderRow = (row) => ({
  id: row.id,
  school_id: safeSchoolId(row.school_id),
  schoolId: safeSchoolId(row.school_id),
  queue_number: row.queue_number || row.queueNumber || "",
  queueNumber: row.queue_number || row.queueNumber || "",
  customer_info: toRecord(row.customer_info),
  tailor_info: toRecord(row.tailor_info),
  customerInfo: toRecord(row.customer_info),
  tailorInfo: toRecord(row.tailor_info),
  status: row.status || ORDER_STATUS.PENDING,
  created_at: row.created_at || row.createdAt || new Date().toISOString(),
  createdAt: row.created_at || row.createdAt || new Date().toISOString(),
});

export const generateQueueNumber = async (schoolId) => {
  const normalizedSchoolId = safeSchoolId(schoolId);
  const today = DAY_PREFIX();
  const localRows = readQueueCache();
  let nextSequence = 1;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("customer_orders")
      .select("queue_number")
      .eq("school_id", normalizedSchoolId)
      .gte("created_at", `${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}T00:00:00.000Z`)
      .lt("created_at", `${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}T23:59:59.999Z`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!error && data && data.length) {
      const lastQueue = data[0]?.queue_number || "";
      const match = String(lastQueue).match(/-(\d+)$/);
      if (match) nextSequence = Number(match[1]) + 1;
    }
  }

  const existing = localRows.filter((row) => safeSchoolId(row.school_id) === normalizedSchoolId && row.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10));
  if (existing.length) {
    const maxNumber = existing.reduce((max, row) => {
      const match = String(row.queue_number || row.queueNumber || "").match(/-(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
    nextSequence = Math.max(nextSequence, maxNumber + 1);
  }

  return makeQueueNumber(normalizedSchoolId, nextSequence);
};

export const queueOrderService = {
  async createOrder(payload) {
    const schoolId = safeSchoolId(payload.school_id || payload.schoolId || payload.school);
    const queueNumber = payload.queue_number || payload.queueNumber || (await generateQueueNumber(schoolId));
    const createdAt = payload.created_at || payload.createdAt || new Date().toISOString();
    const customerInfo = payload.customer_info || payload.customerInfo || {};
    const tailorInfo = payload.tailor_info || payload.tailorInfo || {};
    const record = {
      id: payload.id || `co-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      school_id: schoolId,
      queue_number: queueNumber,
      customer_info: customerInfo,
      tailor_info: tailorInfo,
      status: payload.status || ORDER_STATUS.PENDING,
      created_at: createdAt,
      customerInfo,
      tailorInfo,
      queueNumber: queueNumber,
      schoolId: schoolId,
      createdAt: createdAt,
    };

    if (!isSupabaseConfigured || !supabase) {
      const localRows = readQueueCache();
      const nextRows = [record, ...localRows.filter((row) => row.id !== record.id)];
      writeQueueCache(nextRows);
      return record;
    }

    try {
      const { data, error } = await supabase
        .from("customer_orders")
        .insert([
          {
            id: record.id,
            school_id: record.school_id,
            queue_number: record.queue_number,
            customer_info: record.customer_info,
            tailor_info: record.tailor_info,
            status: record.status,
            created_at: record.created_at,
          },
        ])
        .select();

      if (error) throw error;
      const saved = (data && data[0]) || record;
      const normalized = normalizeOrderRow(saved);
      const localRows = readQueueCache();
      writeQueueCache([normalized, ...localRows.filter((row) => row.id !== normalized.id)]);
      return normalized;
    } catch (error) {
      console.warn("createOrder fallback to local cache", error);
      const localRows = readQueueCache();
      const nextRows = [record, ...localRows.filter((row) => row.id !== record.id)];
      writeQueueCache(nextRows);
      return record;
    }
  },

  async listOrders({ schoolId = "", status = null } = {}) {
    const schoolFilter = safeSchoolId(schoolId);
    if (!isSupabaseConfigured || !supabase) {
      const rows = readQueueCache().filter((row) => !schoolFilter || safeSchoolId(row.school_id) === schoolFilter);
      return rows.filter((row) => !status || row.status === status).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    try {
      let query = supabase.from("customer_orders").select("*").order("created_at", { ascending: false });
      if (schoolFilter) query = query.eq("school_id", schoolFilter);
      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []).map(normalizeOrderRow);
      writeQueueCache(rows);
      return rows;
    } catch (error) {
      console.warn("listOrders fallback to local cache", error);
      const rows = readQueueCache().filter((row) => !schoolFilter || safeSchoolId(row.school_id) === schoolFilter);
      return rows.filter((row) => !status || row.status === status).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  async updateStatus(id, status, patch = {}) {
    const nextPatch = {
      status,
      updated_at: new Date().toISOString(),
      ...patch,
    };

    if (!isSupabaseConfigured || !supabase) {
      const rows = readQueueCache();
      const updated = rows.map((row) => (row.id === id ? { ...row, ...nextPatch, status } : row));
      writeQueueCache(updated);
      return updated.find((row) => row.id === id) || { id, status };
    }

    try {
      const { data, error } = await supabase
        .from("customer_orders")
        .update(nextPatch)
        .eq("id", id)
        .select();

      if (error) throw error;
      const saved = data && data[0];
      if (!saved) throw new Error("找不到要更新的訂單");
      const normalized = normalizeOrderRow(saved);
      const rows = readQueueCache();
      const updated = rows.map((row) => (row.id === id ? { ...row, ...normalized, status: normalized.status } : row));
      writeQueueCache(updated);
      return normalized;
    } catch (error) {
      console.error("updateStatus failed; Supabase status was not changed", error);
      throw error;
    }
  },

  subscribe({ schoolId, onChange }) {
    if (!isSupabaseConfigured || !supabase) {
      const cache = readQueueCache();
      const filtered = (schoolId ? cache.filter((row) => safeSchoolId(row.school_id) === safeSchoolId(schoolId)) : cache);
      onChange?.(filtered);
      return { unsubscribe() {} };
    }

    const schoolFilter = safeSchoolId(schoolId);
    const channel = supabase
      .channel(`customer-orders-${schoolFilter || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_orders",
          filter: schoolFilter ? `school_id=eq.${schoolFilter}` : undefined,
        },
        async () => {
          const nextRows = await this.listOrders({ schoolId: schoolFilter });
          onChange?.(nextRows);
        }
      )
      .subscribe();

    return {
      unsubscribe() {
        supabase.removeChannel(channel);
      },
    };
  },
};

export const getCurrentQueuePosition = (orders, queueNumber) => {
  const active = (orders || []).filter((order) => order.queue_number && order.status !== ORDER_STATUS.COMPLETED && order.status !== ORDER_STATUS.SKIPPED);
  const sorted = [...active].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const index = sorted.findIndex((order) => order.queue_number === queueNumber || order.queueNumber === queueNumber);
  return index >= 0 ? { before: index, current: index + 1 } : null;
};

export const aggregatePreparingItems = (orders = []) => {
  return orders.filter((order) => order.status === ORDER_STATUS.PREPARING).reduce((result, order) => {
    const items = Array.isArray(order.tailor_info?.items) ? order.tailor_info.items : [];
    items.forEach((item) => {
      const key = `${item.product_name || item.productName || ""}::${item.size || ""}`;
      result[key] = {
        product: item.product_name || item.productName || "未知產品",
        size: item.size || "",
        quantity: (result[key]?.quantity || 0) + Number(item.quantity || 1),
      };
    });
    return result;
  }, {});
};
