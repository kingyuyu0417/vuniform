import { supabase, isSupabaseConfigured } from "../supabaseClient";

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);
const GUEST_VISITS_STORAGE_KEY = "uniform_pos_guest_visits";

const hasMissingTableError = (error) => {
  if (!error) return false;
  const combined = [error.message, error.details, error.hint, String(error)].join(" ");
  return error.code === "42P01" || /Could not find the table|does not exist|relation .* does not exist|42P01/i.test(combined);
};

const readGuestVisitsCache = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_VISITS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("讀取本地待命單失敗", error);
    return [];
  }
};

const writeGuestVisitsCache = (items) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_VISITS_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn("寫入本地待命單失敗", error);
  }
};

/**
 * 客戶訪問（待命單）操作
 */
export const guestVisits = {
  // 建立新的待命單
  async create(guestData) {
    if (!isSupabaseConfigured) {
      const localGuest = {
        id: `guest-${Date.now()}`,
        queueNo: `FYM-${String(Date.now()).slice(-5)}`,
        ...guestData,
        status: "waiting",
        createdAt: new Date().toISOString(),
      };
      const cached = readGuestVisitsCache();
      writeGuestVisitsCache([...cached, localGuest]);
      return localGuest;
    }

    const guestId = `guest-${Date.now()}-${uid()}`;
    const queueNo = `FYM-${String(guestId).slice(-3).padStart(3, "0")}`;
    const guest = {
      id: guestId,
      queue_no: queueNo,
      queueNo,
      guest_name: guestData.guestName,
      guestName: guestData.guestName,
      class_name: guestData.className,
      className: guestData.className,
      height_cm: guestData.heightCm || "-",
      heightCm: guestData.heightCm || "-",
      weight_kg: guestData.weightKg || "-",
      weightKg: guestData.weightKg || "-",
      phone: guestData.phone,
      notes: guestData.notes || "",
      status: "waiting",
      school: guestData.school || "",
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase.from("guest_visits").insert([guest]).select();
      if (error) {
        if (hasMissingTableError(error)) {
          const cached = readGuestVisitsCache();
          const savedGuest = { ...guest, queueNo, createdAt: guest.createdAt };
          writeGuestVisitsCache([...cached, savedGuest]);
          return savedGuest;
        }
        console.error("建立待命單失敗", error);
        throw error;
      }
      return data?.[0] || guest;
    } catch (error) {
      if (hasMissingTableError(error)) {
        const cached = readGuestVisitsCache();
        const savedGuest = { ...guest, queueNo, createdAt: guest.createdAt };
        writeGuestVisitsCache([...cached, savedGuest]);
        return savedGuest;
      }
      console.error("建立待命單失敗", error);
      throw error;
    }
  },

  // 取得所有待命單
  async listAll(options = {}) {
    if (!isSupabaseConfigured) {
      return readGuestVisitsCache();
    }

    const { school, status } = options;
    let query = supabase.from("guest_visits").select("*").order("created_at", { ascending: false });

    if (school) query = query.eq("school", school);
    if (status) query = query.eq("status", status);

    try {
      const { data, error } = await query;
      if (error) {
        if (hasMissingTableError(error)) {
          return readGuestVisitsCache();
        }
        console.error("讀取待命單失敗", error);
        return [];
      }
      return data || [];
    } catch (error) {
      if (hasMissingTableError(error)) {
        return readGuestVisitsCache();
      }
      console.error("讀取待命單失敗", error);
      return [];
    }
  },

  // 更新待命單狀態
  async updateStatus(id, status) {
    if (!isSupabaseConfigured) {
      const cached = readGuestVisitsCache();
      const updated = cached.map((item) => (item.id === id ? { ...item, status } : item));
      writeGuestVisitsCache(updated);
      return { id, status };
    }

    try {
      const { data, error } = await supabase
        .from("guest_visits")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select();

      if (error) {
        if (hasMissingTableError(error)) {
          const cached = readGuestVisitsCache();
          const updated = cached.map((item) => (item.id === id ? { ...item, status } : item));
          writeGuestVisitsCache(updated);
          return { id, status };
        }
        console.error("更新待命單狀態失敗", error);
        throw error;
      }
      return data?.[0];
    } catch (error) {
      if (hasMissingTableError(error)) {
        const cached = readGuestVisitsCache();
        const updated = cached.map((item) => (item.id === id ? { ...item, status } : item));
        writeGuestVisitsCache(updated);
        return { id, status };
      }
      console.error("更新待命單狀態失敗", error);
      throw error;
    }
  },
};

/**
 * 取貨單操作
 */
export const pickupTickets = {
  // 建立新的取貨單
  async create(ticketData) {
    if (!isSupabaseConfigured) {
      return {
        id: `ticket-${Date.now()}`,
        ...ticketData,
        status: "ready_for_pickup",
        createdAt: new Date().toISOString(),
      };
    }

    const ticket = {
      id: `ticket-${Date.now()}`,
      guest_id: ticketData.guestId,
      guest_name: ticketData.guestName,
      queue_no: ticketData.queueNo,
      status: "ready_for_pickup",
      school: ticketData.school || "",
      created_at: new Date().toISOString(),
    };

    const { data: createdTicket, error: ticketError } = await supabase
      .from("pickup_tickets")
      .insert([ticket])
      .select();

    if (ticketError) {
      console.error("建立取貨單失敗", ticketError);
      throw ticketError;
    }

    const ticketId = createdTicket?.[0]?.id || ticket.id;

    // 插入取貨單項目
    const items = ticketData.items || [];
    if (items.length > 0) {
      const itemsToInsert = items.map((item) => ({
        id: `item-${uid()}`,
        ticket_id: ticketId,
        product_id: item.productId || "",
        product_name: item.productName || item.name || "",
        size: item.size || "",
        quantity: item.quantity || 1,
        created_at: new Date().toISOString(),
      }));

      const { error: itemsError } = await supabase
        .from("pickup_ticket_items")
        .insert(itemsToInsert);

      if (itemsError) {
        console.error("插入取貨單項目失敗", itemsError);
      }
    }

    return createdTicket?.[0] || ticket;
  },

  // 取得所有取貨單
  async listAll(options = {}) {
    if (!isSupabaseConfigured) {
      return [];
    }

    const { status, limit = 50 } = options;
    let query = supabase
      .from("pickup_tickets")
      .select("*, pickup_ticket_items(*)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      console.error("讀取取貨單失敗", error);
      return [];
    }
    return data || [];
  },

  // 更新取貨單狀態
  async updateStatus(id, status) {
    if (!isSupabaseConfigured) {
      return { id, status };
    }

    const { data, error } = await supabase
      .from("pickup_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select();

    if (error) {
      console.error("更新取貨單狀態失敗", error);
      throw error;
    }
    return data?.[0];
  },
};

/**
 * 訂單操作（從取貨單到收銀）
 */
export const paymentOrders = {
  // 從取貨單建立訂單
  async createFromTicket(ticket, items) {
    if (!isSupabaseConfigured) {
      const totalPrice = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
      return {
        id: `order-${Date.now()}`,
        ticketId: ticket.id,
        guestName: ticket.guestName,
        queueNo: ticket.queueNo,
        items,
        totalPrice,
        status: "ready_for_payment",
      };
    }

    const totalPrice = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    const order = {
      id: `order-${Date.now()}`,
      school: ticket.school || "",
      cashier_name: "待配置",
      total: totalPrice,
      item_count: items.length,
      created_at: new Date().toISOString(),
    };

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([order])
      .select();

    if (orderError) {
      console.error("建立訂單失敗", orderError);
      throw orderError;
    }

    // 插入訂單項目
    const orderId = orderData?.[0]?.id || order.id;
    const itemsToInsert = items.map((item) => ({
      order_id: orderId,
      name: item.productName || item.name || "",
      size: item.size || "",
      price: item.price || 0,
      qty: item.quantity || 1,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsToInsert);

    if (itemsError) {
      console.error("插入訂單項目失敗", itemsError);
    }

    return {
      id: orderId,
      ticketId: ticket.id,
      guestName: ticket.guestName,
      queueNo: ticket.queueNo,
      items,
      totalPrice,
      status: "ready_for_payment",
    };
  },

  // 記錄支付
  async recordPayment(orderId, paymentData) {
    if (!isSupabaseConfigured) {
      return {
        orderId,
        status: "paid",
        completedAt: new Date().toISOString(),
      };
    }

    const { data, error } = await supabase
      .from("orders")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select();

    if (error) {
      console.error("記錄支付失敗", error);
      throw error;
    }

    return data?.[0];
  },
};
