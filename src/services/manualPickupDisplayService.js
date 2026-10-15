const CALL_EVENT = "pickup-called";
const SNAPSHOT_REQUEST_EVENT = "pickup-display-snapshot-request";
const supportedLanguages = new Set(["yue", "en", "zh"]);

export const getManualPickupDisplayTopic = (schoolId = "") => (
  `public-manual-pickup-display-${encodeURIComponent(String(schoolId || "").trim())}`
);

export const normalizeManualPickupDisplayCall = (payload = {}) => {
  const queueNumber = String(payload.queueNumber || "").trim();
  if (!/^(?:[1-9]\d{0,2})$/.test(queueNumber)) return null;
  if (!supportedLanguages.has(payload.language)) return null;
  return {
    queueNumber,
    language: payload.language,
    callId: typeof payload.callId === "string" ? payload.callId : "",
    calledAt: typeof payload.calledAt === "string" ? payload.calledAt : "",
  };
};

export const createManualPickupAnnouncementQueue = ({ announce, onError } = {}) => {
  if (typeof announce !== "function") {
    throw new Error("叫號播報佇列需要有效的播報函式。");
  }

  const calls = [];
  const seenCallKeys = new Set();
  let isAnnouncing = false;
  let isPaused = false;

  const drain = async () => {
    if (isAnnouncing || isPaused) return;
    isAnnouncing = true;
    try {
      while (calls.length && !isPaused) {
        const { call } = calls[0];
        try {
          await announce(call);
          calls.shift();
        } catch (error) {
          isPaused = true;
          onError?.(error, call);
        }
      }
    } finally {
      isAnnouncing = false;
    }
  };

  return {
    enqueue(call) {
      const key = call.callId || `${call.queueNumber}::${call.language}::${call.calledAt}`;
      if (seenCallKeys.has(key)) return Promise.resolve();
      seenCallKeys.add(key);
      calls.push({ call, key });
      return drain();
    },
    resume() {
      isPaused = false;
      return drain();
    },
    clear() {
      calls.length = 0;
      seenCallKeys.clear();
    },
  };
};

export const createManualPickupDisplayConnection = ({
  schoolId = "",
  onCall,
  onStatus,
  canPublishSnapshot = false,
  client,
  enabled = true,
} = {}) => {
  const normalizedSchoolId = String(schoolId || "").trim();
  if (!normalizedSchoolId) throw new Error("缺少學校資料，未能連接客人叫號畫面。");
  if (!enabled || !client) throw new Error("雲端連線未設定，客人叫號畫面暫時無法同步。");

  let isSubscribed = false;
  let latestCall = null;
  const channel = client
    .channel(getManualPickupDisplayTopic(normalizedSchoolId))
    .on("broadcast", { event: CALL_EVENT }, ({ payload }) => {
      const call = normalizeManualPickupDisplayCall(payload);
      if (!call) return;
      latestCall = call;
      onCall?.(call);
    })
    .on("broadcast", { event: SNAPSHOT_REQUEST_EVENT }, () => {
      if (!canPublishSnapshot || !isSubscribed || !latestCall) return;
      void channel.send({
        type: "broadcast",
        event: CALL_EVENT,
        payload: latestCall,
      }).then((result) => {
        if (result !== "ok") console.warn("客人叫號畫面最新籌號同步失敗", result);
      }).catch((error) => console.warn("客人叫號畫面最新籌號同步失敗", error));
    });
  channel.subscribe((status) => {
    isSubscribed = status === "SUBSCRIBED";
    onStatus?.(status);
    if (isSubscribed && !canPublishSnapshot) {
      void channel.send({
        type: "broadcast",
        event: SNAPSHOT_REQUEST_EVENT,
        payload: {},
      }).then((result) => {
        if (result !== "ok") console.warn("客人叫號畫面最新籌號查詢失敗", result);
      }).catch((error) => console.warn("客人叫號畫面最新籌號查詢失敗", error));
    }
  });

  return {
    async publish(queueNumber, language) {
      if (!isSubscribed) throw new Error("客人叫號畫面尚未連線，請稍後重試。");
      const call = normalizeManualPickupDisplayCall({
        queueNumber,
        language,
        callId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        calledAt: new Date().toISOString(),
      });
      if (!call) throw new Error("籌號或播報語言無效，未能同步客人畫面。");
      latestCall = call;
      const result = await channel.send({
        type: "broadcast",
        event: CALL_EVENT,
        payload: call,
      });
      if (result !== "ok") throw new Error("客人叫號畫面同步失敗，請檢查網絡連線。");
    },
    unsubscribe() {
      void client.removeChannel(channel);
    },
  };
};
