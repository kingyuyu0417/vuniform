import React, { useState } from "react";
import { paymentOrders } from "../services/customerFlowService";

const sampleOrders = [
  {
    id: "order-1",
    ticketId: "ticket-1",
    guestName: "陳小美",
    queueNo: "FYM-001",
    items: [
      { productName: "白色恤衫（短袖）", size: "28", quantity: 1, price: 60 },
      { productName: "藏青色短褲", size: "28", quantity: 1, price: 70 },
    ],
    totalPrice: 130,
    status: "ready_for_payment",
  },
  {
    id: "order-2",
    ticketId: "ticket-2",
    guestName: "李大明",
    queueNo: "FYM-002",
    items: [
      { productName: "白色恤衫（長袖）", size: "32", quantity: 1, price: 80 },
      { productName: "PE運動套裝", size: "M", quantity: 1, price: 115 },
    ],
    totalPrice: 195,
    status: "ready_for_payment",
  },
];

const statusLabel = {
  ready_for_payment: "待支付",
  paid: "已支付",
  completed: "已完成",
};

const paymentMethods = [
  { id: "cash", label: "現金" },
  { id: "card", label: "信用卡" },
  { id: "transfer", label: "轉帳" },
];

export default function CashierVerifyPage({ orders = sampleOrders, onConfirmPayment }) {
  const [selectedOrder, setSelectedOrder] = useState(orders[0] || null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [submitted, setSubmitted] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
      const amount = parseInt(cashReceived) || selectedOrder.totalPrice;
      const changeDue = Math.max(0, amount - selectedOrder.totalPrice);

      const payment = {
        orderId: selectedOrder.id,
        guestName: selectedOrder.guestName,
        queueNo: selectedOrder.queueNo,
        totalPrice: selectedOrder.totalPrice,
        paymentMethod,
        cashReceived: paymentMethod === "cash" ? amount : selectedOrder.totalPrice,
        changeDue,
        status: "paid",
        completedAt: new Date().toISOString(),
      };

      // 記錄支付到 Supabase
      if (selectedOrder.id) {
        await paymentOrders.recordPayment(selectedOrder.id, payment);
      }

      setSubmitted(payment);
      onConfirmPayment?.(payment);
      setPaymentMethod("");
      setCashReceived("");
    } catch (err) {
      setError("記錄支付失敗：" + (err.message || "未知錯誤"));
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedOrder) {
    return (
      <div style={{ background: "#F7F7F5", borderRadius: 12, padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "#66717D" }}>沒有待支付訂單</div>
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
              <span>${selectedOrder.totalPrice}</span>
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
                placeholder={String(selectedOrder.totalPrice)}
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
                  應找金額：${Math.max(0, parseInt(cashReceived) - selectedOrder.totalPrice)}
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
