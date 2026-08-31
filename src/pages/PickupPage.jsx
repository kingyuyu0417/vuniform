import React, { useMemo, useEffect, useState } from "react";
import { pickupTickets } from "../services/customerFlowService";

const sampleTickets = [
  {
    id: "ticket-1",
    guestId: "guest-1",
    guestName: "陳小美",
    queueNo: "FYM-001",
    items: [
      { productName: "白色恤衫（短袖）", size: "28", quantity: 1 },
      { productName: "藏青色短褲", size: "28", quantity: 1 },
    ],
    status: "ready_for_pickup",
    createdAt: "2026-08-31T13:30:00",
  },
  {
    id: "ticket-2",
    guestId: "guest-2",
    guestName: "李大明",
    queueNo: "FYM-002",
    items: [
      { productName: "白色恤衫（長袖）", size: "32", quantity: 1 },
      { productName: "PE運動套裝", size: "M", quantity: 1 },
    ],
    status: "ready_for_pickup",
    createdAt: "2026-08-31T13:35:00",
  },
];

const statusLabel = {
  ready_for_pickup: "待取貨",
  picked_up: "已取貨",
  completed: "已完成",
};

export default function PickupPage({ tickets = sampleTickets, onMarkReady, onHandover }) {
  const [ticketsData, setTicketsData] = useState(tickets);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadTickets = async () => {
      setIsLoading(true);
      try {
        const data = await pickupTickets.listAll();
        if (data && data.length > 0) {
          setTicketsData(data);
        }
      } catch (err) {
        console.error("加載取貨單失敗", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTickets();
  }, []);

  const rows = useMemo(() => ticketsData, [ticketsData]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#F7F7F5", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1F3A5F" }}>取貨 / 倉庫</div>
          <div style={{ fontSize: 12, color: "#66717D" }}>{rows.length} 份準備中</div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((ticket) => (
            <div key={ticket.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1F3A5F" }}>{ticket.queueNo}</div>
                  <div style={{ fontSize: 13, color: "#334155", marginTop: 2 }}>{ticket.guestName}</div>

                  <div style={{ fontSize: 12, color: "#66717D", marginTop: 8, background: "#F7F7F5", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>項目清單：</div>
                    {ticket.items.map((item, idx) => (
                      <div key={idx} style={{ fontSize: 11, marginTop: 4 }}>
                        • {item.productName} / {item.size} × {item.quantity}
                      </div>
                    ))}
                  </div>
                </div>
                <span
                  style={{
                    background: "#FFF4E5",
                    color: "#9A4D00",
                    borderRadius: 999,
                    padding: "5px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {statusLabel[ticket.status] || ticket.status}
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  className="pos-btn"
                  onClick={async () => {
                    try {
                      await pickupTickets.updateStatus(ticket.id, "ready_for_pickup");
                      onMarkReady?.(ticket);
                      setTicketsData((prev) =>
                        prev.map((item) =>
                          item.id === ticket.id ? { ...item, status: "ready_for_pickup" } : item
                        )
                      );
                    } catch (err) {
                      console.error("更新失敗", err);
                    }
                  }}
                  style={{ flex: 1, background: "#1F3A5F", color: "#fff", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}
                >
                  標記已準備
                </button>
                <button
                  className="pos-btn"
                  onClick={() => onHandover?.(ticket)}
                  style={{ flex: 1, background: "#EAF7EF", color: "#21693C", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}
                >
                  交付取貨
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
