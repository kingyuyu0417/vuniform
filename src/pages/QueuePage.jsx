import React, { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { queueOrderService } from "../services/queueOrderService";

const statusLabel = {
  waiting: "待處理",
  assigned: "已分配",
  fitting: "度身中",
  selected: "已選款",
  ready_for_pickup: "待取貨",
  completed: "已完成",
};

export default function QueuePage({ visits = [], onViewGuest, onAssign }) {
  const navigate = useNavigate();
  const [visitsData, setVisitsData] = useState(visits);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadVisits = async () => {
      setIsLoading(true);
      try {
        const data = await queueOrderService.listOrders();
        const normalized = (data || []).map((item) => ({
          id: item.id,
          queueNo: item.queue_number || item.queueNumber || "",
          guestName: item.customer_info?.guestName || item.guestName || "",
          className: item.customer_info?.className || item.className || "",
          phone: item.customer_info?.phone || item.phone || "",
          status: item.status || "waiting",
          createdAt: item.created_at || item.createdAt || new Date().toISOString(),
        }));
        if (normalized.length > 0) {
          setVisitsData(normalized);
        }
      } catch (err) {
        console.error("加載待命單失敗", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadVisits();
  }, []);

  const rows = useMemo(() => visitsData, [visitsData]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#F7F7F5", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1F3A5F" }}>待命單 / 排隊管理</div>
          <div style={{ fontSize: 12, color: "#66717D" }}>{rows.length} 位客人</div>
        </div>

        {rows.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "20px 16px", textAlign: "center", color: "#66717D", fontSize: 14 }}>
            目前沒有人在排隊
          </div>
        ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((visit) => (
            <div key={visit.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1F3A5F" }}>{visit.queueNo}</div>
                  <div style={{ fontSize: 13, color: "#334155", marginTop: 2 }}>{visit.guestName} · {visit.className}</div>
                </div>
                <span
                  style={{
                    background: "#EAF7EF",
                    color: "#21693C",
                    borderRadius: 999,
                    padding: "5px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {statusLabel[visit.status] || visit.status}
                </span>
              </div>

              <div style={{ fontSize: 12, color: "#66717D", marginTop: 8 }}>
                電話：{visit.phone}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  className="pos-btn"
                  onClick={() => onViewGuest?.(visit)}
                  style={{ flex: 1, background: "#EEF1F5", color: "#1F3A5F", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}
                >
                  查看資料
                </button>
                <button
                  className="pos-btn"
                  onClick={() => {
                    onAssign?.(visit);
                    const visitId = visit.id || visit.queueNo || "";
                    navigate(`/fitting?id=${encodeURIComponent(visitId)}`);
                  }}
                  style={{ flex: 1, background: "#1F3A5F", color: "#fff", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}
                >
                  開始度身
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
