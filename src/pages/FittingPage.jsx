import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  Clock3,
  QrCode,
  SkipForward,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { queueOrderService, ORDER_STATUS } from "../services/queueOrderService";
import { supabase, isSupabaseConfigured } from "../supabaseClient";

const STORAGE_DRAFT_KEY = "uniform-pos-fitting-drafts";

const getSafeOrder = (order) => ({
  ...order,
  customer_info: order.customer_info || order.customerInfo || {},
  tailor_info: order.tailor_info || order.tailorInfo || {},
  queue_number: order.queue_number || order.queueNumber || "",
  status: order.status || ORDER_STATUS.PENDING,
});

const readDrafts = () => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_DRAFT_KEY) || "{}");
  } catch {
    return {};
  }
};

const writeDrafts = (drafts) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(drafts));
};

const defaultProducts = [
  { id: "shirt-short", name: "白色短袖恤衫", sizes: ["24", "26", "28", "30", "32", "34", "36", "38", "40"] },
  { id: "shirt-long", name: "白色長袖恤衫", sizes: ["24", "26", "28", "30", "32", "34", "36", "38", "40"] },
  { id: "short-pants", name: "藏青色短褲", sizes: ["24", "26", "28", "30", "32", "34"] },
  { id: "skirt", name: "校裙", sizes: ["XS", "S", "M", "L", "XL"] },
  { id: "pe-set", name: "PE 運動套裝", sizes: ["XS", "S", "M", "L", "XL"] },
  { id: "blazer", name: "校褸", sizes: ["S", "M", "L", "XL", "XXL"] },
];

const emptySelection = { productId: "", size: "", quantity: 1 };

export default function FittingPage({ currentSchoolId = "", products = defaultProducts, selectedOrderId = "", onStatusChange }) {
  const safeProducts = Array.isArray(products) ? products.filter(Boolean) : [];
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selection, setSelection] = useState([{ ...emptySelection }]);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanText, setScanText] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date());

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const safeSetSelectedOrder = (order) => {
    if (!order || typeof order !== "object") {
      setSelectedOrder(null);
      return;
    }

    setSelectedOrder(getSafeOrder(order));
  };

  const syncOrders = async () => {
    setLoadError("");

    if (!queueOrderService || typeof queueOrderService.listOrders !== "function") {
      setLoadError("排隊服務不可用，請重新整理頁面後再試。");
      setOrders([]);
      setSelectedOrder(null);
      return;
    }

    try {
      const allRows = await queueOrderService.listOrders();
      const normalizedAll = Array.isArray(allRows) ? allRows.filter(Boolean).map(getSafeOrder) : [];
      const schoolKey = String(currentSchoolId || "").trim();
      
      // 先按學校過濾（不過濾狀態）
      const schoolFiltered = schoolKey
        ? normalizedAll.filter((row) => {
            const rowSchool = String(row.school_id || row.schoolId || "").trim();
            return rowSchool === schoolKey;
          })
        : normalizedAll;

      // 只在 orders state 中保留 PENDING 訂單
      const pendingRows = schoolFiltered.filter((row) => row.status === ORDER_STATUS.PENDING);
      setOrders(pendingRows);
      setLastUpdatedAt(new Date());

      const matchByTarget = (row) => {
        const target = String(selectedOrderId || "").trim();
        if (!target) return false;
        return (
          row.id === selectedOrderId ||
          row.id === target ||
          row.queue_number === target ||
          row.queueNumber === target ||
          String(row.queue_number || row.queueNumber || "").toUpperCase() === target.toUpperCase()
        );
      };

      if (selectedOrderId) {
        // 先在學校過濾的訂單中查找（包括所有狀態）
        const directMatch = schoolFiltered.find(matchByTarget);
        // 如果沒找到，在所有訂單中查找
        const fallbackMatch = directMatch || normalizedAll.find(matchByTarget);

        if (fallbackMatch) {
          // 只有 PENDING 狀態的訂單才能在 Fitting 頁面操作
          if (fallbackMatch.status === ORDER_STATUS.PENDING) {
            safeSetSelectedOrder(fallbackMatch);
            setNotice("");
          } else {
            setNotice(`此訂單狀態為 ${fallbackMatch.status}，無法在度身頁面編輯`);
          }
          return;
        }

        // 診斷信息：提供更多細節幫助排查
        console.warn("FittingPage: selectedOrderId not found", {
          selectedOrderId,
          currentSchoolId,
          schoolKey,
          totalOrders: normalizedAll.length,
          schoolFilteredOrders: schoolFiltered.length,
          pendingOrders: pendingRows.length,
          allOrderIds: normalizedAll.map(o => ({ id: o.id, queueNo: o.queue_number, status: o.status, school: o.school_id })),
        });

        setNotice("找不到此訂單，請返回排隊頁重新選擇客人。");
        return;
      }

      // 自動選擇第一個 PENDING 訂單
      safeSetSelectedOrder(pendingRows[0] ? getSafeOrder(pendingRows[0]) : null);
      if (pendingRows[0]) setNotice("");
    } catch (error) {
      console.error("FittingPage syncOrders failed", error);
      setOrders([]);
      setSelectedOrder(null);
      setLoadError("目前無法載入排隊資料，請確認網絡或資料來源正常後重試。");
    }
  };

  useEffect(() => {
    syncOrders();

    if (!queueOrderService || typeof queueOrderService.subscribe !== "function") {
      return undefined;
    }

    try {
      const unsub = queueOrderService.subscribe({
        schoolId: currentSchoolId,
        onChange: (rows) => {
          try {
            const normalized = (Array.isArray(rows) ? rows : []).map(getSafeOrder);
            const schoolKey = String(currentSchoolId || "").trim();
            const filtered = schoolKey
              ? normalized.filter((order) => String(order.school_id || order.schoolId || "").trim() === schoolKey)
              : normalized;
            
            // 只保留 PENDING 訂單（其他狀態應該由其他頁面處理）
            const pendingOnly = filtered.filter((order) => order.status === ORDER_STATUS.PENDING);
            setOrders(pendingOnly);
            setLastUpdatedAt(new Date());

            if (selectedOrder) {
              const next = pendingOnly.find((o) => o.id === selectedOrder.id);
              safeSetSelectedOrder(next || null);
            } else if (pendingOnly.length) {
              safeSetSelectedOrder(pendingOnly[0]);
            }
          } catch (innerError) {
            console.error("FittingPage subscription update failed", innerError);
          }
        },
      });

      return () => {
        if (unsub && typeof unsub.unsubscribe === "function") {
          unsub.unsubscribe();
        }
      };
    } catch (error) {
      console.error("FittingPage subscribe failed", error);
      return undefined;
    }
  }, [currentSchoolId]);

  // 當 selectedOrderId 改變時重新嘗試查找（處理異步加載延遲）
  useEffect(() => {
    if (!selectedOrderId || selectedOrder) return;

    // 延遲重試，確保訂單數據已被加載
    const timer = setTimeout(() => {
      syncOrders();
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedOrderId]);

  useEffect(() => {
    const drafts = readDrafts();
    const saved = currentSchoolId ? drafts[currentSchoolId]?.[selectedOrder?.id] : null;
    if (saved && Array.isArray(saved.items)) {
      setSelection(saved.items);
    } else {
      setSelection([{ ...emptySelection }]);
    }
  }, [selectedOrder, currentSchoolId]);

  useEffect(() => () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  }, []);

  const ticketOptions = useMemo(() => {
    return orders
      .filter((o) => o.status === ORDER_STATUS.PENDING)
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  }, [orders]);

  const activeOrder = selectedOrder || ticketOptions[0] || null;

  const handleSelectOrder = (order) => {
    if (!order) return;
    safeSetSelectedOrder(order);
    setNotice("");
    const drafts = readDrafts();
    const saved = drafts[currentSchoolId]?.[order.id];
    if (saved?.items) {
      setSelection(saved.items);
    } else {
      setSelection([{ ...emptySelection }]);
    }
  };

  const handleScanValue = async (rawValue) => {
    const cleaned = String(rawValue || "").trim();
    if (!cleaned) return;

    try {
      const found = orders.find((o) => (o.queue_number || "").toUpperCase() === cleaned.toUpperCase());
      if (found) {
        safeSetSelectedOrder(found);
        setScanOpen(false);
        setScanText("");
        setCameraReady(false);
        return;
      }

      if (!queueOrderService || typeof queueOrderService.listOrders !== "function") {
        setNotice("掃碼查詢服務未可用，請稍後再試");
        return;
      }

      const rows = await queueOrderService.listOrders({ schoolId: currentSchoolId });
      const fallback = (Array.isArray(rows) ? rows : []).find((o) => (o.queue_number || o.queueNumber || "").toUpperCase() === cleaned.toUpperCase());
      if (fallback) {
        safeSetSelectedOrder(fallback);
        setScanOpen(false);
        setScanText("");
        setCameraReady(false);
        return;
      }

      setNotice("找不到此排隊號，請確認學校或號碼正確");
    } catch (error) {
      console.error("FittingPage handleScanValue failed", error);
      setNotice("掃碼查詢失敗，請檢查資料來源或手動輸入排隊號");
    }
  };

  const startCameraScan = async () => {
    setScanOpen(true);
    setCameraError("");
    setCameraReady(false);

    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("目前瀏覽器不支援相機掃碼，請手動輸入排隊號");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13"] });
      const tick = async () => {
        if (!scanOpen || !videoRef.current || !streamRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes[0]?.rawValue) {
            await handleScanValue(barcodes[0].rawValue);
            return;
          }
        } catch {
          // ignore camera detection errors here
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      setCameraReady(true);
    } catch (error) {
      setCameraError("相機未開啟，請手動輸入排隊號");
      console.error("FittingPage camera init failed", error);
    }
  };

  const stopCameraScan = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanOpen(false);
    setCameraReady(false);
  };

  const updateSelection = (index, patch) => {
    setSelection((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      try {
        const drafts = readDrafts();
        const base = drafts[currentSchoolId] || {};
        base[selectedOrder?.id] = { items: next };
        drafts[currentSchoolId] = base;
        writeDrafts(drafts);
      } catch (error) {
        console.error("FittingPage draft save failed", error);
      }
      return next;
    });
  };

  const addItem = () => setSelection((prev) => [...prev, { ...emptySelection }]);

  const removeItem = (index) => {
    setSelection((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [{ ...emptySelection }];
    });
  };

  const handleSubmit = async () => {
    const current = activeOrder || selectedOrder;
    if (!current?.id) {
      setNotice("請先選擇客人");
      return;
    }

    const validRows = Array.isArray(selection)
      ? selection.filter((row) => row && row.productId && row.size)
      : [];

    const nextItems = validRows.map((row) => {
      const product = safeProducts.find((p) => p.id === row.productId);
      const selectedSize = Array.isArray(product?.sizes) ? product.sizes.find((sizeOption) => {
        const size = typeof sizeOption === "object" ? sizeOption.size : sizeOption;
        const length = typeof sizeOption === "object" ? sizeOption.length || "" : "";
        return String(size) === String(row.size) && length === (row.length || "");
      }) : null;

      return {
        product_id: row.productId,
        product_name: product?.name || "未知產品",
        size: row.size,
        length: row.length || "",
        price: Number(selectedSize?.price || 0),
        quantity: Number(row.quantity || 1),
      };
    }).filter((row) => row.product_id && row.size && Number(row.price || 0) >= 0);

    if (!nextItems.length) {
      setNotice("請至少選擇一個款式與尺碼");
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setNotice("資料更新服務不可用，請稍後再試");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        tailor_info: {
          customer_name: current.customer_info?.guestName || current.guestName || "",
          queue_number: current.queue_number || current.queueNumber || current.queueNo || "",
          items: nextItems,
          prepared_at: new Date().toISOString(),
        },
      };

      const result = getSafeOrder(await queueOrderService.updateStatus(current.id, "PREPARING", {
        tailor_info: payload.tailor_info,
      }));
      if (!result?.id) throw new Error("訂單未成功更新");
      onStatusChange?.(result || current);
      setOrders((prev) => (Array.isArray(prev) ? prev.filter((order) => order && order.id !== current.id) : []));
      setNotice("已更新為 PREPARING，等待倉務執貨");

      const drafts = readDrafts();
      const schoolDrafts = drafts[currentSchoolId] || {};
      delete schoolDrafts[current.id];
      drafts[currentSchoolId] = schoolDrafts;
      writeDrafts(drafts);

      setSelection([{ ...emptySelection }]);
      const remaining = (Array.isArray(orders) ? orders : []).filter((order) => order && order.id !== current.id && order.status === ORDER_STATUS.PENDING);
      safeSetSelectedOrder(remaining[0] ? getSafeOrder(remaining[0]) : null);
    } catch (error) {
      console.error("FittingPage submit failed", error);
      try {
        const drafts = readDrafts();
        const schoolDrafts = drafts[currentSchoolId] || {};
        schoolDrafts[current.id] = { items: Array.isArray(selection) ? selection : [{ ...emptySelection }] };
        drafts[currentSchoolId] = schoolDrafts;
        writeDrafts(drafts);
      } catch (draftError) {
        console.error("FittingPage draft save failed after submit error", draftError);
      }
      setNotice("提交失敗，已安全暫存草稿，請稍後再試");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!activeOrder) return;
    try {
      if (!queueOrderService || typeof queueOrderService.updateStatus !== "function") {
        setNotice("過號功能目前不可用，請稍後再試");
        return;
      }

      await queueOrderService.updateStatus(activeOrder.id, ORDER_STATUS.SKIPPED, {
        tailor_info: {
          ...(activeOrder.tailor_info || {}),
          skipped_at: new Date().toISOString(),
          skipped_reason: "未到場",
        },
      });
      setNotice("已標記為 SKIPPED，隊伍已繼續");
      onStatusChange?.({ id: activeOrder.id, status: ORDER_STATUS.SKIPPED });
      setOrders((prev) => prev.filter((order) => order.id !== activeOrder.id));
      const drafts = readDrafts();
      const schoolDrafts = drafts[currentSchoolId] || {};
      delete schoolDrafts[activeOrder.id];
      drafts[currentSchoolId] = schoolDrafts;
      writeDrafts(drafts);
      setSelection([{ ...emptySelection }]);
      safeSetSelectedOrder(null);
    } catch (error) {
      console.error("FittingPage skip failed", error);
      setNotice("過號暫存成功，恢復後會自動同步");
    }
  };

  if (loadError) {
    return (
      <div style={styles.errorStateWrap}>
        <div style={styles.errorCard}>
          <div style={styles.errorTitle}>資料載入異常</div>
          <div style={styles.errorText}>{loadError}</div>
          <button style={styles.retryButton} onClick={() => syncOrders()}>
            重新整理
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>同事 1 / 度身崗位</div>
          <div style={styles.title}>Fitting Queue</div>
        </div>
        <button className="pos-btn" style={styles.primaryButton} onClick={startCameraScan}>
          <Camera size={16} />
          掃碼
        </button>
      </div>

      {notice && <div style={styles.notice}>{notice}</div>}

      <div style={styles.row}>
        {ticketOptions.map((order) => (
          <button
            key={order.id}
            onClick={() => handleSelectOrder(order)}
            style={{
              ...styles.queueChip,
              background: activeOrder?.id === order.id ? "#1f3a5f" : "#fff",
              color: activeOrder?.id === order.id ? "#fff" : "#1f3a5f",
              borderColor: activeOrder?.id === order.id ? "#1f3a5f" : "#dfe7f1",
            }}
          >
            {order.queue_number || "未分配"} · {order.customer_info?.guestName || "客人"}
          </button>
        ))}
      </div>

      {activeOrder ? (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.smallLabel}>顧客資料</div>
              <div style={styles.valueText}>
                {activeOrder.customer_info?.guestName || "顧客"} · {activeOrder.queue_number}
              </div>
            </div>
            <button className="pos-btn" style={styles.warningButton} onClick={handleSkip}>
              <SkipForward size={15} />
              過號
            </button>
          </div>

          <div style={styles.metaGrid}>
            <div style={styles.metaBox}>
              <UserRound size={14} />
              {activeOrder.customer_info?.phone || "電話未填"}
            </div>
            <div style={styles.metaBox}>
              <Clock3 size={14} />
              {activeOrder.status}
            </div>
          </div>

          {selection.map((item, index) => {
            const selectedProduct = products.find((p) => p.id === item.productId);
            return (
              <div key={`${item.productId || "new"}-${index}`} style={styles.itemCard}>
                <div style={styles.itemTop}>
                  <span style={styles.itemIndex}>款式 {index + 1}</span>
                  {selection.length > 1 && (
                    <button style={styles.removeBtn} onClick={() => removeItem(index)}>
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div style={styles.productGrid}>
                  {safeProducts.map((product) => (
                    <button
                      key={product.id}
                      className="pos-btn"
                      onClick={() => updateSelection(index, { productId: item.productId === product.id ? "" : product.id, size: "" })}
                      style={{
                        ...styles.productBtn,
                        background: item.productId === product.id ? "#1F3A5F" : "#f8fafc",
                        color: item.productId === product.id ? "#fff" : "#24364d",
                        borderColor: item.productId === product.id ? "#1F3A5F" : "#dfe7f1",
                      }}
                    >
                      {product.name}
                    </button>
                  ))}
                </div>

                {selectedProduct && (
                  <div style={styles.sizeGrid}>
                    {(Array.isArray(selectedProduct.sizes) ? selectedProduct.sizes : []).map((sizeOption) => {
                      const size = typeof sizeOption === "object" ? sizeOption.size : sizeOption;
                      if (!size) return null;
                      return (
                      <button
                        key={size}
                        className="pos-btn"
                        onClick={() => updateSelection(index, { size: item.size === size ? "" : size })}
                        style={{
                          ...styles.sizeBtn,
                          background: item.size === size ? "#1f3a5f" : "#fff",
                          color: item.size === size ? "#fff" : "#24364d",
                          borderColor: item.size === size ? "#1f3a5f" : "#dfe7f1",
                        }}
                      >
                        {size}
                      </button>
                      );
                    })}
                  </div>
                )}

                <div style={styles.qtyRow}>
                  <label style={styles.label}>數量</label>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity || 1}
                    onChange={(e) => updateSelection(index, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                    style={styles.input}
                  />
                </div>
              </div>
            );
          })}

          <div style={styles.footerActions}>
            <button className="pos-btn" style={styles.secondaryButton} onClick={addItem}>
              + 新增款式
            </button>
            <button
              className="pos-btn"
              style={{
                ...styles.primaryButton,
                opacity: isSubmitting ? 0.7 : 1,
              }}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              <Check size={16} />
              {isSubmitting ? "提交中..." : "提交為 PREPARING"}
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.empty}>目前沒有待處理客人</div>
      )}

      {scanOpen && (
        <div style={styles.modal}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>掃描客人 QR</div>
              <button style={styles.closeBtn} onClick={stopCameraScan}>
                <X size={16} />
              </button>
            </div>

            {!cameraReady && !cameraError && <div style={styles.cameraPlaceholder}>開啟相機中…</div>}
            {cameraError && <div style={styles.errorBox}>{cameraError}</div>}

            <video ref={videoRef} style={styles.camera} autoPlay playsInline muted />

            <div style={styles.inlineInputWrap}>
              <QrCode size={14} />
              <input
                value={scanText}
                onChange={(e) => setScanText(e.target.value)}
                placeholder="手動輸入排隊號，如 A-001"
                style={styles.inlineInput}
              />
            </div>

            <div style={styles.modalActions}>
              <button className="pos-btn" style={styles.secondaryButton} onClick={() => handleScanValue(scanText)}>
                立即查詢
              </button>
              <button className="pos-btn" style={styles.primaryButton} onClick={stopCameraScan}>
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { display: "grid", gap: 16, padding: 8 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#f7f8fb",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 16,
  },
  kicker: { fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.2 },
  title: { fontSize: 26, fontWeight: 800, color: "#1f3a5f", marginTop: 4 },
  primaryButton: {
    background: "#1F3A5F",
    color: "#fff",
    border: "1px solid #1F3A5F",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    boxShadow: "none",
  },
  warningButton: {
    background: "#FEE2E2",
    color: "#B91C1C",
    border: "1px solid #F8C7C7",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#EDF2F7",
    color: "#1F3A5F",
    border: "1px solid #D9E3F0",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  row: { display: "flex", flexWrap: "wrap", gap: 8 },
  queueChip: {
    border: "1px solid #dfe7f1",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
    display: "grid",
    gap: 14,
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  smallLabel: { fontSize: 12, color: "#64748b", marginBottom: 4, fontWeight: 600 },
  valueText: { fontSize: 20, fontWeight: 800, color: "#1f2937" },
  metaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 },
  metaBox: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: "10px 12px",
    color: "#334155",
    fontSize: 13,
    fontWeight: 600,
  },
  itemCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 12,
  },
  itemTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  itemIndex: { fontSize: 13, fontWeight: 700, color: "#1f3a5f" },
  removeBtn: {
    background: "#fff",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 8,
    width: 28,
    height: 28,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },
  productGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 },
  productBtn: {
    border: "1px solid #dfe7f1",
    borderRadius: 10,
    padding: "10px 8px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
  },
  sizeGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  sizeBtn: {
    border: "1px solid #dfe7f1",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  qtyRow: { display: "grid", gap: 8, marginTop: 2 },
  label: { fontSize: 12, fontWeight: 700, color: "#475569" },
  input: {
    width: "100%",
    border: "1px solid #dfe7f1",
    background: "#fff",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    boxSizing: "border-box",
  },
  footerActions: { display: "flex", gap: 10 },
  empty: {
    background: "#f8fafc",
    border: "1px solid #dfe7f1",
    borderRadius: 16,
    padding: 20,
    color: "#475569",
    textAlign: "center",
    fontWeight: 700,
  },
  errorStateWrap: {
    display: "grid",
    placeItems: "center",
    minHeight: "40vh",
    padding: 20,
  },
  errorCard: {
    width: "min(520px, 92vw)",
    background: "#fff",
    border: "1px solid #fecaca",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    display: "grid",
    gap: 12,
    textAlign: "center",
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#7f1d1d",
  },
  errorText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 1.6,
  },
  retryButton: {
    background: "#b91c1c",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "11px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  notice: {
    background: "#ecfdf5",
    color: "#065f46",
    border: "1px solid #a7f3d0",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 700,
  },
  modal: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.6)",
    display: "grid",
    placeItems: "center",
    zIndex: 50,
    padding: 16,
  },
  modalCard: {
    width: "min(520px, 92vw)",
    background: "#fff",
    borderRadius: 18,
    padding: 16,
    display: "grid",
    gap: 12,
  },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: 800, color: "#1f3a5f" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid #dfe7f1",
    background: "#f8fafc",
    cursor: "pointer",
  },
  cameraPlaceholder: {
    height: 220,
    display: "grid",
    placeItems: "center",
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    color: "#64748b",
    background: "#f8fafc",
    fontWeight: 700,
  },
  camera: {
    width: "100%",
    maxHeight: 260,
    borderRadius: 14,
    background: "#0f172a",
    objectFit: "cover",
    border: "1px solid #1e293b",
  },
  inlineInputWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #dfe7f1",
    background: "#f8fafc",
    borderRadius: 10,
    padding: "10px 12px",
    color: "#64748b",
  },
  inlineInput: { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: 14, color: "#0f172a" },
  modalActions: { display: "flex", gap: 10, justifyContent: "flex-end" },
  errorBox: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 700,
  },
};
