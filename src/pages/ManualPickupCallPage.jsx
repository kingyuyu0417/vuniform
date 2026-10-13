import React, { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { formatManualPickupAnnouncement, normalizeManualPickupNumber } from "../data/manualPickupCall.js";

const styles = {
  page: { maxWidth: 480, margin: "0 auto", padding: "24px 16px 32px", color: "#1F2937" },
  title: { margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: "#1F3A5F" },
  description: { margin: "0 0 24px", color: "#64748B", fontSize: 14, lineHeight: 1.5 },
  card: { padding: 20, border: "1px solid #E2E8F0", borderRadius: 16, background: "#fff", boxShadow: "0 8px 24px rgba(31,58,95,.08)" },
  label: { display: "block", marginBottom: 8, fontSize: 14, fontWeight: 700 },
  input: { width: "100%", boxSizing: "border-box", padding: "14px 16px", border: "2px solid #CBD5E1", borderRadius: 10, fontSize: 24, textAlign: "center" },
  callButtons: { display: "grid", gap: 10, marginTop: 12 },
  callButton: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 16px", border: 0, borderRadius: 10, background: "#1F3A5F", color: "#fff", fontSize: 17, fontWeight: 800, cursor: "pointer" },
  message: { minHeight: 20, margin: "12px 0 0", color: "#475569", fontSize: 13, textAlign: "center" },
  error: { color: "#B42318" },
};

function speakPickupNumber(number, language) {
  if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
    throw new Error("此瀏覽器不支援語音播報。");
  }

  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(formatManualPickupAnnouncement(number, language));
  const voices = window.speechSynthesis.getVoices();
  const voice = language === "yue"
    ? voices.find((candidate) => /^yue(?:[-_]hk)?$/i.test(candidate.lang))
      || voices.find((candidate) => /^yue[-_]/i.test(candidate.lang))
      || voices.find((candidate) => /^zh[-_]hk/i.test(candidate.lang))
      || voices.find((candidate) => /cantonese|粵語|广东话|廣東話/i.test(candidate.name))
    : language === "en"
      ? voices.find((candidate) => /^en[-_]gb/i.test(candidate.lang))
        || voices.find((candidate) => /^en[-_]/i.test(candidate.lang))
      : voices.find((candidate) => /^zh[-_]cn/i.test(candidate.lang))
        || voices.find((candidate) => /^zh[-_]sg/i.test(candidate.lang))
        || voices.find((candidate) => /^zh[-_]/i.test(candidate.lang) && !/^zh[-_]hk/i.test(candidate.lang));
  const defaultLocale = language === "en" ? "en-GB" : language === "zh" ? "zh-CN" : "yue-HK";
  utterance.lang = voice?.lang || defaultLocale;
  if (voice) utterance.voice = voice;
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
  const [isCalling, setIsCalling] = useState(false);
  const [callingLanguage, setCallingLanguage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const chimeBufferRef = useRef(null);
  const chimeBufferReadyRef = useRef(Promise.resolve(null));

  useEffect(() => {
    const audio = new Audio("/audio/queue-chime.mpeg");
    audio.preload = "auto";
    audio.load();
    audioRef.current = audio;

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      return () => {
        audio.pause();
        audioRef.current = null;
      };
    }

    const context = new AudioContextConstructor();
    let active = true;
    audioContextRef.current = context;
    chimeBufferReadyRef.current = fetch("/audio/queue-chime.mpeg")
      .then((response) => {
        if (!response.ok) throw new Error(`提示音載入失敗：${response.status}`);
        return response.arrayBuffer();
      })
      .then((audioData) => context.decodeAudioData(audioData))
      .then((decoded) => {
        if (!active) return null;

        const firstSoundFrame = Math.min(Math.round(decoded.sampleRate * 0.9), decoded.length - 1);
        const channelPeaks = [];
        for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
          const samples = decoded.getChannelData(channel);
          let peak = 0;
          for (let frame = firstSoundFrame; frame < samples.length; frame += 1) {
            peak = Math.max(peak, Math.abs(samples[frame]));
          }
          channelPeaks.push(peak);
        }

        let lastSoundFrame = firstSoundFrame;
        for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
          const samples = decoded.getChannelData(channel);
          const silenceThreshold = channelPeaks[channel] * 0.01;
          for (let frame = samples.length - 1; frame >= firstSoundFrame; frame -= 1) {
            if (Math.abs(samples[frame]) > silenceThreshold) {
              lastSoundFrame = Math.max(lastSoundFrame, frame);
              break;
            }
          }
        }

        const trimmed = context.createBuffer(
          decoded.numberOfChannels,
          lastSoundFrame - firstSoundFrame + 1,
          decoded.sampleRate,
        );
        for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
          trimmed.copyToChannel(
            decoded.getChannelData(channel).subarray(firstSoundFrame, lastSoundFrame + 1),
            channel,
          );
        }
        chimeBufferRef.current = trimmed;
        return trimmed;
      })
      .catch((loadError) => {
        if (active) console.warn("取貨叫號提示音無法預先準備", loadError);
        return null;
      });

    return () => {
      active = false;
      audio.pause();
      audioRef.current = null;
      audioContextRef.current = null;
      chimeBufferRef.current = null;
      chimeBufferReadyRef.current = Promise.resolve(null);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      void context.close();
    };
  }, []);

  const playChime = async () => {
    const context = audioContextRef.current;
    if (context) {
      if (context.state === "suspended") await context.resume();
      const buffer = chimeBufferRef.current || await chimeBufferReadyRef.current;
      if (buffer) {
        return new Promise((resolve, reject) => {
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          source.onended = resolve;
          try {
            source.start();
          } catch (playError) {
            reject(playError);
          }
        });
      }
    }

    return new Promise((resolve, reject) => {
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
      audio.currentTime = 0.9;
      audio.addEventListener("ended", onEnded, { once: true });
      audio.addEventListener("error", onError, { once: true });
      audio.play().catch(() => finish(new Error("瀏覽器未能播放提示音，請再按一次叫號。")));
    });
  };

  const callNumber = async (number, language) => {
    if (isCalling) return;
    setIsCalling(true);
    setCallingLanguage(language);
    setError("");
    setMessage("");

    try {
      await playChime();
      await speakPickupNumber(number, language);
      setMessage(language === "en"
        ? `Number ${number} has been called for pickup.`
        : language === "zh"
          ? `已叫 ${number} 號取貨。`
          : `已叫 ${number} 號取貨。`);
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : "叫號失敗，請再試一次。");
    } finally {
      setIsCalling(false);
      setCallingLanguage("");
    }
  };

  const submitCall = (event, language = "yue") => {
    event.preventDefault();
    const number = normalizeManualPickupNumber(numberInput);
    if (!number) {
      setError("請輸入 1 至 999 的籌號。");
      setMessage("");
      return;
    }
    setNumberInput(number);
    void callNumber(number, language);
  };

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>取貨叫號</h1>
      <p style={styles.description}>輸入籌號，再選擇播報語言。</p>

      <section style={styles.card} aria-label="手動取貨叫號">
        <form onSubmit={(event) => submitCall(event, event.nativeEvent.submitter?.value || "yue")}>
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
          <div style={styles.callButtons}>
            {[
              { value: "yue", label: "廣東話叫號" },
              { value: "en", label: "英文叫號" },
              { value: "zh", label: "普通話叫號" },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="submit"
                value={value}
                disabled={isCalling}
                aria-label={label}
                style={{ ...styles.callButton, opacity: isCalling ? 0.65 : 1 }}
              >
                <Volume2 size={20} aria-hidden="true" />
                {isCalling && callingLanguage === value ? "播放中…" : label}
              </button>
            ))}
          </div>
        </form>

        <p id="pickup-call-message" role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"} style={{ ...styles.message, ...(error ? styles.error : {}) }}>
          {error || message}
        </p>
      </section>
    </main>
  );
}
