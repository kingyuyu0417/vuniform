import React, { useState, useEffect } from "react";
import { QrCode, Copy, Download, Share2, Printer } from "lucide-react";
import qrcodeGenerator from "qrcode-generator";

const SchoolQRCodePage = ({ schoolName, onSchoolChange }) => {
  const [qrCode, setQrCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [schoolUrl, setSchoolUrl] = useState("");

  useEffect(() => {
    // 生成該學校專用的 URL（帶有 school 參數）
    const url = `${window.location.origin}?school=${encodeURIComponent(schoolName)}&tab=guest`;
    setSchoolUrl(url);
    generateQRCode(url);
  }, [schoolName]);

  const generateQRCode = (url) => {
    try {
      console.log("開始生成 QR Code，URL:", url);
      const qr = qrcodeGenerator(0, "M");
      qr.addData(url);
      qr.make();
      const qrDataUrl = qr.createDataURL(10);
      console.log("QR Code 生成成功");
      setQrCode(qrDataUrl);
    } catch (error) {
      console.error("QR Code 生成失敗:", error);
      // 如果 qrcodeGenerator 庫有問題，嘗試備用方案
      console.log("嘗試備用 QR Code 生成方案...");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(schoolUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const link = document.createElement("a");
    link.href = qrCode;
    link.download = `${schoolName}-客人登記.png`;
    link.click();
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>${schoolName} - 客人登記二維碼</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: white;
            }
            .print-container {
              text-align: center;
              padding: 40px;
            }
            h1 {
              font-size: 32px;
              margin-bottom: 10px;
              color: #1e3a8a;
            }
            .subtitle {
              font-size: 18px;
              color: #666;
              margin-bottom: 30px;
            }
            img {
              width: 300px;
              height: 300px;
              border: 3px solid #1e3a8a;
              padding: 20px;
              background: white;
            }
            .instruction {
              font-size: 14px;
              color: #666;
              margin-top: 30px;
              line-height: 1.8;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <h1>${schoolName}</h1>
            <div class="subtitle">客人登記二維碼</div>
            <img src="${qrCode}" alt="QR Code" />
            <div class="instruction">
              <p>用手機掃瞄此二維碼進行校服登記</p>
              <p>Scan this QR code to register for uniform</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{schoolName}</h1>
          <p style={styles.subtitle}>客人登記二維碼專頁</p>
        </div>
        <QrCode size={40} color="#1e3a8a" />
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* QR Code Display */}
        <div style={styles.qrSection}>
          <div style={styles.qrBox}>
            {qrCode ? (
              <img src={qrCode} alt="QR Code" style={styles.qrImage} />
            ) : (
              <div style={styles.qrLoading}>生成中...</div>
            )}
          </div>
          <p style={styles.qrDescription}>用手機掃瞄此二維碼進行客人登記</p>
        </div>

        {/* URL Display */}
        <div style={styles.urlSection}>
          <label style={styles.label}>登記連結</label>
          <div style={styles.urlBox}>
            <input
              type="text"
              value={schoolUrl}
              readOnly
              style={styles.urlInput}
            />
            <button
              onClick={handleCopyLink}
              style={{
                ...styles.button,
                ...(copied && styles.buttonActive),
              }}
              title="複製連結"
            >
              <Copy size={18} />
              {copied ? "已複製" : "複製"}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={styles.actionButtonsContainer}>
          <button
            onClick={handleDownloadQR}
            style={styles.actionButton}
            title="下載二維碼"
          >
            <Download size={20} />
            <span>下載二維碼</span>
          </button>
          <button
            onClick={handlePrint}
            style={styles.actionButton}
            title="打印二維碼"
          >
            <Printer size={20} />
            <span>打印二維碼</span>
          </button>
          <button
            onClick={() => {
              const text = `${schoolName} 校服登記：${schoolUrl}`;
              navigator.share({ title: "校服登記", text });
            }}
            style={styles.actionButton}
            title="分享"
          >
            <Share2 size={20} />
            <span>分享</span>
          </button>
        </div>

        {/* Instructions */}
        <div style={styles.instructionBox}>
          <h3 style={styles.instructionTitle}>使用說明</h3>
          <ol style={styles.instructionList}>
            <li>將此二維碼或登記連結分享給學生</li>
            <li>學生用手機掃瞄二維碼或點擊連結</li>
            <li>進入客人登記頁面，填寫個人資料</li>
            <li>成功登記後會獲得排隊號碼</li>
            <li>按照號碼順序到達店鋪進行度身選購</li>
          </ol>
        </div>

        {/* Stats */}
        <div style={styles.statsBox}>
          <div style={styles.statItem}>
            <div style={styles.statLabel}>學校</div>
            <div style={styles.statValue}>{schoolName}</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statLabel}>服務類型</div>
            <div style={styles.statValue}>客人登記</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statLabel}>創建時間</div>
            <div style={styles.statValue}>
              {new Date().toLocaleDateString("zh-HK")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: "20px",
    backgroundColor: "#f9fafb",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "40px",
    padding: "20px",
    backgroundColor: "#1e3a8a",
    color: "white",
    borderRadius: "8px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "bold",
    margin: "0 0 8px 0",
  },
  subtitle: {
    fontSize: "14px",
    opacity: 0.9,
    margin: 0,
  },
  mainContent: {
    maxWidth: "900px",
    margin: "0 auto",
  },
  qrSection: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "40px",
    marginBottom: "30px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    textAlign: "center",
  },
  qrBox: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: "8px",
    padding: "30px",
    marginBottom: "20px",
    minHeight: "350px",
  },
  qrImage: {
    maxWidth: "300px",
    maxHeight: "300px",
    borderRadius: "8px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  qrLoading: {
    fontSize: "18px",
    color: "#9ca3af",
  },
  qrDescription: {
    fontSize: "16px",
    color: "#666",
    margin: 0,
    fontWeight: "500",
  },
  urlSection: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "30px",
    marginBottom: "30px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "12px",
  },
  urlBox: {
    display: "flex",
    gap: "12px",
  },
  urlInput: {
    flex: 1,
    padding: "12px 16px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
    fontFamily: "monospace",
    backgroundColor: "#f9fafb",
  },
  button: {
    padding: "12px 24px",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "background-color 0.3s",
  },
  buttonActive: {
    backgroundColor: "#10b981",
  },
  actionButtonsContainer: {
    display: "flex",
    gap: "12px",
    marginBottom: "30px",
    flexWrap: "wrap",
  },
  actionButton: {
    flex: 1,
    minWidth: "150px",
    padding: "16px 24px",
    backgroundColor: "#1e3a8a",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "background-color 0.3s",
  },
  instructionBox: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "30px",
    marginBottom: "30px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  instructionTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#1e3a8a",
    marginTop: 0,
    marginBottom: "20px",
  },
  instructionList: {
    fontSize: "14px",
    color: "#666",
    lineHeight: "1.8",
    paddingLeft: "24px",
    margin: 0,
  },
  statsBox: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "20px",
  },
  statItem: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  statLabel: {
    fontSize: "12px",
    color: "#9ca3af",
    fontWeight: "600",
    marginBottom: "8px",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#1e3a8a",
  },
};

export default SchoolQRCodePage;
