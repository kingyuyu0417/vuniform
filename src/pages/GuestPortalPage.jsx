import React, { useState, useEffect } from "react";
import { QrCode, Copy, Home, LogOut, Info, Clock } from "lucide-react";
import qrcodeGenerator from "qrcode-generator";

const GuestPortalPage = ({ schoolName, guestInfo, queueNo, onLogout }) => {
  const [qrCode, setQrCode] = useState(null);
  const [registrationUrl, setRegistrationUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 生成該學校的登記連結
    const url = `${window.location.origin}?school=${encodeURIComponent(schoolName)}&tab=guest`;
    setRegistrationUrl(url);
    generateQRCode(url);
  }, [schoolName]);

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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(registrationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={styles.container}>
      {/* 頂部欄 */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.schoolInfo}>
            <h1 style={styles.schoolName}>{schoolName}</h1>
            <p style={styles.subtitle}>客人登記系統</p>
          </div>
          <button
            onClick={onLogout}
            style={styles.logoutButton}
            title="登出"
          >
            <LogOut size={18} />
            登出
          </button>
        </div>
      </div>

      {/* 主要內容 */}
      <div style={styles.mainContent}>
        {/* 登記狀態卡 */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Info size={20} />
            <h2 style={styles.cardTitle}>您的登記信息</h2>
          </div>
          <div style={styles.cardContent}>
            {guestInfo ? (
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <label style={styles.infoLabel}>姓名</label>
                  <div style={styles.infoValue}>{guestInfo.name || "未提供"}</div>
                </div>
                <div style={styles.infoItem}>
                  <label style={styles.infoLabel}>班級</label>
                  <div style={styles.infoValue}>{guestInfo.class || "未提供"}</div>
                </div>
                <div style={styles.infoItem}>
                  <label style={styles.infoLabel}>身高 (cm)</label>
                  <div style={styles.infoValue}>{guestInfo.height || "未提供"}</div>
                </div>
                <div style={styles.infoItem}>
                  <label style={styles.infoLabel}>體重 (kg)</label>
                  <div style={styles.infoValue}>{guestInfo.weight || "未提供"}</div>
                </div>
                <div style={styles.infoItem}>
                  <label style={styles.infoLabel}>電話</label>
                  <div style={styles.infoValue}>{guestInfo.phone || "未提供"}</div>
                </div>
              </div>
            ) : (
              <div style={styles.noData}>
                尚未進行登記。請先完成上方的登記表格。
              </div>
            )}
          </div>
        </div>

        {/* 排隊狀態卡 */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Clock size={20} />
            <h2 style={styles.cardTitle}>排隊狀態</h2>
          </div>
          <div style={styles.cardContent}>
            {queueNo ? (
              <div style={styles.queueStatus}>
                <div style={styles.queueNoDisplay}>
                  <div style={styles.queueNoLabel}>你的排隊號碼</div>
                  <div style={styles.queueNoValue}>{queueNo}</div>
                </div>
                <div style={styles.queueMessage}>
                  <p>✓ 登記成功！</p>
                  <p>請保存您的排隊號碼，按照號碼順序到達店鋪進行度身選購。</p>
                </div>
              </div>
            ) : (
              <div style={styles.noData}>
                尚未獲得排隊號碼。請先完成登記。
              </div>
            )}
          </div>
        </div>

        {/* 分享登記連結 */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <QrCode size={20} />
            <h2 style={styles.cardTitle}>分享登記連結</h2>
          </div>
          <div style={styles.cardContent}>
            <div style={styles.qrCodeSection}>
              <div style={styles.qrCodeBox}>
                {qrCode ? (
                  <img src={qrCode} alt="QR Code" style={styles.qrImage} />
                ) : (
                  <div style={styles.qrLoading}>生成中...</div>
                )}
              </div>
              <p style={styles.qrDescription}>
                掃瞄此二維碼或複製下方連結，分享給其他同學
              </p>
            </div>

            <div style={styles.linkSection}>
              <label style={styles.label}>登記連結</label>
              <div style={styles.linkBox}>
                <input
                  type="text"
                  value={registrationUrl}
                  readOnly
                  style={styles.linkInput}
                />
                <button
                  onClick={handleCopyLink}
                  style={{
                    ...styles.copyButton,
                    ...(copied && styles.copyButtonActive),
                  }}
                  title="複製連結"
                >
                  <Copy size={16} />
                  {copied ? "已複製" : "複製"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 注意事項 */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>⚠️ 重要提示</h3>
          <div style={styles.cardContent}>
            <ul style={styles.notesList}>
              <li>本頁面只展示您的登記信息和排隊狀態</li>
              <li>請妥善保管您的排隊號碼</li>
              <li>如有任何問題，請聯絡店員</li>
              <li>您可以將登記連結分享給其他同學</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f9fafb",
  },
  header: {
    background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
    color: "white",
    padding: "24px 20px",
    borderBottom: "3px solid #1e40af",
  },
  headerContent: {
    maxWidth: "900px",
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: "28px",
    fontWeight: "bold",
    margin: "0 0 8px 0",
  },
  subtitle: {
    fontSize: "14px",
    opacity: 0.9,
    margin: 0,
  },
  logoutButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    color: "white",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "background-color 0.3s",
  },
  mainContent: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "24px 20px",
  },
  card: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
    color: "#1e3a8a",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: "600",
    margin: 0,
  },
  cardContent: {
    fontSize: "14px",
    color: "#374151",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
  },
  infoItem: {
    padding: "12px",
    backgroundColor: "#f3f4f6",
    borderRadius: "8px",
  },
  infoLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: "6px",
  },
  infoValue: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#1f2937",
  },
  queueStatus: {
    textAlign: "center",
  },
  queueNoDisplay: {
    padding: "30px 20px",
    backgroundColor: "#ecfdf5",
    borderRadius: "12px",
    border: "2px solid #10b981",
    marginBottom: "20px",
  },
  queueNoLabel: {
    fontSize: "14px",
    color: "#059669",
    fontWeight: "600",
    marginBottom: "8px",
  },
  queueNoValue: {
    fontSize: "48px",
    fontWeight: "bold",
    color: "#10b981",
    letterSpacing: "4px",
  },
  queueMessage: {
    fontSize: "14px",
    color: "#374151",
    lineHeight: "1.6",
  },
  noData: {
    padding: "20px",
    backgroundColor: "#fef3c7",
    borderRadius: "8px",
    border: "1px solid #fcd34d",
    color: "#92400e",
    textAlign: "center",
  },
  qrCodeSection: {
    textAlign: "center",
    marginBottom: "24px",
  },
  qrCodeBox: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: "12px",
    padding: "20px",
    minHeight: "280px",
    marginBottom: "12px",
  },
  qrImage: {
    maxWidth: "200px",
    maxHeight: "200px",
    borderRadius: "8px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  qrLoading: {
    fontSize: "16px",
    color: "#9ca3af",
  },
  qrDescription: {
    fontSize: "14px",
    color: "#6b7280",
    margin: 0,
  },
  linkSection: {
    marginTop: "16px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "8px",
  },
  linkBox: {
    display: "flex",
    gap: "8px",
  },
  linkInput: {
    flex: 1,
    padding: "12px 16px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "13px",
    fontFamily: "monospace",
    backgroundColor: "#f9fafb",
  },
  copyButton: {
    padding: "12px 16px",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    transition: "background-color 0.3s",
  },
  copyButtonActive: {
    backgroundColor: "#10b981",
  },
  notesList: {
    margin: "0",
    paddingLeft: "20px",
    lineHeight: "1.8",
  },
};

export default GuestPortalPage;
