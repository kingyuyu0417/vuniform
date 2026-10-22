const toBase64Url = (bytes) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const fromBase64Url = (value) => {
  const base64 = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export const encodeReceiptQrPayload = async (payload) => {
  const source = new TextEncoder().encode(String(payload));
  if (typeof CompressionStream === "undefined") {
    return { parameter: "data", value: toBase64Url(source) };
  }

  const compressedStream = new Blob([source])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const compressed = new Uint8Array(await new Response(compressedStream).arrayBuffer());
  return compressed.length < source.length
    ? { parameter: "z", value: toBase64Url(compressed) }
    : { parameter: "data", value: toBase64Url(source) };
};

export const decodeReceiptQrPayload = async ({ parameter, value }) => {
  const bytes = fromBase64Url(value);
  if (parameter !== "z") return new TextDecoder().decode(bytes);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot open compressed receipt links.");
  }

  const decompressedStream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(decompressedStream).text();
};
