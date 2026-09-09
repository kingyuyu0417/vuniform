import React, { useMemo, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Bell, RotateCcw, Check, SkipForward } from "lucide-react";
import { ORDER_STATUS, QUEUE_SERVICE, queueOrderService, isQueueOrderToday } from "../services/queueOrderService";

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

export default function QueuePage({ visits = [], currentSchoolId = "", outletName = "", calledBy = "", serviceType = QUEUE_SERVICE.FITTING, onViewGuest, onAssign, onReadyForSale }) {
  const navigate = useNavigate();
  const counterName = serviceType === QUEUE_SERVICE.PICKUP ? "pickup" : "fitting";
  const [syncedVisits, setSyncedVisits] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date());
  const [counter, setCounter] = useState(null);
  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState("");
  const previousDataRef = useRef(visits);
  const chimeAudioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio("/audio/queue-chime.mpeg");
    audio.preload = "auto";
    chimeAudioRef.current = audio;
    return () => {
      audio.pause();
      chimeAudioRef.current = null;
    };
  }, []);

  const playCallChime = () => {
    const audio = chimeAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch((error) => console.warn("queue call chime could not play", error));
  };

  useEffect(() => {
    let active = true;
    const syncVisits = async () => {
      try {
        const orders = await queueOrderService.listOrders({ schoolId: currentSchoolId });
        if (!active || !Array.isArray(orders)) return;
        const targetStatus = serviceType === QUEUE_SERVICE.PICKUP ? ORDER_STATUS.READY : ORDER_STATUS.PENDING;
        const normalized = orders
          .filter((order) => isQueueOrderToday(order.created_at) && (order.status === targetStatus || order.status === ORDER_STATUS.SKIPPED) && (serviceType !== QUEUE_SERVICE.PICKUP || !order.tailor_info?.pickup_called_at))
          .map((order) => ({
            id: order.id,
            queueNo: order.queue_number || order.queueNumber || "",
            guestName: order.customer_info?.guestName || "",
            className: order.customer_info?.className || "",
            phone: order.customer_info?.phone || "",
            tailor_info: order.tailor_info || {},
            school: order.school_id || order.schoolId || "",
            status: order.status,
            created_at: order.created_at || order.createdAt || "",
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
      if (next?.current_queue_number) playCallChime();
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

  const skipCurrentCall = async () => {
    if (!counter?.current_order_id) return;
    setCalling(true);
    setCallError("");
    const expectedStatus = serviceType === QUEUE_SERVICE.PICKUP ? ORDER_STATUS.READY : ORDER_STATUS.PENDING;
    try {
      await queueOrderService.updateStatus(
        counter.current_order_id,
        ORDER_STATUS.SKIPPED,
        {},
        currentSchoolId,
        expectedStatus
      );
      const next = await queueOrderService.clearQueueCounter({ schoolId: currentSchoolId, outletName, counterName, serviceType });
      setCounter(next);
    } catch (error) {
      setCallError(error.message || "過號處理失敗");
    } finally {
      setCalling(false);
    }
  };

  const recallSkipped = async (visit) => {
    if (!visit?.id) {
      setCallError("過號資料缺少訂單編號，無法重新叫號");
      return;
    }
    if (counter?.current_order_id) {
      setCallError(`目前仍在叫號 ${counter.current_queue_number || "客人"}，請先完成、過號或清除目前叫號`);
      return;
    }
    setCalling(true);
    setCallError("");
    const targetStatus = serviceType === QUEUE_SERVICE.PICKUP ? ORDER_STATUS.READY : ORDER_STATUS.PENDING;
    try {
      await queueOrderService.updateStatus(visit.id, targetStatus, {}, currentSchoolId, ORDER_STATUS.SKIPPED);
      setSyncedVisits((previous) => (previous || []).map((order) => (
        order.id === visit.id ? { ...order, status: targetStatus } : order
      )));
      const next = await queueOrderService.callSpecific({
        schoolId: currentSchoolId,
        outletName,
        counterName,
        serviceType,
        orderId: visit.id,
        queueNumber: visit.queueNo,
        calledBy,
      });
      setCounter(next);
      if (next?.current_queue_number) playCallChime();
    } catch (error) {
      setCallError(error.message || "重新叫過號失敗");
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
      const markedOrder = await queueOrderService.markPickupCalled(counter.current_order_id, currentSchoolId);
      if (!markedOrder?.id) throw new Error("取貨訂單未成功更新，請重新整理後再試");
      await queueOrderService.clearQueueCounter({ schoolId: currentSchoolId, outletName, counterName, serviceType });
      setCounter(null);
      navigate(`/cashier?order_id=${encodeURIComponent(counter.current_order_id)}`);
    } catch (error) {
      setCallError(error.message || "取貨流程更新失敗");
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
      if (next?.current_queue_number) playCallChime();
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
  const rows = useMemo(() => visibleVisits.filter((visit) => isQueueOrderToday(visit.created_at) && visit.status === targetStatus && (serviceType !== QUEUE_SERVICE.PICKUP || !visit.tailor_info?.pickup_called_at)), [visibleVisits, targetStatus, serviceType]);
  const skippedRows = useMemo(() => visibleVisits.filter((visit) => {
    if (!isQueueOrderToday(visit.created_at) || visit.status !== ORDER_STATUS.SKIPPED) return false;
    if (serviceType === QUEUE_SERVICE.PICKUP) return Boolean(visit.tailor_info?.prepared_at);
    return !visit.tailor_info?.prepared_at;
  }), [visibleVisits, serviceType]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#F7F7F5", borderRadius: 12, padding: 16 }}>
        {skippedRows.length > 0 && (
          <div style={{ marginBottom: 12, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: 12 }}>
            <div style={{ color: "#9a3412", fontSize: 13, fontWeight: 800, marginBottom: 8 }}>已過號（可重新叫號）</div>
            <div style={{ display: "grid", gap: 8 }}>
              {skippedRows.map((visit) => (
                <div key={visit.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ color: "#7c2d12", fontWeight: 700 }}>{visit.queueNo} · {visit.guestName}</span>
                  <button
                    className="pos-btn"
                    onClick={() => recallSkipped(visit)}
                    disabled={calling}
                    style={{ background: "#ea580c", color: "#fff", padding: "7px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700 }}
                  >
                    重新叫號
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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
            <button className="pos-btn" onClick={skipCurrentCall} disabled={calling || !counter?.current_order_id} style={{ padding: "10px 9px", borderRadius: 8, background: "rgba(239,68,68,0.8)", color: "#fff", fontWeight: 700 }} title="客人未到場，標記為過號">
              <SkipForward size={16} />
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
                ) : serviceType === QUEUE_SERVICE.PICKUP ? (
                  <button
                    className="pos-btn"
                    onClick={() => onReadyForSale?.(visit)}
                    style={{ flex: 1, background: "#1F3A5F", color: "#fff", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}
                  >
                    進行銷售
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
