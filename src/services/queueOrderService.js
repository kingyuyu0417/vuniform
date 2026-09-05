import { supabase, isSupabaseConfigured } from "../supabaseClient";

export const ORDER_STATUS = {
  PENDING: "PENDING",
  PREPARING: "PREPARING",
  READY: "READY",
  COMPLETED: "COMPLETED",
  SKIPPED: "SKIPPED",
};
export const QUEUE_SERVICE = { FITTING: "FITTING", PICKUP: "PICKUP" };

const STORAGE_KEY = "uniform-pos-customer-flow-cache";
const COUNTER_STORAGE_KEY = "uniform-pos-queue-counter-cache";
const hongKongDate = (value = new Date()) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Hong_Kong",
}).format(new Date(value));
const DAY_PREFIX = () => hongKongDate().replace(/-/g, "");

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

const counterKey = (schoolId = "", outletName = "", counterName = "main", serviceType = QUEUE_SERVICE.FITTING) => `${safeSchoolId(schoolId)}::${outletName || "default-outlet"}::${counterName || "main"}::${serviceType}`;
const readCounterCache = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(COUNTER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn("queue counter cache read failed", error);
    return {};
  }
};
const writeCounterCache = (rows) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COUNTER_STORAGE_KEY, JSON.stringify(rows));
  } catch (error) {
    console.warn("queue counter cache write failed", error);
  }
};
const normalizeCounter = (row = {}) => ({
  school_id: safeSchoolId(row.school_id),
  outlet_name: row.outlet_name || "",
  counter_name: row.counter_name || "main",
  service_type: row.service_type || QUEUE_SERVICE.FITTING,
  current_order_id: row.current_order_id || "",
  current_queue_number: row.current_queue_number || "",
  updated_at: row.updated_at || new Date().toISOString(),
});

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
      .gte("created_at", `${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}T00:00:00+08:00`)
      .lt("created_at", `${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}T23:59:59.999+08:00`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!error && data && data.length) {
      const lastQueue = data[0]?.queue_number || "";
      const match = String(lastQueue).match(/-(\d+)$/);
      if (match) nextSequence = Number(match[1]) + 1;
    }
  }

  const existing = localRows.filter((row) => safeSchoolId(row.school_id) === normalizedSchoolId && hongKongDate(row.created_at) === hongKongDate());
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
    const queueNumber = payload.queue_number || payload.queueNumber || "";
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
      const rpcResult = await supabase.rpc("create_customer_order", {
        order_data: {
          id: record.id,
          school_id: record.school_id,
          queue_number: record.queue_number,
          customer_info: record.customer_info,
          tailor_info: record.tailor_info,
          created_at: record.created_at,
        },
      });
      if (!rpcResult.error) {
        const normalized = normalizeOrderRow(rpcResult.data);
        writeQueueCache([normalized, ...readQueueCache().filter((row) => row.id !== normalized.id)]);
        return normalized;
      }
      if (rpcResult.error.code && rpcResult.error.code !== "42883") throw rpcResult.error;

      const fallbackQueue = record.queue_number || await generateQueueNumber(schoolId);
      const { data, error } = await supabase
        .from("customer_orders")
        .insert([
          {
            id: record.id,
            school_id: record.school_id,
            queue_number: fallbackQueue,
            customer_info: record.customer_info,
            tailor_info: record.tailor_info,
            status: record.status,
            created_at: record.created_at,
          },
        ])
        .select();

      if (error) throw error;
      const saved = (data && data[0]) || { ...record, queue_number: fallbackQueue };
      const normalized = normalizeOrderRow(saved);
      const localRows = readQueueCache();
      writeQueueCache([normalized, ...localRows.filter((row) => row.id !== normalized.id)]);
      return normalized;
    } catch (error) {
      console.error("createOrder failed to sync with Supabase", error);
      throw error;
    }
  },

  async listOrders({ schoolId = "", status = null } = {}) {
    const schoolFilter = schoolId ? safeSchoolId(schoolId) : "";
    if (!isSupabaseConfigured || !supabase) {
      const rows = readQueueCache().filter((row) => !schoolFilter || safeSchoolId(row.school_id) === schoolFilter);
      return rows.filter((row) => !status || row.status === status).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    try {
      let query = supabase.from("customer_orders").select("*").order("created_at", { ascending: false });
      if (schoolFilter) query = query.eq("school_id", schoolFilter);

      const { data, error } = await query;
      if (error) throw error;
      
      const supabaseRows = (data || []).map(normalizeOrderRow).filter((row) => !schoolFilter || safeSchoolId(row.school_id) === schoolFilter);
      // A successful Supabase read is authoritative. Local-only rows are only
      // valid in offline mode and must not reappear after a cloud sync.
      const finalRows = supabaseRows;
      writeQueueCache(finalRows);
      
      // Filter by status AFTER merging
      return finalRows.filter((row) => !status || row.status === status).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
      console.warn("listOrders fallback to local cache", error);
      const rows = readQueueCache().filter((row) => !schoolFilter || safeSchoolId(row.school_id) === schoolFilter);
      return rows.filter((row) => !status || row.status === status).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  async updateStatus(id, status, patch = {}, schoolId = "", expectedStatus = "") {
    const nextPatch = {
      status,
      updated_at: new Date().toISOString(),
      ...patch,
    };

    if (!isSupabaseConfigured || !supabase) {
      // Offline mode: update local cache only
      const rows = readQueueCache();
      const updated = rows.map((row) => (row.id === id ? { ...row, ...nextPatch, status } : row));
      writeQueueCache(updated);
      return updated.find((row) => row.id === id) || { id, status };
    }

    try {
      // IMPORTANT: Update Supabase FIRST, before local cache
      // This prevents merge conflicts during postgres_changes events
      let updateQuery = supabase
        .from("customer_orders")
        .update(nextPatch)
        .eq("id", id);
      if (schoolId) updateQuery = updateQuery.eq("school_id", safeSchoolId(schoolId));
      if (expectedStatus) updateQuery = updateQuery.eq("status", expectedStatus);
      const { data, error } = await updateQuery.select();

      if (error) throw error;
      const saved = data && data[0];
      if (!saved) throw new Error("訂單未成功更新");
      
      const normalized = normalizeOrderRow(saved);
      
      // Now update local cache with Supabase result (source of truth)
      const latestRows = readQueueCache();
      const finalUpdated = latestRows.map((row) => (row.id === id ? { ...row, ...normalized, status: normalized.status } : row));
      writeQueueCache(finalUpdated);
      
      return normalized;
    } catch (error) {
      console.error("updateStatus failed", error);
      throw error;
    }
  },

  async getQueueCounter({ schoolId = "", outletName = "", counterName = "main", serviceType = QUEUE_SERVICE.FITTING } = {}) {
    const key = counterKey(schoolId, outletName, counterName, serviceType);
    if (!isSupabaseConfigured || !supabase) return readCounterCache()[key] || normalizeCounter({ school_id: schoolId, outlet_name: outletName, counter_name: counterName, service_type: serviceType });

    try {
      const { data, error } = await supabase
        .from("queue_counters")
        .select("school_id, outlet_name, counter_name, service_type, current_order_id, current_queue_number, updated_at")
        .eq("school_id", safeSchoolId(schoolId))
        .eq("outlet_name", outletName || "")
        .eq("counter_name", counterName || "main")
        .eq("service_type", serviceType)
        .maybeSingle();
      if (error) throw error;
      const normalized = normalizeCounter(data || { school_id: schoolId, outlet_name: outletName, counter_name: counterName, service_type: serviceType });
      if (normalized.service_type !== serviceType) throw new Error("叫號 counter 服務類型不一致");
      writeCounterCache({ ...readCounterCache(), [key]: normalized });
      return normalized;
    } catch (error) {
      console.warn("queue counter read failed; using local cache", error);
      return readCounterCache()[key] || normalizeCounter({ school_id: schoolId, outlet_name: outletName, counter_name: counterName, service_type: serviceType });
    }
  },

  async callNext({ schoolId = "", outletName = "", counterName = "main", serviceType = QUEUE_SERVICE.FITTING, calledBy = "" } = {}) {
    const key = counterKey(schoolId, outletName, counterName, serviceType);
    if (isSupabaseConfigured && supabase) {
      const rpcName = serviceType === QUEUE_SERVICE.PICKUP ? "call_next_pickup_customer" : "call_next_fitting_customer";
      const { data, error } = await supabase.rpc(rpcName, {
        p_school_id: safeSchoolId(schoolId),
        p_outlet_name: outletName || "",
        p_counter_name: counterName || "main",
        p_called_by: calledBy || null,
      });
      if (error) throw error;
      const normalized = normalizeCounter(data);
      if (normalized.service_type !== serviceType) throw new Error("叫號服務類型不一致，請重新執行 queue-counter.sql");
      writeCounterCache({ ...readCounterCache(), [key]: normalized });
      return normalized;
    }

    const orders = await this.listOrders({ schoolId, status: serviceType === QUEUE_SERVICE.PICKUP ? ORDER_STATUS.READY : ORDER_STATUS.PENDING });
    const next = orders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
    const current = normalizeCounter({ school_id: schoolId, outlet_name: outletName, counter_name: counterName, service_type: serviceType, current_order_id: next?.id, current_queue_number: next?.queue_number });
    writeCounterCache({ ...readCounterCache(), [key]: current });
    return current;
  },

  callNextFitting(options = {}) {
    return this.callNext({ ...options, counterName: "fitting", serviceType: QUEUE_SERVICE.FITTING });
  },

  callNextPickup(options = {}) {
    return this.callNext({ ...options, counterName: "pickup", serviceType: QUEUE_SERVICE.PICKUP });
  },

  async clearQueueCounter({ schoolId = "", outletName = "", counterName = "main", serviceType = QUEUE_SERVICE.FITTING } = {}) {
    const key = counterKey(schoolId, outletName, counterName, serviceType);
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc("clear_queue_counter", {
        p_school_id: safeSchoolId(schoolId),
        p_outlet_name: outletName || "",
        p_counter_name: counterName || "main",
        p_service_type: serviceType,
      });
      if (error) throw error;
      const normalized = normalizeCounter(data);
      writeCounterCache({ ...readCounterCache(), [key]: normalized });
      return normalized;
    }
    const current = normalizeCounter({ school_id: schoolId, outlet_name: outletName, counter_name: counterName, service_type: serviceType });
    writeCounterCache({ ...readCounterCache(), [key]: current });
    return current;
  },

  async recallQueueCounter({ schoolId = "", outletName = "", counterName = "main", serviceType = QUEUE_SERVICE.FITTING } = {}) {
    const current = await this.getQueueCounter({ schoolId, outletName, counterName, serviceType });
    const refreshed = { ...current, updated_at: new Date().toISOString() };
    if (isSupabaseConfigured && supabase && current.current_queue_number) {
      const { data, error } = await supabase
        .from("queue_counters")
        .update({ updated_at: refreshed.updated_at })
        .eq("school_id", safeSchoolId(schoolId))
        .eq("outlet_name", outletName || "")
        .eq("counter_name", counterName || "main")
        .eq("service_type", serviceType)
        .select("school_id, outlet_name, counter_name, service_type, current_order_id, current_queue_number, updated_at")
        .single();
      if (error) throw error;
      return normalizeCounter(data);
    }
    const key = counterKey(schoolId, outletName, counterName, serviceType);
    writeCounterCache({ ...readCounterCache(), [key]: refreshed });
    return refreshed;
  },

  recallFitting(options = {}) {
    return this.recallQueueCounter({ ...options, counterName: "fitting", serviceType: QUEUE_SERVICE.FITTING });
  },

  recallPickup(options = {}) {
    return this.recallQueueCounter({ ...options, counterName: "pickup", serviceType: QUEUE_SERVICE.PICKUP });
  },

  subscribeQueueCounter({ schoolId = "", outletName = "", counterName = "main", serviceType = QUEUE_SERVICE.FITTING, onChange }) {
    this.getQueueCounter({ schoolId, outletName, counterName, serviceType }).then((counter) => onChange?.(counter));
    if (!isSupabaseConfigured || !supabase) return { unsubscribe() {} };
    const channel = supabase
      .channel(`queue-counter-${counterKey(schoolId, outletName, counterName, serviceType)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_counters", filter: `school_id=eq.${safeSchoolId(schoolId)}` }, () => {
        this.getQueueCounter({ schoolId, outletName, counterName, serviceType }).then((counter) => onChange?.(counter));
      })
      .subscribe();
    return { unsubscribe() { supabase.removeChannel(channel); } };
  },

  subscribe({ schoolId, serviceType = "all", onChange }) {
    if (!isSupabaseConfigured || !supabase) {
      const cache = readQueueCache();
      const filtered = (schoolId ? cache.filter((row) => safeSchoolId(row.school_id) === safeSchoolId(schoolId)) : cache);
      onChange?.(filtered);
      return { unsubscribe() {} };
    }

    const schoolFilter = schoolId ? safeSchoolId(schoolId) : "";
    let isInitialized = false;

    const channel = supabase
      .channel(`customer-orders-${schoolFilter || "all"}-${serviceType}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_orders",
          filter: schoolFilter ? `school_id=eq.${schoolFilter}` : undefined,
        },
        async () => {
          try {
            const nextRows = await this.listOrders({ schoolId: schoolFilter });
            onChange?.(nextRows);
          } catch (error) {
            console.error("customer orders realtime sync failed", error);
          }
        }
      )
      .subscribe(async (status) => {
        // 訂閱成功後立即載入初始數據
        if (status === "SUBSCRIBED" && !isInitialized) {
          isInitialized = true;
          try {
            const initialRows = await this.listOrders({ schoolId: schoolFilter });
            onChange?.(initialRows);
          } catch (error) {
            console.error("customer orders initial sync failed", error);
          }
        }
      });

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
