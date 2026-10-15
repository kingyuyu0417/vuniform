import assert from "node:assert/strict";
import test from "node:test";
import {
  createManualPickupAnnouncementQueue,
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
    { queueNumber: "28", language: "yue", callId: "", calledAt: "now" },
  );
  assert.equal(normalizeManualPickupDisplayCall({ queueNumber: "1000", language: "yue" }), null);
  assert.equal(normalizeManualPickupDisplayCall({ queueNumber: "12", language: "fr" }), null);
});

test("announces simultaneous calls in received order without overlapping", async () => {
  const firstCall = { queueNumber: "21", language: "yue", calledAt: "first" };
  const secondCall = { queueNumber: "22", language: "en", calledAt: "second" };
  const started = [];
  const completed = [];
  let finishFirst;
  const queue = createManualPickupAnnouncementQueue({
    announce: async (call) => {
      started.push(call);
      if (call === firstCall) await new Promise((resolve) => { finishFirst = resolve; });
      completed.push(call);
    },
  });

  const firstDrain = queue.enqueue(firstCall);
  await Promise.resolve();
  const secondDrain = queue.enqueue(secondCall);

  assert.deepEqual(started, [firstCall]);
  finishFirst();
  await Promise.all([firstDrain, secondDrain]);

  assert.deepEqual(started, [firstCall, secondCall]);
  assert.deepEqual(completed, [firstCall, secondCall]);
});

test("does not replay duplicate realtime snapshots", async () => {
  const call = { queueNumber: "28", language: "yue", callId: "same-call", calledAt: "now" };
  const announced = [];
  const queue = createManualPickupAnnouncementQueue({
    announce: async (receivedCall) => announced.push(receivedCall),
  });

  await queue.enqueue(call);
  await queue.enqueue(call);

  assert.deepEqual(announced, [call]);
});

test("keeps simultaneous calls with matching numbers and timestamps distinct", async () => {
  const firstCall = { queueNumber: "28", language: "yue", callId: "device-one", calledAt: "same-time" };
  const secondCall = { queueNumber: "28", language: "yue", callId: "device-two", calledAt: "same-time" };
  const announced = [];
  const queue = createManualPickupAnnouncementQueue({
    announce: async (call) => announced.push(call),
  });

  await queue.enqueue(firstCall);
  await queue.enqueue(secondCall);

  assert.deepEqual(announced, [firstCall, secondCall]);
});

test("retains failed calls and resumes the queue in order", async () => {
  const firstCall = { queueNumber: "21", language: "yue", calledAt: "first" };
  const secondCall = { queueNumber: "22", language: "en", calledAt: "second" };
  const attempted = [];
  const failures = [];
  let shouldFail = true;
  const queue = createManualPickupAnnouncementQueue({
    announce: async (call) => {
      attempted.push(call);
      if (call === firstCall && shouldFail) {
        shouldFail = false;
        throw new Error("audio blocked");
      }
    },
    onError: (error, call) => failures.push({ error: error.message, call }),
  });

  await queue.enqueue(firstCall);
  await queue.enqueue(secondCall);
  assert.deepEqual(attempted, [firstCall]);
  assert.deepEqual(failures, [{ error: "audio blocked", call: firstCall }]);

  await queue.resume();

  assert.deepEqual(attempted, [firstCall, firstCall, secondCall]);
});

test("resets duplicate tracking when a display connection is replaced", async () => {
  const call = { queueNumber: "28", language: "yue", callId: "reconnected-call", calledAt: "now" };
  const announced = [];
  const queue = createManualPickupAnnouncementQueue({
    announce: async (receivedCall) => announced.push(receivedCall),
  });

  await queue.enqueue(call);
  queue.clear();
  await queue.enqueue(call);

  assert.deepEqual(announced, [call, call]);
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
    callId: calls[0].payload.callId,
    calledAt: calls[0].payload.calledAt,
  });
  assert.equal(calls[1].event, "pickup-called");
  assert.deepEqual(calls[1].payload, received[0]);
  assert.deepEqual(received, [{ queueNumber: "28", language: "en", callId: "", calledAt: "now" }]);
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
