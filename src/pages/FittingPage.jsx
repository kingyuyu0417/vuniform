import React, { useState } from "react";
import { pickupTickets, guestVisits } from "../services/customerFlowService";

const displayProductName = (name) => name
  .replace(/(?:【)?(?:男生|女生|男女生)(?:】)?\s*[-–—:：]?\s*/g, "")
  .replace(/\b(?:Boy|Girl)[`'']s\b\s*[-–—:：]?\s*/gi, "")
  .replace(/\s+/g, " ")
  .replace(/校\s+褸/g, "校褸")
  .trim();

const sampleProducts = [
  {
    id: "p1",
    name: "白色恤衫（短袖）",
    sizes: ["24", "26", "28", "30", "32", "34", "36", "38", "40"],
  },
  {
    id: "p2",
    name: "白色恤衫（長袖）",
    sizes: ["24", "26", "28", "30", "32", "34", "36", "38", "40"],
  },
  {
    id: "p3",
    name: "藏青色短褲",
    sizes: ["24", "26", "28", "30", "32", "34"],
  },
  {
    id: "p4",
    name: "校裙",
    sizes: ["XS", "S", "M", "L", "XL"],
  },
  {
    id: "p5",
    name: "PE運動套裝",
    sizes: ["XS", "S", "M", "L", "XL"],
  },
];

const emptyItem = {
  productId: "",
  size: "",
  quantity: 1,
};

export default function FittingPage({ guest, products = sampleProducts, schoolName = "", onGenerateTicket }) {
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [submitted, setSubmitted] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const visibleProducts = Array.isArray(products) ? products : sampleProducts;

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { ...emptyItem }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const validItems = items.filter((item) => item.productId && item.size && item.quantity > 0);
    if (validItems.length === 0) {
      setError("請至少選擇一件商品");
      return;
    }

    if (!guest || !guest.id) {
      setError("未選擇客人");
      return;
    }

    setIsLoading(true);
    try {
      const ticket = await pickupTickets.create({
        guestId: guest.id,
        guestName: guest.guestName || guest.guest_name || "未知客人",
        queueNo: guest.queueNo || guest.queue_no || "-",
        items: validItems.map((item) => {
          const product = products.find((p) => p.id === item.productId);
          return {
            productId: item.productId,
            productName: product?.name || "未知產品",
            size: item.size,
            quantity: item.quantity,
          };
        }),
        school: guest.school || "",
      });

      // 更新客人狀態為已選款
      await guestVisits.updateStatus(guest.id, "selected");

      setSubmitted(ticket);
      onGenerateTicket?.(ticket);
      setItems([{ ...emptyItem }]);
    } catch (err) {
      setError("生成取貨單失敗：" + (err.message || "未知錯誤"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ background: "#F7F7F5", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1F3A5F", marginBottom: 4 }}>度身 / 選購</div>
        <div style={{ fontSize: 13, color: "#66717D", marginBottom: 8 }}>
          客人：<strong>{guest?.guestName || "未選擇客人"}</strong> · {guest?.queueNo || "-"}
        </div>
        {schoolName && (
          <div style={{ fontSize: 12, color: "#3A5A8A", marginBottom: 16, fontWeight: 600 }}>
            現在顯示：{schoolName} 的款式及尺碼
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          {items.map((item, index) => {
            const selectedProduct = visibleProducts.find((p) => p.id === item.productId);
            return (
              <div key={index} style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>項目 {index + 1}</div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      style={{
                        background: "#FFE5E5",
                        color: "#C53030",
                        border: "none",
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      刪除
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  {/* 產品按鈕網格 */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#45515F", marginBottom: 8 }}>產品</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {visibleProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleItemChange(index, "productId", item.productId === p.id ? "" : p.id)}
                          style={{
                            padding: "12px 10px",
                            borderRadius: 10,
                            background: item.productId === p.id ? "#D97757" : "#fff",
                            color: item.productId === p.id ? "#fff" : "#222",
                            border: "1px solid " + (item.productId === p.id ? "#D97757" : "#ddd"),
                            fontSize: 14,
                            fontWeight: 500,
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          {displayProductName(p.name)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 尺碼按鈕網格 */}
                  {selectedProduct && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#45515F", marginBottom: 8 }}>尺碼</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {selectedProduct.sizes.map((size) => (
                          <button
                            key={size.size || size}
                            type="button"
                            onClick={() => handleItemChange(index, "size", item.size === (size.size || size) ? "" : (size.size || size))}
                            style={{
                              minWidth: 76,
                              padding: "10px 8px",
                              borderRadius: 10,
                              background: item.size === (size.size || size) ? "#1F3A5F" : "#fff",
                              color: item.size === (size.size || size) ? "#fff" : "#222",
                              border: "1px solid " + (item.size === (size.size || size) ? "#1F3A5F" : "#ddd"),
                              fontSize: 13,
                              fontWeight: 600,
                              textAlign: "center",
                              cursor: "pointer",
                            }}
                          >
                            {size.size || size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 數量輸入 */}
                  <div style={{ display: "grid", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#45515F" }}>數量</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #D5DDE5",
                        fontSize: 14,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddItem}
            style={{
              background: "#EEF1F5",
              color: "#1F3A5F",
              border: "1px dashed #9DB3C4",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + 新增項目
          </button>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              background: isLoading ? "#C0C8D0" : "#1F3A5F",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 15,
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "生成中…" : "生成取貨單"}
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
          <div style={{ fontSize: 15, fontWeight: 700, color: "#21693C", marginBottom: 8 }}>取貨單已生成</div>
          <div style={{ fontSize: 13, color: "#255F3D" }}>
            <div>單號：{submitted.id}</div>
            <div style={{ marginTop: 4 }}>共 {submitted.items.length} 件商品</div>
          </div>
        </div>
      )}
    </div>
  );
}
