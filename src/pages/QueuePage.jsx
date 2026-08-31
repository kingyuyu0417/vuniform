import React, { useMemo, useEffect, useState } from "react";
import { guestVisits } from "../services/customerFlowService";

const sampleQueue = [
  {
    id: "guest-1",
    queueNo: "FYM-001",
    guestName: "陳小美",
    className: "中二A",
    phone: "91234567",
    status: "waiting",
    createdAt: "2026-08-31T13:00:00",
  },
  {
    id: "guest-2",
    queueNo: "FYM-002",
    guestName: "李大明",
    className: "中一C",
    phone: "98765432",
    status: "assigned",
    createdAt: "2026-08-31T13:02:00",
  },
  {
    id: "guest-3",
    queueNo: "FYM-003",
    guestName: "王小麗",
    className: "中三B",
    phone: "65432123",
    status: "fitting",
    createdAt: "2026-08-31T13:04:00",
  },
];

const statusLabel = {
  waiting: "待處理",
  assigned: "已分配",
  fitting: "度身中",
  selected: "已選款",
  ready_for_pickup: "待取貨",
  completed: "已完成",
};

export default function QueuePage({ visits = sampleQueue, onViewGuest, onAssign }) {
  const [visitsData, setVisitsData] = useState(visits);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadVisits = async () => {
      setIsLoading(true);
      try {
        const data = await guestVisits.listAll();
        if (data && data.length > 0) {
          setVisitsData(data);
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
                  onClick={() => onAssign?.(visit)}
                  style={{ flex: 1, background: "#1F3A5F", color: "#fff", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}
                >
                  開始度身
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
