import { createReceiptQrCode } from "./data/receiptQrCode.js";

self.onmessage = ({ data: receiptUrl }) => {
  try {
    self.postMessage({ code: createReceiptQrCode(receiptUrl) });
  } catch (error) {
    self.postMessage({ error: error?.message || "Unable to generate receipt QR code." });
  }
};
