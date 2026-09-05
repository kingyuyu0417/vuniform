import React, { useMemo, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Bell, RotateCcw, Check } from "lucide-react";
import { ORDER_STATUS, QUEUE_SERVICE, queueOrderService } from "../services/queueOrderService";

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

export default function QueuePage({ visits = [], currentSchoolId = "", outletName = "", calledBy = "", serviceType = QUEUE_SERVICE.FITTING, onViewGuest, onAssign }) {
  const navigate = useNavigate();
  const counterName = serviceType === QUEUE_SERVICE.PICKUP ? "pickup" : "fitting";
  const [syncedVisits, setSyncedVisits] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date());
  const [counter, setCounter] = useState(null);
  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState("");
  const previousDataRef = useRef(visits);

  useEffect(() => {
    let active = true;
    const syncVisits = async () => {
      try {
        const orders = await queueOrderService.listOrders({ schoolId: currentSchoolId });
        if (!active || !Array.isArray(orders)) return;
        const targetStatus = serviceType === QUEUE_SERVICE.PICKUP ? ORDER_STATUS.READY : ORDER_STATUS.PENDING;
        const normalized = orders
          .filter((order) => order.status === targetStatus && (serviceType !== QUEUE_SERVICE.PICKUP || !order.tailor_info?.pickup_called_at))
          .map((order) => ({
            id: order.id,
            queueNo: order.queue_number || order.queueNumber || "",
            guestName: order.customer_info?.guestName || "",
            className: order.customer_info?.className || "",
            phone: order.customer_info?.phone || "",
            tailor_info: order.tailor_info || {},
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
  }, [currentSchoolId, visits, serviceType]);

  useEffect(() => {
    // 更新 lastUpdatedAt 和 previousDataRef 當 visits 改變時
    setLastUpdatedAt(new Date());
    previousDataRef.current = visits;
  }, [visits]);

  useEffect(() => {
    let active = true;
    const subscription = queueOrderService.subscribeQueueCounter({
      schoolId: currentSchoolId,
      outletName,
      counterName,
      serviceType,
      onChange: (next) => {
        if (!active || next?.service_type !== serviceType || next?.counter_name !== counterName) return;
        setCounter(next);
      },
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [currentSchoolId, outletName, counterName, serviceType]);

  const callNext = async () => {
    setCalling(true);
    setCallError("");
    try {
      const next = serviceType === QUEUE_SERVICE.PICKUP
        ? await queueOrderService.callNextPickup({ schoolId: currentSchoolId, outletName, calledBy })
        : await queueOrderService.callNextFitting({ schoolId: currentSchoolId, outletName, calledBy });
      setCounter(next);
    } catch (error) {
      setCallError(error.message || "叫號失敗，請先執行 queue-counter.sql");
    } finally {
      setCalling(false);
    }
  };

  const clearCurrentCall = async () => {
    setCalling(true);
    setCallError("");
    try {
      const next = await queueOrderService.clearQueueCounter({ schoolId: currentSchoolId, outletName, counterName, serviceType });
      setCounter(next);
    } catch (error) {
      setCallError(error.message || "清除叫號失敗");
    } finally {
      setCalling(false);
    }
  };

  const startCurrentFitting = async () => {
    if (!counter?.current_order_id) return;
    await clearCurrentCall();
    onAssign?.(visibleVisits.find((visit) => visit.id === counter.current_order_id));
    navigate(`/fitting?id=${encodeURIComponent(counter.current_order_id)}`);
  };

  const completeCurrentPickup = async () => {
    if (!counter?.current_order_id) return;
    setCalling(true);
    setCallError("");
    try {
      await queueOrderService.markPickupCalled(counter.current_order_id, currentSchoolId);
      await queueOrderService.clearQueueCounter({ schoolId: currentSchoolId, outletName, counterName, serviceType });
      setCounter(null);
      navigate(`/cashier?order_id=${encodeURIComponent(counter.current_order_id)}`);
    } catch (error) {
      try {
        await queueOrderService.clearQueueCounter({ schoolId: currentSchoolId, outletName, counterName, serviceType });
        setCounter(null);
        navigate(`/cashier?order_id=${encodeURIComponent(counter.current_order_id)}`);
      } catch (clearError) {
        setCallError(clearError.message || error.message || "取貨流程更新失敗");
      }
      setCalling(false);
    }
  };

  const recallCurrentCall = async () => {
    setCalling(true);
    setCallError("");
    try {
        const next = serviceType === QUEUE_SERVICE.PICKUP
          ? await queueOrderService.recallPickup({ schoolId: currentSchoolId, outletName })
          : await queueOrderService.recallFitting({ schoolId: currentSchoolId, outletName });
      setCounter(next);
    } catch (error) {
      setCallError(error.message || "重叫失敗");
    } finally {
      setCalling(false);
    }
  };

  const visibleVisits = (syncedVisits ?? visits).filter((visit) => {
    if (!currentSchoolId) return true;
    return String(visit.school || visit.school_id || visit.schoolId || "").trim() === String(currentSchoolId).trim();
  });
  const targetStatus = serviceType === QUEUE_SERVICE.PICKUP ? ORDER_STATUS.READY : ORDER_STATUS.PENDING;
  const serviceLabel = serviceType === QUEUE_SERVICE.PICKUP ? "取貨排隊管理" : "度身排隊管理";
  const rows = useMemo(() => visibleVisits.filter((visit) => visit.status === targetStatus && (serviceType !== QUEUE_SERVICE.PICKUP || !visit.tailor_info?.pickup_called_at)), [visibleVisits, targetStatus, serviceType]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#F7F7F5", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1F3A5F" }}>{serviceLabel}</div>
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

        <div style={{ background: "#1F3A5F", color: "#fff", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.75 }}>目前叫號{outletName ? ` · ${outletName}` : ""}</div>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 2, margin: "2px 0 10px" }}>{counter?.current_queue_number || "未叫號"}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pos-btn" onClick={callNext} disabled={calling || Boolean(counter?.current_order_id)} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, background: "#D97757", color: "#fff", fontWeight: 800 }}>
              <Bell size={15} style={{ verticalAlign: "middle", marginRight: 5 }} />{calling ? "處理中…" : "叫下一位"}
            </button>
            <button className="pos-btn" onClick={recallCurrentCall} disabled={calling || !counter?.current_queue_number} style={{ padding: "10px 9px", borderRadius: 8, background: "rgba(255,255,255,0.16)", color: "#fff", fontWeight: 700 }} title="重新叫號">
              <RotateCcw size={16} />
            </button>
            <button className="pos-btn" onClick={serviceType === QUEUE_SERVICE.PICKUP ? completeCurrentPickup : startCurrentFitting} disabled={calling || !counter?.current_order_id} style={{ padding: "10px 9px", borderRadius: 8, background: "rgba(255,255,255,0.16)", color: "#fff", fontWeight: 700 }} title={serviceType === QUEUE_SERVICE.PICKUP ? "前往收銀" : "開始目前客人度身"}>
              <Check size={16} />
            </button>
          </div>
          {callError && <div style={{ marginTop: 8, color: "#fecaca", fontSize: 12 }}>{callError}</div>}
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
                {serviceType === QUEUE_SERVICE.FITTING && visit.status === ORDER_STATUS.PENDING ? (
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
                    {serviceType === QUEUE_SERVICE.PICKUP ? "前往取貨頁" : (statusLabel[visit.status] || "處理中")}
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
