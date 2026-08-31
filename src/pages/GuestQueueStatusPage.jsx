import React, { useEffect, useMemo, useState } from "react";
import qrcodeGenerator from "qrcode-generator";
import { Clock3, Copy, QrCode, Users } from "lucide-react";
import { guestVisits } from "../services/customerFlowService";

const STORAGE_KEY = "uniform_pos_guest_visits";

const statusLabel = {
  waiting: "等待中",
  assigned: "已分配",
  fitting: "度身中",
  selected: "已選款",
  ready_for_pickup: "可取貨",
  completed: "已完成",
};

const readQueueVisits = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("讀取排隊資料失敗", error);
    return [];
  }
};

const getQueuePosition = (queueList, targetQueueNo) => {
  if (!targetQueueNo || !queueList.length) return null;
  const sorted = [...queueList]
    .filter((item) => item.queueNo && item.status !== "completed")
    .sort((a, b) => new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0));

  const targetIndex = sorted.findIndex((item) => item.queueNo === targetQueueNo);
  if (targetIndex === -1) return null;

  return {
    current: targetIndex + 1,
    before: Math.max(targetIndex, 0),
  };
};

export default function GuestQueueStatusPage({ queueNo: queueNoProp, schoolName = "" }) {
  const [queueNo, setQueueNo] = useState(queueNoProp || new URLSearchParams(window.location.search).get("queue") || "");
  const [guest, setGuest] = useState(null);
  const [queueList, setQueueList] = useState([]);
  const [qrCode, setQrCode] = useState("");
  const [copied, setCopied] = useState(false);

  const refreshStatus = async () => {
    try {
      const visits = await guestVisits.listAll();
      const effectiveVisits = Array.isArray(visits) && visits.length > 0 ? visits : readQueueVisits();
      setQueueList(effectiveVisits);
      const matched = effectiveVisits.find((visit) => (visit.queueNo || visit.queue_no) === queueNo);
      setGuest(matched || null);
    } catch (error) {
      console.error("載入客人排隊狀態失敗", error);
      const visits = readQueueVisits();
      setQueueList(visits);
      const matched = visits.find((visit) => (visit.queueNo || visit.queue_no) === queueNo);
      setGuest(matched || null);
    }
  };

  useEffect(() => {
    if (!queueNo) return;
    refreshStatus();
    const timer = setInterval(refreshStatus, 5000);
    return () => clearInterval(timer);
  }, [queueNo]);

  useEffect(() => {
    if (!queueNo) return;
    const url = `${window.location.origin}?queue=${encodeURIComponent(queueNo)}`;
    try {
      const qr = qrcodeGenerator(0, "M");
      qr.addData(url);
      qr.make();
      setQrCode(qr.createDataURL(10));
    } catch (error) {
      console.error("客人專屬 QR 生成失敗:", error);
    }
  }, [queueNo]);

  const queuePosition = useMemo(() => getQueuePosition(queueList, queueNo), [queueList, queueNo]);

  const handleCopyQueue = async () => {
    if (!queueNo) return;
    try {
      await navigator.clipboard.writeText(queueNo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("複製排隊號失敗", error);
    }
  };

  if (!queueNo) {
    return (
      <div style={{ maxWidth: 540, margin: "32px auto", padding: 20, textAlign: "center" }}>
        <h2 style={{ marginBottom: 12 }}>查無排隊號</h2>
        <p style={{ color: "#4b5563" }}>請確認連結中包含正確的 queue 參數。</p>
      </div>
    );
  }

  const statusText = guest?.status ? statusLabel[guest.status] || guest.status : "等待中";

  return (
    <div style={{ maxWidth: 720, margin: "32px auto", padding: 20, display: "grid", gap: 18 }}>
      <div style={{ background: "#F7F7F5", borderRadius: 16, padding: 20, border: "1px solid #E2E8F0" }}>
        <div style={{ fontSize: 13, color: "#52627A", marginBottom: 8 }}>客人單 / 排隊狀態</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: 2, color: "#1F3A5F", fontFamily: "monospace" }}>
            {queueNo}
          </div>
          <div style={{
            background: guest?.status === "ready_for_pickup" ? "#dcfce7" : "#e0f2fe",
            color: guest?.status === "ready_for_pickup" ? "#166534" : "#075985",
            padding: "8px 12px",
            borderRadius: 999,
            fontWeight: 700,
          }}>
            {statusText}
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, color: "#374151" }}>
          <Clock3 size={18} />
          <span>最新狀態：{statusText}</span>
        </div>

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, color: "#374151" }}>
          <Users size={18} />
          <span>
            {queuePosition ? `前面還有 ${queuePosition.before} 位，您現在是第 ${queuePosition.current} 位` : "目前排隊資料尚未更新"}
          </span>
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={handleCopyQueue}
            style={{
              background: "#1F3A5F",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Copy size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
            {copied ? "已複製" : "複製排隊號"}
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #E2E8F0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontWeight: 700, color: "#1F3A5F" }}>
          <QrCode size={18} />
          我的專屬單據 QR CODE
        </div>
        {qrCode ? (
          <div style={{ display: "grid", placeItems: "center" }}>
            <img src={qrCode} alt="Guest QR code" style={{ width: 180, height: 180, background: "#f3f4f6", padding: 12, borderRadius: 12 }} />
          </div>
        ) : (
          <div style={{ color: "#6b7280" }}>QR Code 生成中…</div>
        )}
      </div>

      {guest && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #E2E8F0" }}>
          <div style={{ fontWeight: 700, color: "#1F3A5F", marginBottom: 14 }}>我的資料</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div><div style={{ fontSize: 12, color: "#6b7280" }}>姓名</div><div style={{ fontWeight: 700 }}>{guest.guestName || guest.guest_name || "-"}</div></div>
            <div><div style={{ fontSize: 12, color: "#6b7280" }}>班級</div><div style={{ fontWeight: 700 }}>{guest.className || guest.class_name || "-"}</div></div>
            <div><div style={{ fontSize: 12, color: "#6b7280" }}>身高</div><div style={{ fontWeight: 700 }}>{guest.heightCm || guest.height_cm || "-"}</div></div>
            <div><div style={{ fontSize: 12, color: "#6b7280" }}>體重</div><div style={{ fontWeight: 700 }}>{guest.weightKg || guest.weight_kg || "-"}</div></div>
            <div><div style={{ fontSize: 12, color: "#6b7280" }}>電話</div><div style={{ fontWeight: 700 }}>{guest.phone || "-"}</div></div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, color: "#4b5563", textAlign: "center" }}>
        {schoolName ? `學校：${schoolName}` : "校園登記系統"}
      </div>
    </div>
  );
}
