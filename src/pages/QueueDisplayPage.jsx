import React, { useEffect, useState } from "react";
import { QrCode, Users, Volume2 } from "lucide-react";
import qrcodeGenerator from "qrcode-generator";
import { ORDER_STATUS, queueOrderService } from "../services/queueOrderService";

const activeStatuses = [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING, ORDER_STATUS.READY];

export default function QueueDisplayPage({ schoolName = "", outletName = "", counterName = "main" }) {
  const [counter, setCounter] = useState(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [qrCode, setQrCode] = useState("");
  const [isCalling, setIsCalling] = useState(false);

  useEffect(() => {
    let active = true;
    const updateOrders = (orders) => {
      if (!active) return;
      setWaitingCount((orders || []).filter((order) => activeStatuses.includes(order.status)).length);
    };
    queueOrderService.listOrders({ schoolId: schoolName }).then(updateOrders).catch(() => {});
    const ordersSubscription = queueOrderService.subscribe({ schoolId: schoolName, onChange: updateOrders });
    const counterSubscription = queueOrderService.subscribeQueueCounter({
      schoolId: schoolName,
      outletName,
      counterName,
      onChange: (next) => {
        if (!active) return;
        setCounter((previous) => {
          if (next?.current_queue_number && (next.current_queue_number !== previous?.current_queue_number || next.updated_at !== previous?.updated_at)) {
            setIsCalling(true);
            window.setTimeout(() => active && setIsCalling(false), 6000);
          }
          return next;
        });
      },
    });
    return () => {
      active = false;
      ordersSubscription.unsubscribe();
      counterSubscription.unsubscribe();
    };
  }, [schoolName, outletName, counterName]);

  useEffect(() => {
    const url = `${window.location.origin}/checkin?school_id=${encodeURIComponent(schoolName)}`;
    try {
      const qr = qrcodeGenerator(0, "M");
      qr.addData(url);
      qr.make();
      setQrCode(qr.createDataURL(8));
    } catch (error) {
      console.error("叫號頁 QR 生成失敗", error);
    }
  }, [schoolName]);

  const announce = () => {
    if (!counter?.current_queue_number || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`請排隊號碼 ${counter.current_queue_number}，請到隔離房間取貨。`);
    utterance.lang = "zh-HK";
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === "zh-hk")
      || voices.find((voice) => voice.lang.toLowerCase().startsWith("zh-hk"))
      || voices.find((voice) => voice.lang.toLowerCase().startsWith("zh-tw"))
      || voices.find((voice) => voice.lang.toLowerCase().startsWith("zh"))
      || null;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <main style={styles.page}>
      <style>{`@keyframes queue-call-flash { 0%, 49% { opacity: 1; } 50%, 100% { opacity: .18; } } @keyframes queue-call-pop { from { transform: scale(1); } to { transform: scale(1.06); } }`}</style>
      <div style={styles.header}>
        <div style={styles.eyebrow}>雲端排隊系統 · NOW SERVING</div>
        <h1 style={styles.school}>{schoolName || "校服服務中心"}</h1>
        <div style={styles.outlet}>{outletName || counterName}</div>
      </div>
      <section style={styles.hero} aria-live="polite">
        <div style={styles.label}>{isCalling ? "請立即到櫃台" : "現正服務"}</div>
        <div key={`${counter?.current_queue_number || "empty"}-${counter?.updated_at || ""}`} style={{ ...styles.queueNumber, ...(isCalling ? styles.queueNumberCalling : {}) }}>
          {counter?.current_queue_number || "--"}
        </div>
        <div style={{ ...styles.counter, ...(isCalling ? styles.counterCalling : {}) }}>{isCalling ? "請到隔離房間取貨" : "請留意叫號"}</div>
        <button type="button" onClick={announce} style={styles.announceButton} title="播放叫號提示">
          <Volume2 size={18} /> 播放廣東話提示
        </button>
      </section>
      <section style={styles.footer}>
        <div style={styles.waiting}><Users size={25} /><strong>{waitingCount}</strong><span>位客人等候中</span></div>
        {qrCode && <div style={styles.qrBlock}><img src={qrCode} alt="客人登記 QR code" /><div><QrCode size={18} /> 掃描 QR code 登記及查詢排隊狀態</div></div>}
      </section>
    </main>
  );
}

const styles = {
  page: { minHeight: "100vh", boxSizing: "border-box", padding: "5vh 6vw", background: "#071426", color: "#fff", fontFamily: "system-ui, sans-serif", display: "grid", gridTemplateRows: "auto 1fr auto", gap: 28 },
  header: { textAlign: "center" },
  eyebrow: { color: "#7dd3fc", fontSize: "clamp(14px, 2vw, 22px)", letterSpacing: 2, fontWeight: 800 },
  school: { margin: "12px 0 4px", fontSize: "clamp(26px, 4vw, 52px)", lineHeight: 1.15 },
  outlet: { color: "#a8b8cc", fontSize: "clamp(16px, 2vw, 24px)" },
  hero: { alignSelf: "center", textAlign: "center", padding: "5vh 4vw", border: "1px solid #1e5a85", borderRadius: 18, background: "#0b2038", boxShadow: "0 0 50px rgba(14,165,233,.18)" },
  label: { color: "#bae6fd", fontSize: "clamp(18px, 3vw, 32px)", fontWeight: 700 },
  queueNumber: { margin: "10px 0", fontSize: "clamp(92px, 20vw, 260px)", lineHeight: .9, fontWeight: 950, letterSpacing: 8, color: "#fff" },
  queueNumberCalling: { animation: "queue-call-flash 0.8s steps(2, end) infinite, queue-call-pop 0.8s ease-in-out infinite alternate", color: "#fef08a", textShadow: "0 0 18px #facc15, 0 0 42px #f59e0b" },
  counter: { color: "#a8b8cc", fontSize: "clamp(16px, 2vw, 25px)" },
  counterCalling: { color: "#fde68a", fontWeight: 900 },
  announceButton: { marginTop: 22, display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #38bdf8", borderRadius: 8, padding: "10px 16px", background: "transparent", color: "#bae6fd", fontWeight: 800, cursor: "pointer" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "end", gap: 24, flexWrap: "wrap" },
  waiting: { display: "flex", alignItems: "center", gap: 10, color: "#bae6fd", fontSize: "clamp(16px, 2vw, 25px)" },
  qrBlock: { display: "flex", alignItems: "center", gap: 12, color: "#dbeafe", fontSize: "clamp(12px, 1.5vw, 18px)", maxWidth: 330 },
};
