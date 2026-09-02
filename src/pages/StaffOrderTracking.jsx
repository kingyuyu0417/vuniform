import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, Check, AlertCircle, Camera, QrCode, Zap } from "lucide-react";
import { queueOrderService } from "../services/queueOrderService";

const statusLabel = {
  PENDING: "排隊中",
  PREPARING: "待執貨",
  READY: "已執好",
  COMPLETED: "已完成",
  SKIPPED: "已過號",
  ready_for_pickup: "已完成",
  completed: "已完成",
};

const getStatusLabel = (status) => statusLabel[status] || "進行中";

const getQueueProgress = (visitsList, targetQueue) => {
  const activeVisits = [...visitsList]
    .filter((item) => item.queueNo && item.status !== "ready_for_pickup" && item.status !== "completed")
    .sort((a, b) => new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0));

  if (!targetQueue) return null;
  const index = activeVisits.findIndex((item) => (item.queueNo || "").toUpperCase() === targetQueue.toUpperCase());
  if (index === -1) return null;

  return {
    position: index + 1,
    before: index,
    total: activeVisits.length,
  };
};

const StaffOrderTracking = ({ visits = [], currentSchoolId = "", onStatusUpdate }) => {
  const [searchQueue, setSearchQueue] = useState("");
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [syncedVisits, setSyncedVisits] = useState(visits);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date());
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const visibleVisits = useMemo(
    () => (syncedVisits.length > 0 ? syncedVisits : visits),
    [syncedVisits, visits]
  );

  useEffect(() => {
    let active = true;
    const syncVisits = async () => {
      try {
        const orders = await queueOrderService.listOrders({ schoolId: currentSchoolId });
        if (!active || !Array.isArray(orders)) return;
        const normalized = orders
          .filter((order) => ["PENDING", "PREPARING", "READY"].includes(order.status))
          .map((order) => ({
            id: order.id,
            queueNo: order.queue_number || order.queueNumber || "",
            guestName: order.customer_info?.guestName || "",
            className: order.customer_info?.className || "",
            heightCm: order.customer_info?.heightCm || "",
            weightKg: order.customer_info?.weightKg || "",
            phone: order.customer_info?.phone || "",
            notes: order.customer_info?.notes || "",
            status: order.status,
            createdAt: order.created_at || order.createdAt || "",
          }));
        setSyncedVisits(normalized);
      } catch (syncError) {
        console.warn("查單資料同步失敗，使用現有資料", syncError);
      }
    };
    syncVisits();
    return () => { active = false; };
  }, [currentSchoolId, visits]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    setLastUpdatedAt(new Date());
    if (selectedVisit) {
      const liveMatch = visibleVisits.find((visit) => (visit.queueNo || "").toUpperCase() === (selectedVisit.queueNo || "").toUpperCase());
      if (liveMatch) {
        setSelectedVisit(liveMatch);
      } else if (!visibleVisits.some((visit) => (visit.queueNo || "").toUpperCase() === (selectedVisit.queueNo || "").toUpperCase())) {
        setSelectedVisit(null);
      }
    }
    return () => stopCamera();
  }, [visibleVisits, selectedVisit]);

  const normalizeQueue = (value) => {
    const text = (value || "").trim();
    if (!text) return "";
    if (text.includes("queue=")) {
      try {
        const url = new URL(text);
        return url.searchParams.get("queue") || text;
      } catch {
        const match = text.match(/[?&]queue=([^&]+)/i);
        return match ? decodeURIComponent(match[1]) : text;
      }
    }
    return text.toUpperCase();
  };

  const handleSearch = (manualQueue = searchQueue) => {
    setError("");
    const queue = normalizeQueue(manualQueue);
    if (!queue) {
      setError("請輸入排隊號");
      return;
    }

    setSearchQueue(queue);
    const found = visibleVisits.find((v) => (v.queueNo || "").toUpperCase() === queue.toUpperCase());
    if (!found) {
      setError(`找不到排隊號：${queue}`);
      setSelectedVisit(null);
      return;
    }

    setSelectedVisit(found);
  };

  const handleScanQr = async () => {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
      setError("此瀏覽器不支援直接掃碼，請手動輸入排隊號。");
      return;
    }

    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      let stopped = false;

      const scanLoop = async () => {
        if (!videoRef.current || stopped) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0].rawValue || "";
            const queue = normalizeQueue(raw);
            if (queue) {
              stopped = true;
              stopCamera();
              handleSearch(queue);
              return;
            }
          }
        } catch (innerError) {
          console.warn("掃碼中斷", innerError);
        }
        if (!stopped) {
          requestAnimationFrame(scanLoop);
        }
      };

      scanLoop();
    } catch (scanError) {
      console.error("開啟鏡頭失敗", scanError);
      setError("無法開啟相機，請手動輸入排隊號。");
      stopCamera();
    }
  };

  const handleMarkReady = () => {
    if (selectedVisit) {
      onStatusUpdate?.(selectedVisit.id, "ready_for_pickup");
      setError("已標記為「已完成」");
      setTimeout(() => {
        setSearchQueue("");
        setSelectedVisit(null);
        setError("");
      }, 2000);
    }
  };

  const queueProgress = selectedVisit ? getQueueProgress(visibleVisits, selectedVisit.queueNo) : null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>店員查單系統</h2>
          <p style={styles.subtitle}>輸入或掃描排隊號查看客人詳情</p>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#dcfce7", color: "#166534", padding: "8px 12px", borderRadius: 999, fontWeight: 800, fontSize: 12 }}>
          <Zap size={14} />
          即時更新
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12, textAlign: "right" }}>
        最後更新：{lastUpdatedAt.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>

      {/* 搜尋框 */}
      <div style={styles.searchSection}>
        <label style={styles.label}>排隊號</label>
        <div style={styles.searchBox}>
          <input
            type="text"
            value={searchQueue}
            onChange={(e) => setSearchQueue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="例如：FYM-001"
            autoFocus
            style={styles.searchInput}
          />
          <button
            onClick={handleScanQr}
            style={{ ...styles.searchButton, backgroundColor: "#0f766e" }}
          >
            <Camera size={18} />
            掃碼
          </button>
          <button
            onClick={() => handleSearch()}
            style={styles.searchButton}
          >
            <Search size={18} />
            查詢
          </button>
        </div>
      </div>

      {scanning && (
        <div style={{ marginBottom: 16, border: "1px solid #cbd5e1", borderRadius: 12, overflow: "hidden", background: "#111827" }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", maxHeight: 260, display: "block", background: "#000" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: "#111827", color: "#fff", padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <QrCode size={16} />
              <span>掃描客人排隊 QR</span>
            </div>
            <button onClick={stopCamera} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "6px 10px", fontWeight: 700, cursor: "pointer" }}>
              停止
            </button>
          </div>
        </div>
      )}

      {/* 錯誤消息 */}
      {error && (
        <div style={{
          ...styles.messageBox,
          backgroundColor: error.includes("已標記") ? "#ecfdf5" : "#fef3c7",
          borderColor: error.includes("已標記") ? "#10b981" : "#fcd34d",
          color: error.includes("已標記") ? "#059669" : "#92400e",
        }}>
          <AlertCircle size={16} style={{ marginRight: "8px" }} />
          {error}
        </div>
      )}

      {/* 客人詳情 */}
      {selectedVisit && (
        <div style={styles.detailsCard}>
          <div style={styles.detailsHeader}>
            <div>
              <div style={styles.queueNo}>{selectedVisit.queueNo}</div>
              <div style={styles.detailsTitle}>{selectedVisit.guestName}</div>
            </div>
            <div style={styles.status}>{getStatusLabel(selectedVisit.status)}</div>
          </div>

          {queueProgress && (
            <div style={styles.progressBox}>
              <div style={styles.progressTitle}>排隊進度</div>
              <div style={styles.progressValue}>
                {queueProgress.before > 0 ? `前面還有 ${queueProgress.before} 位，現在是第 ${queueProgress.position} 位` : "目前為首位，請立即處理"}
              </div>
            </div>
          )}

          <div style={styles.detailsGrid}>
            <div style={styles.detailItem}>
              <label style={styles.detailLabel}>班級</label>
              <div style={styles.detailValue}>{selectedVisit.className}</div>
            </div>
            <div style={styles.detailItem}>
              <label style={styles.detailLabel}>身高 (cm)</label>
              <div style={styles.detailValue}>{selectedVisit.heightCm || "-"}</div>
            </div>
            <div style={styles.detailItem}>
              <label style={styles.detailLabel}>體重 (kg)</label>
              <div style={styles.detailValue}>{selectedVisit.weightKg || "-"}</div>
            </div>
            <div style={styles.detailItem}>
              <label style={styles.detailLabel}>電話</label>
              <div style={styles.detailValue}>{selectedVisit.phone}</div>
            </div>
            {selectedVisit.notes && (
              <div style={{ ...styles.detailItem, gridColumn: "1 / -1" }}>
                <label style={styles.detailLabel}>備註</label>
                <div style={styles.detailValue}>{selectedVisit.notes}</div>
              </div>
            )}
          </div>

          {/* 執單按鈕 */}
          {!(["READY", "COMPLETED", "SKIPPED", "ready_for_pickup", "completed"].includes(selectedVisit.status)) && (
            <button
              onClick={handleMarkReady}
              style={styles.executeButton}
            >
              <Check size={18} />
              標記已完成
            </button>
          )}
          {(["READY", "COMPLETED", "SKIPPED", "ready_for_pickup", "completed"].includes(selectedVisit.status)) && (
            <div style={{
              ...styles.messageBox,
              backgroundColor: "#ecfdf5",
              borderColor: "#10b981",
              color: "#059669",
              textAlign: "center",
            }}>
              ✓ 此客人已完成，現在可通知取貨
            </div>
          )}
        </div>
      )}

      {/* 待命客人列表 */}
      {!selectedVisit && visibleVisits.length > 0 && (
        <div style={styles.listSection}>
          <div style={styles.listTitle}>待命客人列表</div>
          <div style={styles.visitsList}>
            {visibleVisits.map((visit) => (
              <div
                key={visit.id}
                onClick={() => setSelectedVisit(visit)}
                style={{
                  ...styles.visitItem,
                  backgroundColor: ["READY", "COMPLETED", "ready_for_pickup", "completed"].includes(visit.status) ? "#f0fdf4" : "#fff",
                  borderColor: ["READY", "COMPLETED", "ready_for_pickup", "completed"].includes(visit.status) ? "#86efac" : "#e5e7eb",
                  cursor: "pointer",
                }}
              >
                <div style={styles.visitQueueNo}>{visit.queueNo}</div>
                <div>
                  <div style={styles.visitName}>{visit.guestName}</div>
                  <div style={styles.visitClass}>{visit.className}</div>
                </div>
                <div style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  backgroundColor: ["READY", "COMPLETED", "ready_for_pickup", "completed"].includes(visit.status) ? "#10b981" : "#f3f4f6",
                  color: ["READY", "COMPLETED", "ready_for_pickup", "completed"].includes(visit.status) ? "white" : "#374151",
                  fontSize: "12px",
                  fontWeight: "600",
                }}>
                  {getStatusLabel(visit.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: "16px",
    maxWidth: "600px",
    margin: "0 auto",
  },
  header: {
    textAlign: "center",
    marginBottom: "24px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#1f3a8a",
    margin: "0 0 8px 0",
  },
  subtitle: {
    fontSize: "14px",
    color: "#666",
    margin: 0,
  },
  searchSection: {
    marginBottom: "24px",
  },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "8px",
  },
  searchBox: {
    display: "flex",
    gap: "8px",
  },
  searchInput: {
    flex: 1,
    padding: "12px 16px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "16px",
    fontFamily: "monospace",
  },
  searchButton: {
    padding: "12px 24px",
    backgroundColor: "#1f3a8a",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  messageBox: {
    padding: "12px 16px",
    borderRadius: "8px",
    border: "1px solid",
    fontSize: "14px",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
  },
  progressBox: {
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "10px",
    padding: "12px 14px",
    marginBottom: "16px",
  },
  progressTitle: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#1d4ed8",
    marginBottom: "4px",
  },
  progressValue: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#1e3a8a",
  },
  detailsCard: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #e5e7eb",
    marginBottom: "16px",
  },
  detailsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "16px",
    paddingBottom: "16px",
    borderBottom: "1px solid #e5e7eb",
  },
  queueNo: {
    fontSize: "32px",
    fontWeight: "bold",
    color: "#1f3a8a",
    fontFamily: "monospace",
    letterSpacing: "2px",
  },
  detailsTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#374151",
    marginTop: "8px",
  },
  status: {
    padding: "8px 12px",
    backgroundColor: "#f3f4f6",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
    marginBottom: "16px",
  },
  detailItem: {
    backgroundColor: "#f9fafb",
    padding: "12px",
    borderRadius: "8px",
  },
  detailLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: "4px",
  },
  detailValue: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#1f2937",
  },
  executeButton: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#10b981",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  listSection: {
    marginTop: "24px",
  },
  listTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "12px",
  },
  visitsList: {
    display: "grid",
    gap: "8px",
  },
  visitItem: {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  visitQueueNo: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#1f3a8a",
    fontFamily: "monospace",
    minWidth: "80px",
  },
  visitName: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#1f2937",
  },
  visitClass: {
    fontSize: "12px",
    color: "#6b7280",
  },
};

export default StaffOrderTracking;
