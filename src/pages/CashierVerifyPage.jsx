import React, { useEffect, useMemo, useState } from "react";
import { ORDER_STATUS } from "../services/queueOrderService";
import { isSupabaseConfigured, supabase } from "../supabaseClient";

const paymentMethods = [
  { id: "cash", label: "現金" },
  { id: "card", label: "信用卡" },
  { id: "transfer", label: "轉帳" },
];

export default function CashierVerifyPage({ currentSchoolId = "", products = [], onConfirmPayment }) {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [submitted, setSubmitted] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizeOrder = (order) => ({
    ...order,
    queueNo: order.queue_number || order.queueNumber || "",
    guestName: order.customer_info?.guestName || order.guestName || "顧客",
    items: (order.tailor_info?.items || []).map((item) => ({
      productName: item.product_name || item.productName || "未知產品",
      size: item.size || "",
      quantity: Number(item.quantity || 1),
      price: Number(item.price || products
        .find((product) => product.name === (item.product_name || item.productName))?.sizes
        ?.find((sizeOption) => String(sizeOption.size) === String(item.size) && String(sizeOption.length || "") === String(item.length || ""))?.price || 0),
    })),
  });

  const syncReadyOrders = async () => {
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase 未設定");
      const query = supabase.from("customer_orders").select("*").eq("status", "READY").order("created_at", { ascending: true });
      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      const ready = (Array.isArray(data) ? data : [])
        .map(normalizeOrder);
      setOrders(ready);
      setSelectedOrder((current) => ready.find((order) => order.id === current?.id) || ready[0] || null);
      return ready;
    } catch (loadError) {
      console.error("cashier ready orders sync failed", loadError);
      setError("同步失敗，請重試");
      return [];
    }
  };

  useEffect(() => {
    syncReadyOrders();
    if (!isSupabaseConfigured || !supabase) return undefined;
    const channel = supabase
      .channel(`cashier-ready-orders-${currentSchoolId || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_orders",
          filter: "status=eq.READY",
        },
        () => { syncReadyOrders(); }
      )
      .subscribe();

    const handlePaidOrder = (event) => {
      const { orderId } = event.detail || {};
      if (!orderId) return;
      setOrders((current) => {
        const remaining = current.filter((order) => order.id !== orderId);
        setSelectedOrder((previous) => {
          if (!previous || previous.id !== orderId) return previous;
          return remaining[0] || null;
        });
        return remaining;
      });
    };

    window.addEventListener("customer-order-paid", handlePaidOrder);
    return () => {
      window.removeEventListener("customer-order-paid", handlePaidOrder);
      supabase.removeChannel(channel);
    };
  }, [currentSchoolId]);

  const selectedTotal = useMemo(
    () => (selectedOrder?.items || []).reduce((total, item) => total + item.price * item.quantity, 0),
    [selectedOrder]
  );

  const handleConfirmPayment = async () => {
    if (!paymentMethod) {
      setError("請選擇支付方式");
      return;
    }

    if (paymentMethod === "cash" && !cashReceived) {
      setError("請輸入實收現金");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const amount = parseInt(cashReceived) || selectedTotal;
      const changeDue = Math.max(0, amount - selectedTotal);

      const payment = {
        orderId: selectedOrder.id,
        guestName: selectedOrder.guestName,
        queueNo: selectedOrder.queueNo,
        totalPrice: selectedTotal,
        paymentMethod,
        cashReceived: paymentMethod === "cash" ? amount : selectedTotal,
        changeDue,
        status: "paid",
        completedAt: new Date().toISOString(),
      };

      if (!isSupabaseConfigured || !supabase) {
        console.warn("Supabase 未設定，使用離線模式");
        // 即使 Supabase 未設定，仍然應該通知父元件支付成功
        setSubmitted(payment);
        setOrders((current) => {
          const remaining = current.filter((order) => order.id !== selectedOrder.id);
          setSelectedOrder((remaining[0] && remaining[0].id !== selectedOrder.id) ? remaining[0] : null);
          return remaining;
        });
        onConfirmPayment?.(payment);
        setPaymentMethod("");
        setCashReceived("");
        return;
      }

      const receiptId = `receipt-${selectedOrder.id}`;
      const saleItems = selectedOrder.items.map((item) => ({
        order_id: receiptId,
        name: item.productName,
        size: item.size,
        length: item.length || null,
        price: item.price,
        qty: item.quantity,
      }));

      // 優先更新訂單狀態（最重要的操作）
      let completedOrder = null;
      try {
        const { data, error: completionError } = await supabase
          .from("customer_orders")
          .update({
            status: "COMPLETED",
            tailor_info: { ...(selectedOrder.tailor_info || {}), paid_at: payment.completedAt, payment },
          })
          .eq("id", selectedOrder.id)
          .select()
          .single();
        
        if (completionError) {
          console.error("更新訂單狀態失敗", completionError);
        } else {
          completedOrder = data;
        }
      } catch (error) {
        console.error("更新訂單狀態異常", error);
      }

      // 嘗試保存銷售記錄（不成功也不應停止流程）
      try {
        const orderPayload = {
          id: receiptId,
          school: selectedOrder.school_id || "香港中國婦女會馮堯敬紀念中學",
          total: selectedTotal,
          item_count: saleItems.reduce((count, item) => count + item.qty, 0),
          created_at: new Date().toISOString(),
        };

        if (selectedOrder.cashier_id !== undefined || selectedOrder.cashierId !== undefined) {
          orderPayload.cashier_id = selectedOrder.cashier_id ?? selectedOrder.cashierId ?? null;
        }
        if (selectedOrder.cashier_name || selectedOrder.cashierName) {
          orderPayload.cashier_name = selectedOrder.cashier_name || selectedOrder.cashierName || "收銀員";
        }

        const { error: saleError } = await supabase.from("orders").insert(orderPayload);
        if (saleError && saleError.code !== "23505") {
          const message = String(saleError.message || "");
          const hasMissingColumn = /column .* does not exist|42703/i.test(message);
          if (hasMissingColumn) {
            const fallbackPayload = Object.fromEntries(
              Object.entries(orderPayload).filter(([key]) => !["cashier_id", "cashier_name"].includes(key))
            );
            const { error: fallbackError } = await supabase.from("orders").insert(fallbackPayload);
            if (fallbackError && fallbackError.code !== "23505") {
              console.warn("保存訂單記錄失敗（使用備用欄位）", fallbackError);
            }
          } else {
            console.warn("保存訂單記錄失敗", saleError);
          }
        }

        const safeSaleItems = saleItems.map(({ length, ...item }) => ({ ...item, ...(length ? { length } : {}) }));
        const { error: itemError } = await supabase.from("order_items").insert(safeSaleItems);
        if (itemError && /column .*length.* does not exist|42703/i.test(String(itemError.message || ""))) {
          const fallbackItems = safeSaleItems.map(({ length, ...item }) => item);
          const { error: fallbackItemError } = await supabase.from("order_items").insert(fallbackItems);
          if (fallbackItemError) {
            console.warn("保存訂單項目失敗（使用備用欄位）", fallbackItemError);
          }
        } else if (itemError) {
          console.warn("保存訂單項目失敗", itemError);
        }
      } catch (error) {
        console.error("保存銷售記錄異常", error);
        // 不中斷流程，只記錄警告
      }

      // 更新 UI 並通知父元件
      setSubmitted(payment);
      setOrders((current) => {
        const remaining = current.filter((order) => order.id !== selectedOrder.id);
        setSelectedOrder((remaining[0] && remaining[0].id !== selectedOrder.id) ? remaining[0] : null);
        return remaining;
      });
      
      try {
        onConfirmPayment?.(payment);
      } catch (callbackError) {
        console.error("onConfirmPayment 回調錯誤", callbackError);
      }

      setPaymentMethod("");
      setCashReceived("");
      
      // 異步重新加載訂單，但不阻止 UI 更新
      try {
        await syncReadyOrders();
      } catch (error) {
        console.error("重新加載訂單失敗", error);
      }
    } catch (err) {
      console.error("handleConfirmPayment 未預期的錯誤", err);
      setError("記錄支付失敗：" + (err.message || "未知錯誤"));
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedOrder) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: "#F7F7F5", borderRadius: 12, padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#66717D" }}>沒有待支付訂單</div>
        </div>
        {submitted && <div style={{ background: "#EAF7EF", border: "1px solid #B7E0C6", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#21693C" }}>支付成功</div>
          <div style={{ fontSize: 13, color: "#255F3D", marginTop: 6 }}>訂單號：{submitted.orderId}，總額：${submitted.totalPrice}</div>
        </div>}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ background: "#F7F7F5", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1F3A5F", marginBottom: 12 }}>收銀 / 驗證</div>

        {orders.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#45515F", marginBottom: 8 }}>選擇訂單</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  style={{
                    background: selectedOrder.id === order.id ? "#1F3A5F" : "#fff",
                    color: selectedOrder.id === order.id ? "#fff" : "#1F3A5F",
                    border: `1px solid ${selectedOrder.id === order.id ? "#1F3A5F" : "#D5DDE5"}`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {order.queueNo}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1F3A5F", marginBottom: 8 }}>訂單詳情</div>
          <div style={{ fontSize: 13, color: "#334155" }}>
            <div>客人：<strong>{selectedOrder.guestName}</strong></div>
              <div style={{ marginTop: 4 }}>待命單號：<strong>{selectedOrder.queueNo}</strong></div>
          </div>

          <div style={{ background: "#F7F7F5", borderRadius: 6, padding: "10px 12px", marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#45515F", marginBottom: 8 }}>商品清單：</div>
            {selectedOrder.items.map((item, idx) => (
              <div key={idx} style={{ fontSize: 11, color: "#66717D", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                <span>{item.productName} / {item.size} × {item.quantity}</span>
                <span>${item.price * item.quantity}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #D5DDE5", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
              <span>總計</span>
              <span>${selectedTotal}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#45515F" }}>支付方式</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => {
                    setPaymentMethod(method.id);
                    setCashReceived("");
                  }}
                  style={{
                    background: paymentMethod === method.id ? "#1F3A5F" : "#fff",
                    color: paymentMethod === method.id ? "#fff" : "#1F3A5F",
                    border: `1px solid ${paymentMethod === method.id ? "#1F3A5F" : "#D5DDE5"}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "cash" && (
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#45515F" }}>實收現金（$）</label>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder={String(selectedTotal)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #D5DDE5",
                  fontSize: 14,
                  background: "#fff",
                }}
              />
              {cashReceived && (
                <div style={{ fontSize: 12, color: "#21693C", background: "#EAF7EF", borderRadius: 6, padding: "8px 10px" }}>
                  應找金額：${Math.max(0, parseInt(cashReceived) - selectedTotal)}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleConfirmPayment}
            disabled={!paymentMethod || (paymentMethod === "cash" && !cashReceived) || isLoading}
            style={{
              background: !paymentMethod || (paymentMethod === "cash" && !cashReceived) || isLoading ? "#C0C8D0" : "#1F3A5F",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 15,
              fontWeight: 700,
              cursor: !paymentMethod || (paymentMethod === "cash" && !cashReceived) || isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "確認中…" : "確認支付"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FFE5E5", border: "1px solid #EE5A6F", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#C53030", marginBottom: 6 }}>錯誤</div>
          <div style={{ fontSize: 13, color: "#A60E0E" }}>{error}</div>
        </div>
      )}

      {submitted && (
        <div style={{ background: "#EAF7EF", border: "1px solid #B7E0C6", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#21693C", marginBottom: 8 }}>支付成功</div>
          <div style={{ fontSize: 13, color: "#255F3D" }}>
            <div>訂單號：{submitted.orderId}</div>
            <div style={{ marginTop: 4 }}>支付方式：{submitted.paymentMethod === "cash" ? "現金" : submitted.paymentMethod === "card" ? "信用卡" : "轉帳"}</div>
            {submitted.changeDue > 0 && (
              <div style={{ marginTop: 4, fontWeight: 600 }}>應找金額：${submitted.changeDue}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
