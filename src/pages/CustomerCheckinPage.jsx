import React, { useState } from "react";
import qrcodeGenerator from "qrcode-generator";
import { Copy, QrCode } from "lucide-react";
import { queueOrderService } from "../services/queueOrderService";

const emptyForm = {
  guestName: "",
  className: "",
  heightCm: "",
  weightKg: "",
  phone: "",
  notes: "",
};

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #D5DDE5",
  fontSize: 14,
  background: "#fff",
};

export default function CustomerCheckinPage({ onSubmit, school = "" }) {
  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrCode, setQrCode] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const generateQRCode = (url) => {
    try {
      const qr = qrcodeGenerator(0, "M");
      qr.addData(url);
      qr.make();
      setQrCode(qr.createDataURL(10));
    } catch (error) {
      console.error("QR Code 生成失敗:", error);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const name = form.guestName.trim();
    const className = form.className.trim();
    const phone = form.phone.trim();

    if (!name || !className || !phone) {
      setError("請填寫姓名、班級和電話");
      return;
    }

    setIsLoading(true);
    try {
      const schoolId = school || "default-school";
      const queue = await queueOrderService.createOrder({
        school_id: schoolId,
        customer_info: {
          guestName: name,
          className,
          heightCm: form.heightCm || "",
          weightKg: form.weightKg || "",
          phone,
          notes: form.notes || "",
        },
      });

      const record = {
        ...queue,
        queueNo: queue.queue_number,
        guestName: name,
        className,
        phone,
        school: schoolId,
      };

      const trackingUrl = `${window.location.origin}?school_id=${encodeURIComponent(schoolId)}&queue=${encodeURIComponent(record.queueNo)}`;
      record.recordUrl = trackingUrl;
      generateQRCode(trackingUrl);

      setSubmitted(record);
      onSubmit?.(record);
      setForm(emptyForm);
    } catch (err) {
      setError("登記失敗：" + (err.message || "未知錯誤"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyQueue = () => {
    if (submitted?.queueNo) {
      navigator.clipboard.writeText(submitted.queueNo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenRecord = () => {
    if (submitted?.recordUrl) {
      window.open(submitted.recordUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ background: "#F7F7F5", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1F3A5F", marginBottom: 12 }}>客人登記</div>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#45515F" }}>姓名</label>
            <input
              value={form.guestName}
              onChange={handleChange("guestName")}
              placeholder="例如：陳小美"
              style={fieldStyle}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#45515F" }}>班級</label>
            <input
              value={form.className}
              onChange={handleChange("className")}
              placeholder="例如：中二A"
              style={fieldStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#45515F" }}>身高（cm）</label>
              <input
                value={form.heightCm}
                onChange={handleChange("heightCm")}
                placeholder="160"
                style={fieldStyle}
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#45515F" }}>體重（kg）</label>
              <input
                value={form.weightKg}
                onChange={handleChange("weightKg")}
                placeholder="48"
                style={fieldStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#45515F" }}>電話</label>
            <input
              value={form.phone}
              onChange={handleChange("phone")}
              placeholder="例如：91234567"
              style={fieldStyle}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#45515F" }}>備註</label>
            <textarea
              value={form.notes}
              onChange={handleChange("notes")}
              rows={3}
              placeholder="可輸入特別要求"
              style={{ ...fieldStyle, resize: "vertical" }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="pos-btn"
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: isLoading ? "#C0C8D0" : "#1F3A5F",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "提交中…" : "提交登記"}
          </button>
        </form>
      </div>

      {error && (
        <div style={{ background: "#FFE5E5", border: "1px solid #EE5A6F", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#C53030", marginBottom: 6 }}>錯誤</div>
          <div style={{ fontSize: 13, color: "#A60E0E" }}>{error}</div>
        </div>
      )}

      {submitted && (
        <div style={{ background: "#EAF7EF", border: "1px solid #B7E0C6", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#21693C", marginBottom: 16, textAlign: "center" }}>✓ 登記成功</div>

          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#255F3D", marginBottom: 8 }}>您的排隊號</div>
            <div
              style={{
                fontSize: 48,
                fontWeight: "bold",
                color: "#10b981",
                letterSpacing: "4px",
                marginBottom: 8,
                fontFamily: "monospace",
              }}
            >
              {submitted.queueNo}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={handleCopyQueue}
                style={{
                  padding: "6px 12px",
                  backgroundColor: copied ? "#10b981" : "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Copy size={14} />
                {copied ? "已複製" : "複製號碼"}
              </button>
              <button
                onClick={handleOpenRecord}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#0f766e",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                查看我的單
              </button>
            </div>
          </div>

          {qrCode && (
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "#255F3D", marginBottom: 8 }}>專屬單據 QR CODE</div>
              <div
                style={{
                  background: "#f3f4f6",
                  borderRadius: "8px",
                  padding: "16px",
                  display: "inline-block",
                }}
              >
                <img src={qrCode} alt="Queue QR Code" style={{ width: "170px", height: "170px" }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

