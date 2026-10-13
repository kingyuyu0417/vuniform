import React, { useEffect, useRef, useState } from "react";
import { ExternalLink, Volume2 } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import { createManualPickupDisplayConnection } from "../services/manualPickupDisplayService.js";
import {
  formatManualPickupAnnouncement,
  getPickupSpeechStartDelayMs,
  normalizeManualPickupNumber,
} from "../data/manualPickupCall.js";

const styles = {
  page: { maxWidth: 480, margin: "0 auto", padding: "8px 12px 12px", color: "#1F2937" },
  title: { margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#1F3A5F" },
  description: { margin: "0 0 10px", color: "#64748B", fontSize: 13, lineHeight: 1.4 },
  card: { padding: 14, border: "1px solid #E2E8F0", borderRadius: 14, background: "#fff", boxShadow: "0 8px 24px rgba(31,58,95,.08)" },
  label: { display: "block", marginBottom: 5, fontSize: 14, fontWeight: 700 },
  input: { width: "100%", minHeight: 64, boxSizing: "border-box", padding: "14px 12px", border: "2px solid #CBD5E1", borderRadius: 10, fontSize: 28, textAlign: "center" },
  callButtons: { display: "grid", gap: 7, marginTop: 9 },
  callButton: { width: "100%", minHeight: 64, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 12px", border: 0, borderRadius: 10, color: "#fff", fontSize: 20, fontWeight: 800, cursor: "pointer" },
  message: { minHeight: 18, margin: "8px 0 0", color: "#475569", fontSize: 13, textAlign: "center" },
  error: { color: "#B42318" },
  displayLink: { width: "100%", minHeight: 44, boxSizing: "border-box", marginTop: 10, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, border: "1px solid #93C5FD", borderRadius: 9, background: "#EFF6FF", color: "#1D4ED8", fontSize: 14, fontWeight: 800, textDecoration: "none" },
  syncStatus: { margin: "8px 0 0", color: "#64748B", fontSize: 12, textAlign: "center" },
};

function speakPickupNumber(number, language) {
  if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
    return Promise.reject(new Error("此瀏覽器不支援語音播報。"));
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
  const schoolId = new URLSearchParams(window.location.search).get("school_id")
    || new URLSearchParams(window.location.search).get("school")
    || "";
  const displayUrl = schoolId
    ? `${window.location.origin}/queue-live-display?school_id=${encodeURIComponent(schoolId)}`
    : "";
  const [numberInput, setNumberInput] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [callingLanguage, setCallingLanguage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [displayConnectionStatus, setDisplayConnectionStatus] = useState(schoolId ? "CONNECTING" : "MISSING_SCHOOL");
  const displayConnectionRef = useRef(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const chimeBufferRef = useRef(null);
  const chimeBufferReadyRef = useRef(Promise.resolve(null));

  useEffect(() => {
    if (!schoolId) return undefined;
    let active = true;
    try {
      const connection = createManualPickupDisplayConnection({
        schoolId,
        canPublishSnapshot: true,
        client: supabase,
        enabled: isSupabaseConfigured,
        onStatus: (status) => {
          if (active) setDisplayConnectionStatus(status);
        },
      });
      displayConnectionRef.current = connection;
      return () => {
        active = false;
        displayConnectionRef.current = null;
        connection.unsubscribe();
      };
    } catch (connectionError) {
      setDisplayConnectionStatus("CHANNEL_ERROR");
      console.error("客人叫號畫面連線失敗", connectionError);
      return undefined;
    }
  }, [schoolId]);

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

  const playChime = async (onChimeEnding) => {
    const context = audioContextRef.current;
    if (context) {
      if (context.state === "suspended") await context.resume();
      const buffer = chimeBufferRef.current || await chimeBufferReadyRef.current;
      if (buffer) {
        return new Promise((resolve, reject) => {
          let speechStarted = false;
          const startSpeech = () => {
            if (speechStarted) return;
            speechStarted = true;
            onChimeEnding();
          };
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          const speechTimer = window.setTimeout(
            startSpeech,
            getPickupSpeechStartDelayMs(buffer.duration),
          );
          source.onended = () => {
            window.clearTimeout(speechTimer);
            startSpeech();
            resolve();
          };
          try {
            source.start();
          } catch (playError) {
            window.clearTimeout(speechTimer);
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

      let speechStarted = false;
      const speechDelayMs = Number.isFinite(audio.duration)
        ? getPickupSpeechStartDelayMs(audio.duration - 0.9)
        : 0;
      const speechTimer = window.setTimeout(() => {
        speechStarted = true;
        onChimeEnding();
      }, speechDelayMs);
      const finish = (errorToReport) => {
        window.clearTimeout(speechTimer);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        if (errorToReport) reject(errorToReport);
        else resolve();
      };
      const onEnded = () => {
        if (!speechStarted) onChimeEnding();
        finish();
      };
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
      let speechResultPromise;
      const displayPublishPromise = displayConnectionRef.current
        ? displayConnectionRef.current.publish(number, language)
          .then(() => true)
          .catch((syncError) => {
            console.warn("叫號未能同步至客人畫面", syncError);
            return false;
          })
        : Promise.resolve(false);
      await playChime(() => {
        speechResultPromise = speakPickupNumber(number, language).then(
          () => ({ error: null }),
          (speechError) => ({ error: speechError }),
        );
      });
      const speechResult = await speechResultPromise;
      if (speechResult.error) throw speechResult.error;
      const calledMessage = language === "en"
        ? `Number ${number} has been called for pickup.`
        : language === "zh"
          ? `已叫 ${number} 號取貨。`
          : `已叫 ${number} 號取貨。`;
      const displaySynced = await displayPublishPromise;
      setMessage(`${calledMessage}${schoolId ? (displaySynced ? " 客人畫面已同步。" : " 注意：客人畫面未同步，請檢查連線。") : ""}`);
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
              { value: "yue", label: "廣東話叫號", color: "#15803D" },
              { value: "en", label: "英文叫號", color: "#2563EB" },
              { value: "zh", label: "普通話叫號", color: "#7C3AED" },
            ].map(({ value, label, color }) => (
              <button
                key={value}
                type="submit"
                value={value}
                disabled={isCalling}
                aria-label={label}
                style={{ ...styles.callButton, background: color, opacity: isCalling ? 0.65 : 1 }}
              >
                <Volume2 size={20} aria-hidden="true" />
                {isCalling && callingLanguage === value ? "播放中…" : label}
              </button>
            ))}
          </div>
        </form>

        {displayUrl
          ? <a href={displayUrl} target="_blank" rel="noopener noreferrer" style={styles.displayLink}><ExternalLink size={17} aria-hidden="true" /> 開啟客人叫號畫面</a>
          : <p style={{ ...styles.syncStatus, color: "#B42318" }}>此連結未指定學校，無法同步客人畫面。</p>}
        {schoolId && <p role="status" style={styles.syncStatus}>
          {displayConnectionStatus === "SUBSCRIBED" ? "客人畫面已連線" : ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(displayConnectionStatus) ? "客人畫面連線中斷，叫號仍可播出但不會同步" : "正在連接客人畫面…"}
        </p>}
        <p id="pickup-call-message" role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"} style={{ ...styles.message, ...(error ? styles.error : {}) }}>
          {error || message}
        </p>
      </section>
    </main>
  );
}
