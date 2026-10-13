import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
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

  return (
    <main style={styles.page}>
      <div style={styles.eyebrow}>取貨叫號 · 客人顯示</div>
      <h1 style={styles.school}>{schoolName || "未指定學校"}</h1>
      <div style={styles.panel} aria-live="polite" aria-atomic="true">
        <div style={styles.label}>{currentCall ? "最新叫號" : connectionLabel}</div>
        <div style={styles.number}>{currentCall?.queueNumber || "—"}</div>
        {currentCall && <div style={styles.detail}>請留意叫號，並前往取貨櫃位</div>}
        {audioStatus === "BLOCKED" && currentCall && (
          <button type="button" onClick={playLatestCall} style={styles.audioButton}>
            <Volume2 size={22} aria-hidden="true" /> 按此播放最新叫號
          </button>
        )}
        {audioStatus === "ENABLED" && <div style={styles.audioEnabled}><Volume2 size={20} aria-hidden="true" /> 聲音提示已啟用</div>}
        {audioStatus === "AUTO" && <div style={styles.audioHint}>收到叫號時會嘗試自動播報；若瀏覽器阻擋，請按一下播放</div>}
        {audioError && <div role="alert" style={styles.error}>{audioError}</div>}
      </div>
      <div style={styles.footer}>
        {currentCall
          ? `${languageNames[currentCall.language] || "語音"}播報${audioStatus === "ENABLED" ? " · 聲音已啟用" : audioStatus === "BLOCKED" ? " · 瀏覽器已阻擋自動播放" : " · 正嘗試自動播放"}`
          : connectionStatus === "MISSING_SCHOOL"
            ? "連結未指定學校，請由職員叫號頁重新開啟。"
            : "本頁會即時顯示並播報職員最新叫出的取貨籌號"}
      </div>
    </main>
  );
}

const styles = {
  page: { minHeight: "100vh", boxSizing: "border-box", padding: "5vh 5vw", display: "grid", gridTemplateRows: "auto auto 1fr auto", justifyItems: "center", gap: 14, background: "#071426", color: "#fff", fontFamily: "system-ui, sans-serif", textAlign: "center" },
  eyebrow: { color: "#7dd3fc", fontSize: "clamp(15px, 2vw, 24px)", letterSpacing: 2, fontWeight: 800 },
  school: { margin: 0, color: "#e2e8f0", fontSize: "clamp(22px, 3vw, 38px)", overflowWrap: "anywhere" },
  panel: { width: "100%", maxWidth: 1100, boxSizing: "border-box", alignSelf: "center", padding: "4vh 5vw", border: "2px solid #1e5a85", borderRadius: 24, background: "#0b2038", boxShadow: "0 0 55px rgba(14,165,233,.18)" },
  label: { color: "#bae6fd", fontSize: "clamp(22px, 4vw, 44px)", fontWeight: 800 },
  number: { color: "#fef08a", fontSize: "clamp(100px, 32vw, 340px)", lineHeight: 1, fontWeight: 950, letterSpacing: "0.04em", overflowWrap: "anywhere" },
  detail: { color: "#e2e8f0", fontSize: "clamp(20px, 3vw, 36px)", fontWeight: 700 },
  audioButton: { marginTop: 24, padding: "14px 24px", display: "inline-flex", alignItems: "center", gap: 10, border: 0, borderRadius: 12, background: "#15803d", color: "#fff", fontSize: 20, fontWeight: 800, cursor: "pointer" },
  audioEnabled: { marginTop: 24, display: "inline-flex", alignItems: "center", gap: 8, color: "#86efac", fontSize: 18, fontWeight: 700 },
  audioHint: { marginTop: 24, color: "#cbd5e1", fontSize: 15 },
  error: { marginTop: 12, color: "#fecaca", fontWeight: 700 },
  footer: { color: "#a8b8cc", fontSize: "clamp(14px, 2vw, 22px)" },
};
