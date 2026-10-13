import assert from "node:assert/strict";
import test from "node:test";
import {
  createManualPickupDisplayConnection,
  getManualPickupDisplayTopic,
  normalizeManualPickupDisplayCall,
} from "./manualPickupDisplayService.js";

const makeRealtimeClient = () => {
  const calls = [];
  const callbacks = new Map();
  let statusCallback;
  const channel = {
    on(type, filter, handler) {
      assert.equal(type, "broadcast");
      callbacks.set(filter.event, handler);
      return this;
    },
    subscribe(handler) {
      statusCallback = handler;
      handler("SUBSCRIBED");
      return this;
    },
    async send(message) {
      calls.push(message);
      return "ok";
    },
    emit(event, payload) {
      callbacks.get(event)?.({ payload });
    },
    emitStatus(status) {
      statusCallback(status);
    },
  };
  return {
    calls,
    channel,
    client: {
      channel(topic) {
        assert.equal(topic, "public-manual-pickup-display-%E8%81%96%E5%AE%89%E5%A4%9A%E5%B0%BC%E5%AD%B8%E6%A0%A1");
        return channel;
      },
      removeChannel(receivedChannel) {
        assert.equal(receivedChannel, channel);
      },
    },
  };
};

test("scopes public display topics to a single school", () => {
  assert.equal(
    getManualPickupDisplayTopic("聖安多尼學校"),
    "public-manual-pickup-display-%E8%81%96%E5%AE%89%E5%A4%9A%E5%B0%BC%E5%AD%B8%E6%A0%A1",
  );
});

test("normalizes only supported queue numbers and announcement languages", () => {
  assert.deepEqual(
    normalizeManualPickupDisplayCall({ queueNumber: "28", language: "yue", calledAt: "now" }),
    { queueNumber: "28", language: "yue", calledAt: "now" },
  );
  assert.equal(normalizeManualPickupDisplayCall({ queueNumber: "1000", language: "yue" }), null);
  assert.equal(normalizeManualPickupDisplayCall({ queueNumber: "12", language: "fr" }), null);
});

test("publishes calls and forwards only valid received calls", async () => {
  const { client, channel, calls } = makeRealtimeClient();
  const received = [];
  const statuses = [];
  const connection = createManualPickupDisplayConnection({
    schoolId: "聖安多尼學校",
    canPublishSnapshot: true,
    onCall: (call) => received.push(call),
    onStatus: (status) => statuses.push(status),
    client,
    enabled: true,
  });

  await connection.publish("28", "yue");
  channel.emit("pickup-called", { queueNumber: "28", language: "en", calledAt: "now" });
  channel.emit("pickup-called", { queueNumber: "invalid", language: "en" });
  channel.emit("pickup-display-snapshot-request", {});
  channel.emitStatus("CLOSED");
  connection.unsubscribe();

  assert.equal(calls.length, 2);
  assert.equal(calls[0].event, "pickup-called");
  assert.deepEqual(calls[0].payload, {
    queueNumber: "28",
    language: "yue",
    calledAt: calls[0].payload.calledAt,
  });
  assert.equal(calls[1].event, "pickup-called");
  assert.deepEqual(calls[1].payload, received[0]);
  assert.deepEqual(received, [{ queueNumber: "28", language: "en", calledAt: "now" }]);
  assert.deepEqual(statuses, ["SUBSCRIBED", "CLOSED"]);
});

test("requests the latest call when a display subscribes", () => {
  const { client, calls } = makeRealtimeClient();
  createManualPickupDisplayConnection({
    schoolId: "聖安多尼學校",
    client,
    enabled: true,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].event, "pickup-display-snapshot-request");
});

test("rejects calls when the realtime subscription is not ready", async () => {
  const { client, channel } = makeRealtimeClient();
  channel.subscribe = function subscribe(handler) {
    this.emitStatus = handler;
    handler("TIMED_OUT");
    return this;
  };
  const connection = createManualPickupDisplayConnection({
    schoolId: "聖安多尼學校",
    client,
    enabled: true,
  });

  await assert.rejects(connection.publish("28", "yue"), /尚未連線/);
});
