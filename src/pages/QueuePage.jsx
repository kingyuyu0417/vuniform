import React, { useMemo, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { ORDER_STATUS, queueOrderService } from "../services/queueOrderService";

const statusLabel = {
  waiting: "待處理",
  assigned: "已分配",
  fitting: "度身中",
  selected: "已選款",
  PENDING: "排隊中",
  PREPARING: "待執貨",
  READY: "已執好",
  ready_for_pickup: "待取貨",
  completed: "已完成",
};

const activeStatuses = [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING, ORDER_STATUS.READY];

export default function QueuePage({ visits = [], currentSchoolId = "", onViewGuest, onAssign }) {
  const navigate = useNavigate();
  const [syncedVisits, setSyncedVisits] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date());
  const previousDataRef = useRef(visits);

  useEffect(() => {
    let active = true;
    const syncVisits = async () => {
      try {
        const orders = await queueOrderService.listOrders({ schoolId: currentSchoolId });
        if (!active || !Array.isArray(orders)) return;
        const normalized = orders
          .filter((order) => activeStatuses.includes(order.status))
          .map((order) => ({
            id: order.id,
            queueNo: order.queue_number || order.queueNumber || "",
            guestName: order.customer_info?.guestName || "",
            className: order.customer_info?.className || "",
            phone: order.customer_info?.phone || "",
            school: order.school_id || order.schoolId || "",
            status: order.status,
          }));
        setSyncedVisits(normalized);
        setLastUpdatedAt(new Date());
      } catch (syncError) {
        console.warn("排隊資料同步失敗，使用現有資料", syncError);
        if (active) setSyncedVisits(null);
      }
    };
    syncVisits();
    return () => { active = false; };
  }, [currentSchoolId, visits]);

  useEffect(() => {
    // 更新 lastUpdatedAt 和 previousDataRef 當 visits 改變時
    setLastUpdatedAt(new Date());
    previousDataRef.current = visits;
  }, [visits]);

  const visibleVisits = (syncedVisits ?? visits).filter((visit) => {
    if (!currentSchoolId) return true;
    return String(visit.school || visit.school_id || visit.schoolId || "").trim() === String(currentSchoolId).trim();
  });
  const rows = useMemo(
    () => visibleVisits.filter((visit) => activeStatuses.includes(visit.status)),
    [visibleVisits]
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#F7F7F5", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1F3A5F" }}>待命單 / 排隊管理</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#66717D" }}>{rows.length} 位客人</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#dcfce7", color: "#166534", padding: "6px 10px", borderRadius: 999, fontWeight: 800, fontSize: 11 }}>
              <Zap size={12} />
              即時更新
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
          最後更新：{lastUpdatedAt.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
                  onClick={() => {
                    onViewGuest?.(visit);
                    const visitId = visit.id || visit.queueNo || "";
                    navigate(`/fitting?id=${encodeURIComponent(visitId)}`);
                  }}
                  style={{ flex: 1, background: "#EEF1F5", color: "#1F3A5F", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}
                >
                  查看資料
                </button>
                {visit.status === ORDER_STATUS.PENDING ? (
                  <button
                    className="pos-btn"
                    onClick={() => {
                      onAssign?.(visit);
                      const visitId = visit.id || visit.queueNo || "";
                      if (!visitId) {
                        console.warn("QueuePage: visit 缺少 ID 或 queueNo", visit);
                        alert("訂單資訊不完整，無法進入度身頁面");
                        return;
                      }
                      console.log("QueuePage: opening fitting for", {
                        visitId,
                        queueNo: visit.queueNo,
                        guestName: visit.guestName,
                        id: visit.id,
                      });
                      navigate(`/fitting?id=${encodeURIComponent(visitId)}`);
                    }}
                    style={{ flex: 1, background: "#1F3A5F", color: "#fff", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}
                  >
                    開始度身
                  </button>
                ) : (
                  <div style={{ flex: 1, background: "#F1F5F9", color: "#64748B", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                    {statusLabel[visit.status] || "處理中"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
