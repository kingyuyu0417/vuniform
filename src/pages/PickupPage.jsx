import React, { useEffect, useMemo, useState } from "react";
import { CheckCheck, Clock3, PackageCheck, Zap } from "lucide-react";
import { ORDER_STATUS } from "../services/queueOrderService";
import { supabase, isSupabaseConfigured } from "../supabaseClient";

const statusLabel = {
  [ORDER_STATUS.PENDING]: "排隊中",
  [ORDER_STATUS.PREPARING]: "待執貨",
  [ORDER_STATUS.READY]: "已執好",
  [ORDER_STATUS.COMPLETED]: "已完成",
  [ORDER_STATUS.SKIPPED]: "已過號",
};

const getSafeOrder = (row) => ({
  ...row,
  queue_number: row.queue_number || row.queueNumber || "",
  customer_info: row.customer_info || row.customerInfo || {},
  tailor_info: row.tailor_info || row.tailorInfo || {},
  status: row.status || ORDER_STATUS.PENDING,
});

export default function PickupPage({ currentSchoolId = "", onReadyForSale }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [notice, setNotice] = useState("");

  const syncOrders = async () => {
    setLoading(true);
    setNotice("");
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase 未設定");
      let query = supabase.from("customer_orders").select("*").eq("status", "PREPARING").order("created_at", { ascending: true });
      if (currentSchoolId) query = query.eq("school_id", currentSchoolId);
      const { data, error } = await query;
      if (error) throw error;
      const nextOrders = (Array.isArray(data) ? data : []).map(getSafeOrder);
      setOrders(nextOrders);
      return nextOrders;
    } catch (error) {
      console.error("pickup orders sync failed", error);
      setNotice("同步失敗，請重試");
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncOrders();
    if (!isSupabaseConfigured || !supabase) return undefined;
    const channel = supabase
      .channel(`pickup-preparing-orders-${currentSchoolId || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_orders",
          filter: "status=eq.PREPARING",
        },
        () => { syncOrders(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentSchoolId]);

  const preparingOrders = useMemo(
    () => orders.filter((o) => o.status === ORDER_STATUS.PREPARING),
    [orders]
  );

  const batchSummary = useMemo(() => {
    return preparingOrders.reduce((acc, order) => {
      const items = Array.isArray(order.tailor_info?.items) ? order.tailor_info.items : [];
      items.forEach((item) => {
        const key = `${item.product_name || "未知產品"}::${item.size || ""}`;
        acc[key] = acc[key] || {
          product: item.product_name || "未知產品",
          size: item.size || "",
          quantity: 0,
        };
        acc[key].quantity += Number(item.quantity || 1);
      });
      return acc;
    }, {});
  }, [preparingOrders]);

  const summaryRows = useMemo(() => Object.values(batchSummary), [batchSummary]);

  const markReady = async (orderId) => {
    if (updatingId) return;
    if (!orderId) {
      setNotice("同步失敗，請重試");
      return;
    }
    setUpdatingId(orderId);
    setNotice("");
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        throw new Error("找不到此訂單");
      }

      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase 未設定");
      const { data: updated, error } = await supabase
        .from("customer_orders")
        .update({ status: "READY" })
        .eq("id", orderId)
        .select()
        .single();
      if (error) throw error;
      if (!updated?.id) throw new Error("找不到要更新的訂單");
      setOrders((current) => current.filter((item) => item.id !== orderId));
      if (typeof onReadyForSale === "function") {
        onReadyForSale(updated);
        return;
      }
      const nextOrders = await syncOrders();
      const nextPreparingOrder = nextOrders.find((item) => item.status === ORDER_STATUS.PREPARING);
      setNotice(nextPreparingOrder
        ? `${order.queue_number || "此訂單"} 已執好，已載入下一張待執貨單。`
        : `${order.queue_number || "此訂單"} 已執好，目前沒有需要執貨的訂單。`);
    } catch (error) {
      console.error("mark ready failed", error);
      setNotice("同步失敗，請重試");
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>同事 2 / 臨時倉看板</div>
          <div style={styles.title}>Batch Picking View</div>
        </div>
        <div style={styles.liveBadge}>
          <Zap size={14} />
          0 延遲
        </div>
      </div>

      {notice && <div style={styles.notice}>{notice}</div>}

      <div style={styles.summaryPanel}>
        <div style={styles.summaryTitle}>同款加總</div>
        <div style={styles.summaryGrid}>
          {summaryRows.length === 0 ? (
            <div style={styles.emptySummary}>目前沒有 PREPARING 訂單</div>
          ) : (
            summaryRows.map((item, index) => (
              <div key={`${item.product}-${item.size}-${index}`} style={styles.summaryRow}>
                <div style={styles.summaryName}>{item.product} / {item.size}</div>
                <div style={styles.summaryQty}>{item.quantity} 件</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={styles.list}>
        {loading && <div style={styles.loading}>載入中...</div>}
        {preparingOrders.length === 0 && !loading && <div style={styles.empty}>暫無待執貨單</div>}

        {preparingOrders.map((order) => (
          <div key={order.id} style={styles.card}>
            <div style={styles.cardTop}>
              <div>
                <div style={styles.queue}>{order.queue_number}</div>
                <div style={styles.customer}>{order.customer_info?.guestName || "顧客"} · {order.customer_info?.phone || "電話未填"}</div>
              </div>
              <div style={styles.badge}>{statusLabel[order.status] || order.status}</div>
            </div>

            <div style={styles.itemsWrap}>
              {(order.tailor_info?.items || []).map((item, index) => (
                <div key={`${item.product_name}-${item.size}-${index}`} style={styles.itemRow}>
                  <span>{item.product_name}</span>
                  <span>{item.size}</span>
                  <strong>{item.quantity} 件</strong>
                </div>
              ))}
            </div>

            <button
              style={{ ...styles.readyButton, opacity: updatingId === order.id ? 0.65 : 1 }}
              onClick={() => markReady(order.id)}
              disabled={Boolean(updatingId)}
            >
              <PackageCheck size={16} />
              {updatingId === order.id ? "更新中..." : "執好 / 準備結帳"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "grid", gap: 18, padding: 8 },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#f8fafc",
    border: "1px solid #dfe7f1",
    borderRadius: 18,
    padding: 16,
  },
  kicker: { fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.2 },
  title: { fontSize: 30, fontWeight: 900, color: "#1f3a5f", marginTop: 4 },
  liveBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#dcfce7",
    color: "#166534",
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 12,
  },
  summaryPanel: {
    background: "#1f3a5f",
    color: "#fff",
    borderRadius: 18,
    padding: 16,
    display: "grid",
    gap: 12,
  },
  summaryTitle: { fontSize: 18, fontWeight: 800 },
  summaryGrid: { display: "grid", gap: 8 },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
  },
  summaryName: { fontWeight: 700 },
  summaryQty: { fontWeight: 900, fontSize: 18 },
  emptySummary: { color: "#dbeafe", fontSize: 13, fontWeight: 700 },
  list: { display: "grid", gap: 12 },
  loading: { textAlign: "center", fontWeight: 700, color: "#475569", padding: 16 },
  notice: {
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#047857",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 700,
  },
  empty: {
    background: "#f8fafc",
    border: "1px solid #dfe7f1",
    borderRadius: 14,
    padding: 18,
    textAlign: "center",
    fontWeight: 700,
    color: "#475569",
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
    display: "grid",
    gap: 12,
  },
  cardTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  queue: { fontSize: 30, fontWeight: 900, color: "#0f172a", letterSpacing: 1.2 },
  customer: { fontSize: 13, color: "#475569", fontWeight: 700, marginTop: 4 },
  badge: {
    background: "#fff7ed",
    color: "#c2410c",
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 800,
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  itemsWrap: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 8,
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 13,
    color: "#334155",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: 6,
  },
  readyButton: {
    background: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 800,
    fontSize: 15,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
  },
};
