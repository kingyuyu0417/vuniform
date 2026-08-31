import React, { useState, useEffect } from "react";
import { guestVisits } from "../services/customerFlowService";
import qrcodeGenerator from "qrcode-generator";
import { Copy, QrCode } from "lucide-react";

const emptyForm = {
  guestName: "",
  className: "",
  heightCm: "",
  weightKg: "",
  phone: "",
  notes: "",
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
      const guest = await guestVisits.create({
        guestName: name,
        className,
        heightCm: form.heightCm || "",
        weightKg: form.weightKg || "",
        phone,
        notes: form.notes || "",
        school,
      });

      // 生成排隊號（簡單格式：學校縮寫 + 流水號）
      const queueNo = `FYM-${String((guest.id || "").slice(-3)).padStart(3, "0")}`;
      guest.queueNo = queueNo;

      // 生成該客人的專屬查單連結（掃碼後直接查看自己的單）
      const trackingUrl = `${window.location.origin}?queue=${encodeURIComponent(queueNo)}`;
      guest.recordUrl = trackingUrl;
      generateQRCode(trackingUrl);

      setSubmitted(guest);
      onSubmit?.(guest);
      setForm(emptyForm);
    } catch (err) {
      setError("登記失敗：" + (err.message || "未知錯誤"));
    } finally {
      setIsLoading(false);
    }
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
          
          {/* 排隊號顯示 */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#255F3D", marginBottom: 8 }}>您的排隊號</div>
            <div style={{ 
              fontSize: 48, 
              fontWeight: "bold", 
              color: "#10b981", 
              letterSpacing: "4px",
              marginBottom: 8,
              fontFamily: "monospace"
            }}>
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

          {/* 專屬 QR CODE */}
          {qrCode && (
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "#255F3D", marginBottom: 8 }}>專屬單據 QR CODE（可掃描查看該客人的單）</div>
              <div style={{
                background: "#f3f4f6",
                borderRadius: "8px",
                padding: "16px",
                display: "inline-block",
              }}>
                <img src={qrCode} alt="Queue QR Code" style={{ width: "170px", height: "170px" }} />
              </div>
            </div>
          )}

          {/* 說明 */}
          <div style={{ fontSize: 13, color: "#255F3D", lineHeight: 1.6 }}>
            <p>✓ 登記成功，請記住您的排隊號</p>
            <p>✓ 掃描上方 QR 可直接查看該客人的單及排隊狀態</p>
            <p>✓ 店員會根據排隊號叫號</p>
            <p>✓ 請保持聯絡方式暢通</p>
            <p>✓ 您可以刷新頁面重新登記新客人</p>
          </div>
        </div>
      )}
    </div>
  );
}

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #D5DDE5",
  fontSize: 14,
  background: "#fff",
};
