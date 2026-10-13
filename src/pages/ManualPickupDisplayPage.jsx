import { useEffect, useRef, useState } from "react";
import { MapPin, Radio, Volume2, Wifi, WifiOff } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import { createManualPickupDisplayConnection } from "../services/manualPickupDisplayService.js";
import { formatManualPickupAnnouncement } from "../data/manualPickupCall.js";

const languageNames = { yue: "廣東話", en: "英文", zh: "普通話" };

const getCantoneseVoice = () => {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => /^yue(?:[-_]hk)?$/i.test(voice.lang))
    || voices.find((voice) => /^yue[-_]/i.test(voice.lang))
    || voices.find((voice) => /^zh[-_]hk/i.test(voice.lang))
    || voices.find((voice) => /cantonese|粵語|广东话|廣東話/i.test(voice.name))
    || null;
};

const speakCall = async (call, audio) => {
  audio.currentTime = 0;
  let finishChime;
  const chimeFinished = new Promise((resolve) => {
    finishChime = () => {
      audio.removeEventListener("ended", finishChime);
      audio.removeEventListener("error", finishChime);
      resolve();
    };
    audio.addEventListener("ended", finishChime, { once: true });
    audio.addEventListener("error", finishChime, { once: true });
  });
  try {
    await audio.play();
    await chimeFinished;
  } catch (error) {
    finishChime();
    audio.pause();
    throw new Error("提示音播放失敗，請檢查裝置音量。", { cause: error });
  }

  if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") {
    throw new Error("此裝置不支援語音播報，請確認瀏覽器語音功能已啟用。");
  }

  const utterance = new window.SpeechSynthesisUtterance(formatManualPickupAnnouncement(call.queueNumber, call.language));
  utterance.lang = call.language === "en" ? "en-GB" : call.language === "zh" ? "zh-CN" : "yue-HK";
  if (call.language === "yue") {
    const voice = getCantoneseVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
  }
  utterance.rate = 0.9;
  utterance.pitch = 1;

  await new Promise((resolve, reject) => {
    utterance.onend = resolve;
    utterance.onerror = (event) => reject(new Error(`語音播報失敗：${event.error || "請檢查裝置語音設定"}`));
    window.speechSynthesis.speak(utterance);
  });
};

export default function ManualPickupDisplayPage({ schoolName = "" }) {
  const [currentCall, setCurrentCall] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("CONNECTING");
  const [audioStatus, setAudioStatus] = useState("AUTO");
  const [audioError, setAudioError] = useState("");
  const audioStatusRef = useRef("AUTO");
  const audioRef = useRef(null);
  const pendingCallRef = useRef(null);
  const speakingRef = useRef(false);
  const queuedCallRef = useRef(null);
  const lastSpokenCallRef = useRef("");

  useEffect(() => {
    if (!schoolName.trim()) {
      setConnectionStatus("MISSING_SCHOOL");
      return undefined;
    }

    let active = true;
    try {
      const connection = createManualPickupDisplayConnection({
        schoolId: schoolName,
        client: supabase,
        enabled: isSupabaseConfigured,
        onCall: (call) => {
          if (!active) return;
          setCurrentCall(call);
          pendingCallRef.current = call;
          if (audioStatusRef.current !== "BLOCKED") void announce(call);
        },
        onStatus: (status) => {
          if (active) setConnectionStatus(status);
        },
      });
      return () => {
        active = false;
        connection.unsubscribe();
      };
    } catch (error) {
      setConnectionStatus("CHANNEL_ERROR");
      setAudioError(error instanceof Error ? error.message : "客人叫號畫面連線失敗。");
      return undefined;
    }
  }, [schoolName]);

  useEffect(() => {
    const audio = new Audio("/audio/queue-chime.mpeg");
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const announce = async (call) => {
    const callKey = `${call.queueNumber}::${call.language}::${call.calledAt}`;
    if (speakingRef.current) {
      queuedCallRef.current = call;
      return;
    }
    if (lastSpokenCallRef.current === callKey) return;
    lastSpokenCallRef.current = callKey;
    speakingRef.current = true;
    setAudioError("");
    try {
      if (!audioRef.current) throw new Error("提示音未準備好，請重新載入頁面。");
      await speakCall(call, audioRef.current);
      audioStatusRef.current = "ENABLED";
      setAudioStatus("ENABLED");
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : "聲音播放失敗，請檢查裝置音量。");
      audioStatusRef.current = "BLOCKED";
      setAudioStatus("BLOCKED");
      lastSpokenCallRef.current = "";
    } finally {
      speakingRef.current = false;
      const nextCall = queuedCallRef.current;
      queuedCallRef.current = null;
      if (nextCall) {
        pendingCallRef.current = nextCall;
        if (audioStatusRef.current !== "BLOCKED") void announce(nextCall);
      }
    }
  };

  const playLatestCall = () => {
    setAudioError("");
    audioStatusRef.current = "AUTO";
    setAudioStatus("AUTO");
    lastSpokenCallRef.current = "";
    if (pendingCallRef.current) void announce(pendingCallRef.current);
  };

  const connectionLabel = connectionStatus === "SUBSCRIBED"
    ? "已連接，等候最新叫號"
    : connectionStatus === "MISSING_SCHOOL"
      ? "連結缺少學校資料"
      : ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(connectionStatus)
        ? "連線中斷，請重新整理"
        : "正在連線";
  const isConnected = connectionStatus === "SUBSCRIBED";

  return (
    <main className="pickup-display-page" style={styles.page}>
      <style>{`html, body { width: 100%; height: 100%; min-height: 0; margin: 0; overflow: hidden; } #root { width: 100%; height: 100%; min-height: 0; zoom: 1; } @media (max-height: 650px) { .pickup-display-page { padding: 8px 18px !important; gap: 6px !important; } .pickup-display-content { gap: 6px !important; } .pickup-display-brand-icon { width: 36px !important; height: 36px !important; } .pickup-display-number { font-size: clamp(64px, 17vh, 110px) !important; } .pickup-display-empty-number { margin: 8px 0 !important; font-size: 18px !important; } .pickup-display-panel { padding: 10px 16px !important; border-radius: 18px !important; } .pickup-display-label { margin-top: 3px !important; font-size: 18px !important; } .pickup-display-destination { font-size: 16px !important; } .pickup-display-footer { font-size: 11px !important; } } @media (max-width: 520px) { .pickup-display-header { align-items: flex-start !important; } .pickup-display-connection { padding: 7px 9px !important; font-size: 11px !important; } }`}</style>
      <header className="pickup-display-header" style={styles.header}>
        <div style={styles.brand}>
          <div className="pickup-display-brand-icon" style={styles.brandIcon}><Radio size={23} strokeWidth={2.5} aria-hidden="true" /></div>
          <div>
            <div style={styles.eyebrow}>UNIFORM SERVICE</div>
            <div style={styles.headerTitle}>取貨叫號</div>
          </div>
        </div>
        <div className="pickup-display-connection" style={{ ...styles.connection, ...(isConnected ? styles.connectionOnline : {}) }} role="status">
          {isConnected ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
          <span>{connectionLabel}</span>
        </div>
      </header>

      <section className="pickup-display-content" style={styles.content}>
        <h1 style={styles.school}>{schoolName || "未指定學校"}</h1>
        <div className="pickup-display-panel" style={styles.panel} aria-live="polite" aria-atomic="true">
          <div style={styles.callEyebrow}>{currentCall ? "NOW SERVING" : "PICKUP QUEUE"}</div>
          <div className="pickup-display-label" style={styles.label}>{currentCall ? "請以下籌號客人前往取貨" : "等候職員叫號"}</div>
          <div className={currentCall ? "pickup-display-number" : "pickup-display-empty-number"} style={currentCall ? styles.number : styles.emptyNumber}>
            {currentCall?.queueNumber || "稍後會於此顯示"}
          </div>
          <div className="pickup-display-destination" style={styles.destination}><MapPin size={20} aria-hidden="true" /> 請前往取貨櫃位</div>
        </div>
        {audioStatus === "BLOCKED" && currentCall && (
          <button type="button" onClick={playLatestCall} style={styles.audioButton}>
            <Volume2 size={20} aria-hidden="true" /> 按此播放最新叫號
          </button>
        )}
        {audioStatus === "ENABLED" && <div style={styles.audioState}><Volume2 size={17} aria-hidden="true" /> 聲音播報中</div>}
        {audioStatus === "AUTO" && <div style={styles.audioHint}>收到叫號時將自動播放聲音提示</div>}
        {audioError && <div role="alert" style={styles.error}>{audioError}</div>}
      </section>
      <footer className="pickup-display-footer" style={styles.footer}>
        {currentCall
          ? `${languageNames[currentCall.language] || "語音"}播報${audioStatus === "BLOCKED" ? " · 瀏覽器已阻擋自動播放" : ""}`
          : connectionStatus === "MISSING_SCHOOL"
            ? "連結未指定學校，請由職員叫號頁重新開啟。"
            : "請留意螢幕及語音提示 · 籌號會即時更新"}
      </footer>
    </main>
  );
}

const styles = {
  page: { width: "100%", height: "100vh", height: "100dvh", minHeight: 0, boxSizing: "border-box", overflow: "hidden", padding: "clamp(18px, 3.2vh, 36px) clamp(18px, 5vw, 72px) clamp(16px, 2.5vh, 28px)", display: "grid", gridTemplateRows: "auto 1fr auto", gap: "clamp(12px, 2.4vh, 26px)", background: "radial-gradient(ellipse at 50% 38%, #ffffff 0%, #f7faff 53%, #edf3fa 100%)", color: "#18314f", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", textAlign: "center" },
  header: { width: "100%", maxWidth: 1180, justifySelf: "center", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 },
  brand: { display: "flex", alignItems: "center", gap: 12, textAlign: "left" },
  brandIcon: { width: 46, height: 46, display: "grid", placeItems: "center", borderRadius: 15, background: "#e7f1ff", color: "#1763b6" },
  eyebrow: { color: "#66809d", fontSize: 11, letterSpacing: 1.8, fontWeight: 850 },
  headerTitle: { marginTop: 2, color: "#18314f", fontSize: 18, fontWeight: 850 },
  connection: { display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", border: "1px solid #dbe4ef", borderRadius: 999, background: "#fff", color: "#697b90", fontSize: 13, fontWeight: 750, whiteSpace: "nowrap" },
  connectionOnline: { borderColor: "#b9e6d0", background: "#effaf4", color: "#218052" },
  content: { width: "100%", maxWidth: 920, justifySelf: "center", alignSelf: "center", display: "grid", justifyItems: "center", alignContent: "center", gap: "clamp(12px, 2.4vh, 24px)" },
  school: { maxWidth: "100%", margin: 0, color: "#526b86", fontSize: "clamp(20px, 3.3vw, 32px)", lineHeight: 1.25, fontWeight: 750, overflowWrap: "anywhere" },
  panel: { width: "100%", boxSizing: "border-box", padding: "clamp(22px, 4vh, 42px) clamp(16px, 4vw, 48px)", border: "1px solid #e2eaf3", borderRadius: "clamp(20px, 3vw, 32px)", background: "linear-gradient(145deg, #ffffff 0%, #f9fbff 100%)", boxShadow: "0 18px 55px rgba(35, 69, 108, .11), 0 2px 8px rgba(35, 69, 108, .04)" },
  callEyebrow: { color: "#2876c7", fontSize: 12, letterSpacing: 2.6, fontWeight: 900 },
  label: { marginTop: 8, color: "#37516e", fontSize: "clamp(20px, 3.1vw, 30px)", fontWeight: 750 },
  number: { margin: "clamp(4px, 1.5vh, 16px) 0", color: "#173c68", fontSize: "clamp(104px, 27vh, 280px)", lineHeight: .96, fontWeight: 900, letterSpacing: ".025em", fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" },
  emptyNumber: { margin: "clamp(22px, 5vh, 56px) 0", color: "#98a9bb", fontSize: "clamp(19px, 3vw, 28px)", lineHeight: 1.4, fontWeight: 650 },
  destination: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#526b86", fontSize: "clamp(17px, 2.6vw, 24px)", fontWeight: 700 },
  audioButton: { minHeight: 50, padding: "12px 20px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, border: 0, borderRadius: 13, background: "#176bc1", color: "#fff", fontSize: 16, fontWeight: 800, boxShadow: "0 5px 14px rgba(23, 107, 193, .22)", cursor: "pointer" },
  audioState: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, color: "#218052", fontSize: 14, fontWeight: 750 },
  audioHint: { color: "#72859b", fontSize: 13 },
  error: { marginTop: 4, color: "#b42318", fontSize: 14, fontWeight: 700 },
  footer: { justifySelf: "center", color: "#8092a7", fontSize: "clamp(12px, 1.5vw, 15px)", fontWeight: 600 },
};
