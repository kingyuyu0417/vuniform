import React, { useEffect, useRef, useState } from "react";
import { QrCode, Users, Volume2 } from "lucide-react";
import qrcodeGenerator from "qrcode-generator";
import { ORDER_STATUS, QUEUE_SERVICE, queueOrderService } from "../services/queueOrderService";

const activeStatuses = [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING, ORDER_STATUS.READY];

function QueueDisplayLane({ schoolName = "", outletName = "", counterName = "main", serviceType = QUEUE_SERVICE.FITTING, embedded = false, showHeader = true }) {
  const laneCounterName = serviceType === QUEUE_SERVICE.PICKUP ? "pickup" : "fitting";
  const [counter, setCounter] = useState(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [qrCode, setQrCode] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const hasLoadedCounterRef = useRef(false);
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

  useEffect(() => {
    let active = true;
    const updateOrders = (orders) => {
      if (!active) return;
      const waitingStatus = serviceType === QUEUE_SERVICE.PICKUP ? ORDER_STATUS.READY : ORDER_STATUS.PENDING;
      setWaitingCount((orders || []).filter((order) => order.status === waitingStatus).length);
    };
    queueOrderService.listOrders({ schoolId: schoolName }).then(updateOrders).catch(() => {});
    const ordersSubscription = queueOrderService.subscribe({ schoolId: schoolName, serviceType, onChange: updateOrders });
    const counterSubscription = queueOrderService.subscribeQueueCounter({
      schoolId: schoolName,
      outletName,
      counterName: laneCounterName,
      serviceType,
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
  }, [schoolName, outletName, laneCounterName, serviceType]);

  useEffect(() => {
    if (!counter?.current_queue_number) return;
    if (!hasLoadedCounterRef.current) {
      hasLoadedCounterRef.current = true;
      return;
    }
    announce(counter);
  }, [counter]);

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

  const playChime = () => {
    const audio = chimeAudioRef.current;
    if (!audio) return Promise.resolve();
    audio.currentTime = 0;
    return new Promise((resolve) => {
      const finish = () => {
        audio.removeEventListener("ended", finish);
        audio.removeEventListener("error", finish);
        resolve();
      };
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
      audio.play().catch((error) => {
        console.warn("叫號提示音播放被瀏覽器阻擋", error);
        finish();
      });
    });
  };

  const announce = async (counterToAnnounce = counter) => {
    if (!counterToAnnounce?.current_queue_number) return;
    window.speechSynthesis?.cancel();
    await playChime();
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const destination = serviceType === QUEUE_SERVICE.PICKUP ? "隔離房間取貨" : "度身房間度身";
    const utterance = new SpeechSynthesisUtterance(`請排隊號碼 ${counterToAnnounce.current_queue_number}，請到${destination}。`);
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

  const enableAutomaticAudio = () => {
    announce();
  };

  return (
    <main style={{ ...styles.page, ...(embedded ? styles.embeddedPage : {}) }}>
      <style>{`@keyframes queue-call-flash { 0%, 49% { opacity: 1; } 50%, 100% { opacity: .18; } } @keyframes queue-call-pop { from { transform: scale(1); } to { transform: scale(1.06); } } @media (max-width: 760px) { .queue-display-grid { grid-template-columns: 1fr !important; } }`}</style>
      {showHeader && <div style={styles.header}>
        <div style={styles.headerText}>
          <div style={styles.eyebrow}>雲端排隊系統 · {serviceType === QUEUE_SERVICE.PICKUP ? "PICKUP" : "FITTING"}</div>
          <h1 style={styles.school}>{schoolName || "校服服務中心"}</h1>
          <div style={styles.outlet}>{outletName || counterName}</div>
        </div>
        {qrCode && <div style={styles.headerQr}><img src={qrCode} alt="客人登記 QR code" style={styles.headerQrImage} /><div><QrCode size={13} /> 登記／查詢</div></div>}
      </div>}
      <section style={styles.hero} aria-live="polite">
        <div style={styles.label}>{isCalling ? (serviceType === QUEUE_SERVICE.PICKUP ? "請立即到隔離房間取貨" : "請立即到度身房間") : (serviceType === QUEUE_SERVICE.PICKUP ? "現正取貨" : "現正度身")}</div>
        <div key={`${counter?.current_queue_number || "empty"}-${counter?.updated_at || ""}`} style={{ ...styles.queueNumber, ...(embedded ? styles.embeddedQueueNumber : {}), ...(isCalling ? styles.queueNumberCalling : {}) }}>
          {counter?.current_queue_number || "--"}
        </div>
        <div style={{ ...styles.counter, ...(isCalling ? styles.counterCalling : {}) }}>{isCalling ? (serviceType === QUEUE_SERVICE.PICKUP ? "請到隔離房間取貨" : "請到度身房間") : "請留意叫號"}</div>
        <button type="button" onClick={enableAutomaticAudio} style={styles.announceButton} title="啟用自動叫號提示">
          <Volume2 size={18} /> 啟用自動提示
        </button>
      </section>
      <section style={styles.footer}>
        <div style={styles.waiting}><Users size={25} /><strong>{waitingCount}</strong><span>位客人等候中</span></div>
      </section>
    </main>
  );
}

export default function QueueDisplayPage({ schoolName = "", outletName = "", counterName = "main", serviceType = "" }) {
  const lanes = serviceType === QUEUE_SERVICE.FITTING || serviceType === QUEUE_SERVICE.PICKUP
    ? [serviceType]
    : [QUEUE_SERVICE.FITTING, QUEUE_SERVICE.PICKUP];
  const isDualDisplay = lanes.length > 1;
  const [qrCode, setQrCode] = useState("");

  useEffect(() => {
    if (!isDualDisplay) return;
    const url = `${window.location.origin}/checkin?school_id=${encodeURIComponent(schoolName)}`;
    try {
      const qr = qrcodeGenerator(0, "M");
      qr.addData(url);
      qr.make();
      setQrCode(qr.createDataURL(8));
    } catch (error) {
      console.error("叫號頁 QR 生成失敗", error);
    }
  }, [isDualDisplay, schoolName]);

  return (
    <div className="queue-display-grid" style={styles.displayGrid}>
      {isDualDisplay && <div style={styles.sharedHeader}>
        <div style={styles.sharedHeaderText}>
          <div style={styles.eyebrow}>雲端排隊系統 · NOW SERVING</div>
          <h1 style={styles.school}>{schoolName || "校服服務中心"}</h1>
          <div style={styles.outlet}>{outletName || counterName}</div>
        </div>
        {qrCode && <div style={styles.headerQr}><img src={qrCode} alt="客人登記 QR code" style={styles.headerQrImage} /><div><QrCode size={13} /> 登記／查詢</div></div>}
      </div>}
      {lanes.map((lane) => (
        <QueueDisplayLane
          key={lane}
          schoolName={schoolName}
          outletName={outletName}
          counterName={counterName}
          serviceType={lane}
          embedded={isDualDisplay}
          showHeader={!isDualDisplay}
        />
      ))}
    </div>
  );
}

const styles = {
  displayGrid: { minHeight: "100vh", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", background: "#071426", gap: 2 },
  embeddedPage: { minHeight: 0, padding: "3vh 3vw", gap: 18, border: "1px solid #1e5a85", borderRadius: 16, overflow: "hidden" },
  sharedHeader: { gridColumn: "1 / -1", display: "flex", justifyContent: "center", alignItems: "center", gap: 22, padding: "3vh 4vw 1vh", textAlign: "center", flexWrap: "wrap" },
  sharedHeaderText: { minWidth: 0 },
  page: { minHeight: "100vh", boxSizing: "border-box", padding: "5vh 6vw", background: "#071426", color: "#fff", fontFamily: "system-ui, sans-serif", display: "grid", gridTemplateRows: "auto 1fr auto", gap: 28 },
  header: { display: "flex", justifyContent: "center", alignItems: "center", gap: 22, textAlign: "center", flexWrap: "wrap" },
  headerText: { minWidth: 0 },
  eyebrow: { color: "#7dd3fc", fontSize: "clamp(14px, 2vw, 22px)", letterSpacing: 2, fontWeight: 800 },
  school: { margin: "12px 0 4px", fontSize: "clamp(26px, 4vw, 52px)", lineHeight: 1.15 },
  outlet: { color: "#a8b8cc", fontSize: "clamp(16px, 2vw, 24px)" },
  headerQr: { display: "grid", justifyItems: "center", gap: 4, color: "#dbeafe", fontSize: 12, fontWeight: 800, flexShrink: 0 },
  headerQrImage: { width: 76, height: 76, background: "#fff", padding: 5, borderRadius: 6 },
  hero: { alignSelf: "center", textAlign: "center", padding: "5vh 4vw", border: "1px solid #1e5a85", borderRadius: 18, background: "#0b2038", boxShadow: "0 0 50px rgba(14,165,233,.18)" },
  label: { color: "#bae6fd", fontSize: "clamp(18px, 3vw, 32px)", fontWeight: 700 },
  queueNumber: { margin: "10px 0", fontSize: "clamp(92px, 20vw, 260px)", lineHeight: .9, fontWeight: 950, letterSpacing: 8, color: "#fff" },
  embeddedQueueNumber: { fontSize: "clamp(72px, 10vw, 180px)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  queueNumberCalling: { animation: "queue-call-flash 0.8s steps(2, end) infinite, queue-call-pop 0.8s ease-in-out infinite alternate", color: "#fef08a", textShadow: "0 0 18px #facc15, 0 0 42px #f59e0b" },
  counter: { color: "#a8b8cc", fontSize: "clamp(16px, 2vw, 25px)" },
  counterCalling: { color: "#fde68a", fontWeight: 900 },
  announceButton: { marginTop: 22, display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #38bdf8", borderRadius: 8, padding: "10px 16px", background: "transparent", color: "#bae6fd", fontWeight: 800, cursor: "pointer" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "end", gap: 24, flexWrap: "wrap" },
  waiting: { display: "flex", alignItems: "center", gap: 10, color: "#bae6fd", fontSize: "clamp(16px, 2vw, 25px)" },
};
