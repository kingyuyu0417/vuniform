import React, { useEffect, useMemo, useState } from "react";
import { Clock3, Users } from "lucide-react";
import { queueOrderService, ORDER_STATUS } from "../services/queueOrderService";

const statusLabel = {
  [ORDER_STATUS.PENDING]: "排隊中",
  [ORDER_STATUS.PREPARING]: "待執貨",
  [ORDER_STATUS.READY]: "已執好",
  [ORDER_STATUS.COMPLETED]: "已完成",
  [ORDER_STATUS.SKIPPED]: "已過號",
};

export default function GuestQueueStatusPage({ queueNo: queueNoProp, schoolName = "", schools = [] }) {
  const [queueNo, setQueueNo] = useState(queueNoProp || new URLSearchParams(window.location.search).get("id") || new URLSearchParams(window.location.search).get("queue") || "");
  const [activeSchool, setActiveSchool] = useState(schoolName || new URLSearchParams(window.location.search).get("school_id") || "");
  const [lookupQueueNo, setLookupQueueNo] = useState(queueNo || "");
  const [lookupPhoneLast4, setLookupPhoneLast4] = useState("");
  const [lookupSchool, setLookupSchool] = useState(activeSchool);
  const [lookupSchoolText, setLookupSchoolText] = useState(activeSchool);
  const [lookupError, setLookupError] = useState("");
  const isSchoolLocked = Boolean(activeSchool);
  const [guest, setGuest] = useState(null);

  const refreshStatus = async () => {
    const schoolId = activeSchool || new URLSearchParams(window.location.search).get("school") || "";
    const result = await queueOrderService.getPublicQueueStatus({ schoolId, queueNumber: queueNo });
    setGuest(result);
  };

  useEffect(() => {
    if (!queueNo) return;
    refreshStatus();
    const schoolId = activeSchool || new URLSearchParams(window.location.search).get("school") || "";
    const timer = window.setInterval(() => refreshStatus().catch(() => {}), 5000);
    return () => window.clearInterval(timer);
  }, [queueNo, activeSchool]);

  const queuePosition = useMemo(() => guest?.queue_position ?? null, [guest]);

  if (!queueNo) {
    return (
      <div style={{ maxWidth: 540, margin: "32px auto", padding: 20, textAlign: "center" }}>
        <h2 style={{ marginBottom: 12 }}>重新查詢排隊狀態</h2>
        <p style={{ color: "#4b5563" }}>如已關閉查詢頁，請輸入排隊號及選擇學校。</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const schoolValue = lookupSchool || lookupSchoolText.trim();
            const queueValue = lookupQueueNo.trim();
            const phoneValue = lookupPhoneLast4.replace(/\D/g, "");
            if ((!queueValue && phoneValue.length !== 4) || !schoolValue) {
              setLookupError("請輸入排隊號，或輸入電話最後 4 位數字。");
              return;
            }
            const matched = await queueOrderService.getPublicQueueStatus({
              schoolId: schoolValue,
              queueNumber: queueValue,
              phoneLast4: phoneValue,
            });
            if (!matched) {
              setLookupError("找不到相符的今日排隊資料，請檢查輸入內容。");
              return;
            }
            setLookupError("");
            setActiveSchool(schoolValue);
            setQueueNo(matched.queue_number);
          }}
          style={{ display: "grid", gap: 10, textAlign: "left", marginTop: 18 }}
        >
          <input value={lookupQueueNo} onChange={(event) => { setLookupQueueNo(event.target.value); setLookupPhoneLast4(""); setLookupError(""); }} placeholder="排隊號，例如：香-001（可留空）" style={{ padding: 10, border: "1px solid #D5DDE5", borderRadius: 8 }} />
          <input value={lookupPhoneLast4} onChange={(event) => { setLookupPhoneLast4(event.target.value.replace(/\D/g, "").slice(-4)); setLookupQueueNo(""); setLookupError(""); }} inputMode="numeric" maxLength={4} placeholder="或輸入電話最後 4 位" style={{ padding: 10, border: "1px solid #D5DDE5", borderRadius: 8 }} />
          {isSchoolLocked ? (
            <div style={{ padding: 10, border: "1px solid #D5DDE5", borderRadius: 8, background: "#F7F7F5", color: "#1F3A5F", fontWeight: 700 }}>
              查詢學校：{activeSchool}
            </div>
          ) : (
            <>
              <select value={lookupSchool} onChange={(event) => { setLookupSchool(event.target.value); setLookupSchoolText(event.target.value); }} style={{ padding: 10, border: "1px solid #D5DDE5", borderRadius: 8, background: "#fff" }}>
                <option value="">請選擇學校</option>
                {schools.map((schoolOption) => <option key={schoolOption} value={schoolOption}>{schoolOption}</option>)}
              </select>
              <input value={lookupSchoolText} onChange={(event) => { setLookupSchoolText(event.target.value); setLookupSchool(""); }} placeholder="或直接輸入學校名稱" style={{ padding: 10, border: "1px solid #D5DDE5", borderRadius: 8 }} />
            </>
          )}
          {lookupError && <div style={{ color: "#b91c1c", fontSize: 13 }}>{lookupError}</div>}
          <button type="submit" style={{ background: "#1F3A5F", color: "#fff", border: "none", borderRadius: 8, padding: 11, fontWeight: 700 }}>查詢排隊狀態</button>
        </form>
      </div>
    );
  }

  const statusText = guest?.status ? statusLabel[guest.status] || guest.status : "排隊中";

  return (
    <div style={{ maxWidth: 720, margin: "32px auto", padding: 20, display: "grid", gap: 18 }}>
      <div style={{ background: "#F7F7F5", borderRadius: 16, padding: 20, border: "1px solid #E2E8F0" }}>
        <div style={{ fontSize: 13, color: "#52627A", marginBottom: 8 }}>客人單 / 排隊狀態</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: 2, color: "#1F3A5F", fontFamily: "monospace" }}>
            {queueNo}
          </div>
          <div style={{ background: guest?.status === ORDER_STATUS.READY ? "#dcfce7" : "#e0f2fe", color: guest?.status === ORDER_STATUS.READY ? "#166534" : "#075985", padding: "8px 12px", borderRadius: 999, fontWeight: 700 }}>
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
            {queuePosition !== null ? `前面還有 ${Math.max(queuePosition - 1, 0)} 位，您現在是第 ${queuePosition} 位` : "目前排隊資料尚未更新"}
          </span>
        </div>

      </div>

    </div>
  );
}

