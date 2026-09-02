import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import qrcodeGenerator from "qrcode-generator";
import { Copy, QrCode } from "lucide-react";
import { queueOrderService } from "../services/queueOrderService";

const DESIGNATED_SCHOOL = "香港中國婦女會馮堯敬紀念中學";
const SCHOOL_LEVELS = ["幼稚園", "小學", "中學", "其他"];

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

const metaOf = (schoolMeta, name) => {
  const base = { level: "其他", region: "其他" };
  if (!name) return base;
  return { ...base, ...(schoolMeta?.[name] || {}) };
};

const normalizeSchoolLevel = (schoolName, schoolMeta = {}) => {
  const meta = metaOf(schoolMeta, schoolName);
  const explicitLevel = String(meta.level || "").trim();
  if (["幼稚園", "小學", "中學", "其他"].includes(explicitLevel)) return explicitLevel;

  const category = String(meta.category || "").trim();
  const name = String(schoolName || "").trim();
  if (/中學/.test(category) || /中學/.test(name)) return "中學";
  if (/小學/.test(category) || /小學/.test(name)) return "小學";
  if (/幼稚園/.test(category) || /幼稚園/.test(name)) return "幼稚園";

  return "其他";
};

export default function CustomerCheckinPage({ onSubmit, school = "", schools = [], schoolMeta = {} }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrCode, setQrCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState(school || "");

  const schoolOptions = useMemo(
    () => [...new Set((schools || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant")),
    [schools]
  );

  useEffect(() => {
    if (school && school !== selectedSchoolId) {
      setSelectedSchoolId(school);
    }
  }, [school, selectedSchoolId]);

  const levelOptions = SCHOOL_LEVELS.map((level) => ({
    level,
    count: schoolOptions.filter((schoolName) => {
      const schoolLevel = normalizeSchoolLevel(schoolName, schoolMeta);
      return level === "其他" ? schoolLevel === "其他" : schoolLevel === level;
    }).length,
  }));

  const levelFilteredSchools = selectedLevel
    ? schoolOptions.filter((schoolName) => {
        const schoolLevel = normalizeSchoolLevel(schoolName, schoolMeta);
        return selectedLevel === "其他" ? schoolLevel === "其他" : schoolLevel === selectedLevel;
      })
    : schoolOptions;

  const regionOptions = [...new Set(levelFilteredSchools.map((schoolName) => metaOf(schoolMeta, schoolName).region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));

  const regionFilteredSchools = selectedRegion
    ? levelFilteredSchools.filter((schoolName) => (metaOf(schoolMeta, schoolName).region || "其他") === selectedRegion)
    : levelFilteredSchools;

  const effectiveSchool = selectedSchoolId || school || "";

  const handleLevelSelect = (level) => {
    setSelectedLevel(level);
    setSelectedRegion(null);
    setSelectedSchoolId("");
  };

  const handleRegionSelect = (region) => {
    setSelectedRegion(region);
    setSelectedSchoolId("");
  };

  const handleSchoolPick = (schoolName) => {
    const nextSchool = schoolName || DESIGNATED_SCHOOL;
    setSelectedSchoolId(nextSchool);
    setSelectedRegion(null);
    setSelectedLevel(null);
    navigate(`/checkin?school_id=${encodeURIComponent(nextSchool)}`, { replace: true });
  };

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
      const schoolId = effectiveSchool || DESIGNATED_SCHOOL;
      if (!schoolId || schoolId === DESIGNATED_SCHOOL && !effectiveSchool && !school) {
        setError("請先選擇學校");
        return;
      }
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

      const statusUrl = `${window.location.origin}/queue-status?id=${encodeURIComponent(record.queueNo)}&school_id=${encodeURIComponent(schoolId)}`;
      record.recordUrl = statusUrl;
      generateQRCode(statusUrl);

      setSubmitted(record);
      onSubmit?.(record);
      setForm(emptyForm);
      // 登記成功後必須留在排隊頁，避免自動進入度身流程
      navigate("/queue", { replace: true });
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
      {!effectiveSchool ? (
        <div style={{ background: "#fff", border: "1px solid #D5DDE5", borderRadius: 14, padding: 22 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#1F3A5F" }}>登記學校</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#66717D" }}>請按步驟選擇學校，再進行客人登記</div>

          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8, fontWeight: 700 }}>第一步：選擇學校類別</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {levelOptions.map(({ level, count }) => (
                  <button
                    key={level}
                    type="button"
                    className="pos-btn"
                    onClick={() => handleLevelSelect(level)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 10,
                      background: selectedLevel === level ? "#1F3A5F" : "#F3F6FA",
                      color: selectedLevel === level ? "#fff" : "#1F3A5F",
                      border: "1px solid " + (selectedLevel === level ? "#1F3A5F" : "#D5DDE5"),
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {level} ({count})
                  </button>
                ))}
              </div>
            </div>

            {selectedLevel && (
              <div>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8, fontWeight: 700 }}>第二步：選擇地區</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {regionOptions.length > 0 ? (
                    regionOptions.map((region) => (
                      <button
                        key={region}
                        type="button"
                        className="pos-btn"
                        onClick={() => handleRegionSelect(region)}
                        style={{
                          padding: "9px 12px",
                          borderRadius: 10,
                          background: selectedRegion === region ? "#D97757" : "#F3F6FA",
                          color: selectedRegion === region ? "#fff" : "#1F3A5F",
                          border: "1px solid " + (selectedRegion === region ? "#D97757" : "#D5DDE5"),
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {region}
                      </button>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: "#66717D" }}>此類別暫無地區資料</div>
                  )}
                </div>
              </div>
            )}

            {selectedRegion && (
              <div>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8, fontWeight: 700 }}>第三步：選擇學校</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
                  {regionFilteredSchools.length > 0 ? (
                    regionFilteredSchools.map((schoolName) => (
                      <button
                        key={schoolName}
                        type="button"
                        className="pos-btn"
                        onClick={() => handleSchoolPick(schoolName)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: selectedSchoolId === schoolName ? "#EAF4FF" : "#fff",
                          border: "1px solid " + (selectedSchoolId === schoolName ? "#9BC3EC" : "#D5DDE5"),
                          color: "#1F3A5F",
                          fontSize: 14,
                          fontWeight: selectedSchoolId === schoolName ? 700 : 500,
                        }}
                      >
                        {schoolName}
                      </button>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: "#66717D" }}>此區域暫無學校資料</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: "#F7F7F5", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1F3A5F", marginBottom: 12 }}>客人登記</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#52627A", marginBottom: 14 }}>
            {effectiveSchool}
          </div>
          <button
            type="button"
            className="pos-btn"
            onClick={() => {
              setSelectedLevel(null);
              setSelectedRegion(null);
              setSelectedSchoolId("");
              navigate("/checkin", { replace: true });
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "#EEF2F7",
              color: "#1F3A5F",
              border: "1px solid #D5DDE5",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            更改學校
          </button>
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
      )}

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

