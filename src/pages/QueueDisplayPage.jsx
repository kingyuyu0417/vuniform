import React, { useEffect, useRef, useState } from "react";
import { Package, QrCode, Ruler, Users, Volume2 } from "lucide-react";
import qrcodeGenerator from "qrcode-generator";
import { ORDER_STATUS, QUEUE_SERVICE, queueOrderService } from "../services/queueOrderService";

const activeStatuses = [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING, ORDER_STATUS.READY];
let announcementChain = Promise.resolve();
const announcerId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const announcerStorageKey = "uniform-pos-active-queue-announcer";
const canAnnounce = () => {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return false;
  try {
    const now = Date.now();
    const current = JSON.parse(window.localStorage.getItem(announcerStorageKey) || "null");
    if (current?.id && current.id !== announcerId && now - Number(current.updatedAt || 0) < 10000) return false;
    window.localStorage.setItem(announcerStorageKey, JSON.stringify({ id: announcerId, updatedAt: now }));
    return true;
  } catch {
    return true;
  }
};
const enqueueAnnouncement = (announcement) => {
  announcementChain = announcementChain.then(announcement).catch((error) => {
    console.warn("排隊語音播放失敗", error);
  });
  return announcementChain;
};

const CANTONESE_DIGITS = { 0: "零", 1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "七", 8: "八", 9: "九" };
const queueNumberForSpeech = (value = "") => String(value)
  .trim()
  .replace(/\d/g, (digit) => ` ${CANTONESE_DIGITS[digit]} `)
  .replace(/\s+/g, " ");

const schoolNameStyle = (schoolName = "") => {
  const characterCount = Array.from(schoolName).length;
  const fontSize = characterCount > 36 ? 16 : characterCount > 28 ? 18 : characterCount > 20 ? 20 : 24;
  return {
    ...styles.school,
    fontSize: `${fontSize}px`,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  };
};

function QueueDisplayLane({ schoolName = "", outletName = "", counterName = "main", serviceType = QUEUE_SERVICE.FITTING, embedded = false, showHeader = true }) {
  const laneCounterName = serviceType === QUEUE_SERVICE.PICKUP ? "pickup" : "fitting";
  const [counter, setCounter] = useState(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [qrCode, setQrCode] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const isPickup = serviceType === QUEUE_SERVICE.PICKUP;
  const laneTheme = isPickup
    ? { accent: "#fb923c", border: "#9a3412", background: "#2a160e", soft: "#fed7aa", glow: "rgba(249,115,22,.2)" }
    : { accent: "#38bdf8", border: "#1e5a85", background: "#0b2038", soft: "#bae6fd", glow: "rgba(14,165,233,.18)" };
  const serviceTitle = isPickup ? "取貨叫號" : "度身叫號";
  const destination = isPickup ? "請前往取貨區辦理取貨及付款" : "請前往度身區辦理度身";
  const hasLoadedCounterRef = useRef(false);
  const lastAnnouncedCallRef = useRef("");
  const chimeAudioRef = useRef(null);
  const refreshInFlightRef = useRef(false);

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
    const refreshPublicDisplay = async () => {
      if (!active || refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      try {
        const next = await queueOrderService.getPublicQueueDisplay({
          schoolId: schoolName,
          outletName,
          counterName: laneCounterName,
          serviceType,
        });
        if (!active || !next) return;
        setLastUpdatedAt(new Date());
        setRefreshFailed(false);
        setWaitingCount(Number(next.waiting_count || 0));
        setCounter((previous) => {
          if (next.current_queue_number && (next.current_queue_number !== previous?.current_queue_number || next.updated_at !== previous?.updated_at)) {
            setIsCalling(true);
            window.setTimeout(() => active && setIsCalling(false), 6000);
          }
          return next;
        });
      } catch (error) {
        if (active) setRefreshFailed(true);
        console.warn("public queue display refresh failed", error);
      } finally {
        refreshInFlightRef.current = false;
      }
    };
    refreshPublicDisplay();
    // Keep the public display nearly real-time while retaining polling as a
    // reliable fallback when Realtime is unavailable on the display device.
    const timer = window.setInterval(refreshPublicDisplay, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [schoolName, outletName, laneCounterName, serviceType]);

  useEffect(() => {
    if (!counter?.current_queue_number) return;
    const callKey = `${counter.current_queue_number}::${counter.updated_at || ""}`;
    if (!hasLoadedCounterRef.current) {
      hasLoadedCounterRef.current = true;
      lastAnnouncedCallRef.current = callKey;
      return;
    }
    if (lastAnnouncedCallRef.current === callKey) return;
    lastAnnouncedCallRef.current = callKey;
    enqueueAnnouncement(() => announce(counter));
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
    if (!canAnnounce()) return;
    await playChime();
    if (!window.speechSynthesis) return;
    const destination = serviceType === QUEUE_SERVICE.PICKUP ? "取貨區取貨付款" : "度身區度身";
    const utterance = new SpeechSynthesisUtterance(`${queueNumberForSpeech(counterToAnnounce.current_queue_number)} 號嘅同學，請立即到${destination}。`);
    const voices = window.speechSynthesis.getVoices();
    const cantoneseVoice = voices.find((voice) => /^yue(?:[-_]hk)?$/i.test(voice.lang))
      || voices.find((voice) => /^yue[-_]/i.test(voice.lang))
      || voices.find((voice) => /^zh[-_]hk/i.test(voice.lang))
      || voices.find((voice) => /cantonese|粵語|广东话|廣東話/i.test(voice.name))
      || null;
    utterance.lang = cantoneseVoice?.lang || "yue-HK";
    utterance.voice = cantoneseVoice;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const enableAutomaticAudio = () => {
    enqueueAnnouncement(() => announce());
  };
  const currentQueueNumber = counter?.current_queue_number || "";
  const lastUpdatedLabel = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "";

  return (
    <main style={{ ...styles.page, ...(embedded ? styles.embeddedPage : {}) }}>
      <style>{`@keyframes queue-call-flash { 0%, 49% { opacity: 1; } 50%, 100% { opacity: .18; } } @keyframes queue-call-pop { from { transform: scale(1); } to { transform: scale(1.06); } } @media (max-width: 760px) { .queue-display-grid { grid-template-columns: 1fr !important; } }`}</style>
      {showHeader && <div style={styles.header}>
        <div style={styles.headerText}>
          <div style={styles.eyebrow}>雲端排隊系統 · {serviceType === QUEUE_SERVICE.PICKUP ? "PICKUP" : "FITTING"}</div>
          <h1 style={schoolNameStyle(schoolName || "校服服務中心")}>{schoolName || "校服服務中心"}</h1>
          <div style={styles.outlet}>如需加購校服或更換校服尺碼，請前往指定門市：{outletName || counterName}</div>
        </div>
        {qrCode && <div style={styles.headerQr}><img src={qrCode} alt="客人登記 QR code" style={styles.headerQrImage} /><div><QrCode size={13} /> 登記／查詢</div></div>}
      </div>}
      <section style={{ ...styles.hero, borderColor: laneTheme.border, background: laneTheme.background, boxShadow: `0 0 50px ${laneTheme.glow}` }} aria-live="polite">
        <div style={{ ...styles.label, color: laneTheme.soft, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          {isPickup ? <Package size={32} aria-hidden="true" /> : <Ruler size={32} aria-hidden="true" />}
          <span>{serviceTitle}</span>
        </div>
        <div style={{ color: laneTheme.accent, fontSize: "clamp(14px, 2vw, 22px)", fontWeight: 800, marginTop: 16 }}>
          {destination}
        </div>
        <div aria-label={currentQueueNumber ? `現正叫號 ${currentQueueNumber}` : "暫無叫號"} key={`${currentQueueNumber || "empty"}-${counter?.updated_at || ""}`} style={{ ...styles.queueNumber, ...(embedded ? styles.embeddedQueueNumber : {}), ...(!currentQueueNumber ? { fontSize: "clamp(42px, 8vw, 96px)", letterSpacing: 0, color: laneTheme.soft } : {}), ...(isCalling ? styles.queueNumberCalling : {}) }}>
          {currentQueueNumber || "暫無叫號"}
        </div>
        <div style={{ ...styles.counter, color: isCalling ? "#fde68a" : laneTheme.soft, ...(isCalling ? styles.counterCalling : {}) }}>
          {isCalling ? `正在叫號，請立即前往${isPickup ? "取貨區" : "度身區"}` : "請留意叫號"}
        </div>
        <button type="button" onClick={enableAutomaticAudio} style={styles.announceButton} title="啟用自動叫號提示">
          <Volume2 size={18} /> 啟用自動提示
        </button>
      </section>
      <section style={styles.footer}>
        <div style={styles.waiting}><Users size={25} /><strong>{waitingCount}</strong><span>位客人等候中</span></div>
        <div role="status" style={{ color: refreshFailed ? "#fecaca" : "#a8b8cc", fontSize: "clamp(13px, 1.5vw, 18px)", textAlign: "right" }}>
          {refreshFailed ? "更新連線中斷，正在重試" : "自動更新"}
          {lastUpdatedLabel ? <span> · 最後更新 {lastUpdatedLabel}</span> : ""}
        </div>
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
          <h1 style={schoolNameStyle(schoolName || "校服服務中心")}>{schoolName || "校服服務中心"}</h1>
          <div style={styles.outlet}>如需加購校服或更換校服尺碼，請前往指定門市：{outletName || counterName}</div>
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
  sharedHeader: { gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "1.5vh 4vw 0.5vh", textAlign: "left", flexWrap: "wrap" },
  sharedHeaderText: { minWidth: 0 },
  page: { minHeight: "100vh", boxSizing: "border-box", padding: "5vh 6vw", background: "#071426", color: "#fff", fontFamily: "system-ui, sans-serif", display: "grid", gridTemplateRows: "auto 1fr auto", gap: 28 },
  header: { display: "flex", justifyContent: "center", alignItems: "center", gap: 22, textAlign: "center", flexWrap: "wrap" },
  headerText: { minWidth: 0 },
  eyebrow: { color: "#7dd3fc", fontSize: "clamp(14px, 2vw, 22px)", letterSpacing: 2, fontWeight: 800 },
  school: { margin: "6px 0 2px", fontSize: "clamp(18px, 2.4vw, 28px)", lineHeight: 1.25, color: "#cbd5e1", fontWeight: 700 },
  outlet: { color: "#a8b8cc", fontSize: "clamp(13px, 1.5vw, 18px)" },
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
