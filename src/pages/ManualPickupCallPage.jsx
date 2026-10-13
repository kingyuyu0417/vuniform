import React, { useEffect, useRef, useState } from "react";
import { RotateCcw, Volume2 } from "lucide-react";
import { formatManualPickupAnnouncement, normalizeManualPickupNumber } from "../data/manualPickupCall.js";

const styles = {
  page: { maxWidth: 480, margin: "0 auto", padding: "24px 16px 32px", color: "#1F2937" },
  title: { margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: "#1F3A5F" },
  description: { margin: "0 0 24px", color: "#64748B", fontSize: 14, lineHeight: 1.5 },
  card: { padding: 20, border: "1px solid #E2E8F0", borderRadius: 16, background: "#fff", boxShadow: "0 8px 24px rgba(31,58,95,.08)" },
  label: { display: "block", marginBottom: 8, fontSize: 14, fontWeight: 700 },
  input: { width: "100%", boxSizing: "border-box", padding: "14px 16px", border: "2px solid #CBD5E1", borderRadius: 10, fontSize: 24, textAlign: "center" },
  callButton: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, padding: "14px 16px", border: 0, borderRadius: 10, background: "#1F3A5F", color: "#fff", fontSize: 17, fontWeight: 800, cursor: "pointer" },
  lastCall: { marginTop: 24, padding: 16, borderRadius: 12, background: "#F1F5F9", textAlign: "center" },
  lastCallLabel: { marginBottom: 4, color: "#64748B", fontSize: 13 },
  lastCallNumber: { color: "#1F3A5F", fontSize: 32, fontWeight: 800 },
  repeatButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, padding: "10px 16px", border: "1px solid #CBD5E1", borderRadius: 9, background: "#fff", color: "#1F3A5F", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  message: { minHeight: 20, margin: "12px 0 0", color: "#475569", fontSize: 13, textAlign: "center" },
  error: { color: "#B42318" },
};

function speakPickupNumber(number) {
  if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
    throw new Error("此瀏覽器不支援語音播報。");
  }

  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(formatManualPickupAnnouncement(number));
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

  return new Promise((resolve, reject) => {
    utterance.onend = resolve;
    utterance.onerror = (event) => reject(new Error(`語音播報失敗：${event.error || "未知錯誤"}`));
    window.speechSynthesis.speak(utterance);
  });
}

export default function ManualPickupCallPage() {
  const [numberInput, setNumberInput] = useState("");
  const [lastCalledNumber, setLastCalledNumber] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio("/audio/queue-chime.mpeg");
    audio.preload = "auto";
    audio.load();
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const playChime = () => new Promise((resolve, reject) => {
    const audio = audioRef.current;
    if (!audio) {
      reject(new Error("提示音尚未準備好，請再試一次。"));
      return;
    }

    const finish = (errorToReport) => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      if (errorToReport) reject(errorToReport);
      else resolve();
    };
    const onEnded = () => finish();
    const onError = () => finish(new Error("提示音播放失敗，請檢查裝置音量後重試。"));

    audio.pause();
    audio.currentTime = 0;
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.play().catch(() => finish(new Error("瀏覽器未能播放提示音，請再按一次叫號。")));
  });

  const callNumber = async (number) => {
    if (isCalling) return;
    setIsCalling(true);
    setError("");
    setMessage("");
    setLastCalledNumber(number);

    try {
      await playChime();
      await speakPickupNumber(number);
      setMessage(`已叫 ${number} 號取貨。`);
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : "叫號失敗，請再試一次。");
    } finally {
      setIsCalling(false);
    }
  };

  const submitCall = (event) => {
    event.preventDefault();
    const number = normalizeManualPickupNumber(numberInput);
    if (!number) {
      setError("請輸入 1 至 999 的籌號。");
      setMessage("");
      return;
    }
    setNumberInput(number);
    void callNumber(number);
  };

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>取貨叫號</h1>
      <p style={styles.description}>輸入籌號後，系統會播放提示音並叫「幾號請取貨」。</p>

      <section style={styles.card} aria-label="手動取貨叫號">
        <form onSubmit={submitCall}>
          <label htmlFor="pickup-call-number" style={styles.label}>籌號（1–999）</label>
          <input
            id="pickup-call-number"
            name="pickupCallNumber"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            autoComplete="off"
            value={numberInput}
            onChange={(event) => setNumberInput(event.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="輸入號碼"
            aria-describedby="pickup-call-message"
            style={styles.input}
          />
          <button type="submit" disabled={isCalling} style={{ ...styles.callButton, opacity: isCalling ? 0.65 : 1 }}>
            <Volume2 size={20} aria-hidden="true" />
            {isCalling ? "播放中…" : "叫號"}
          </button>
        </form>

        {lastCalledNumber && (
          <div style={styles.lastCall}>
            <div style={styles.lastCallLabel}>最近叫號</div>
            <div style={styles.lastCallNumber}>{lastCalledNumber} 號</div>
            <button
              type="button"
              disabled={isCalling}
              onClick={() => void callNumber(lastCalledNumber)}
              style={{ ...styles.repeatButton, opacity: isCalling ? 0.65 : 1 }}
            >
              <RotateCcw size={17} aria-hidden="true" />
              重叫
            </button>
          </div>
        )}

        <p id="pickup-call-message" role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"} style={{ ...styles.message, ...(error ? styles.error : {}) }}>
          {error || message}
        </p>
      </section>
    </main>
  );
}
