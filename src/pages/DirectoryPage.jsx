import React from "react";
import { ClipboardList, Search, Settings, ShoppingCart, Users } from "lucide-react";

const DIRECTORY_ITEMS = [
  { id: "sale", label: "銷售", description: "建立銷售單及收款", icon: ShoppingCart, path: "/sale" },
  { id: "guest", label: "客人登記", description: "登記客人及派發籌號", icon: Users, path: "/checkin" },
  { id: "queue", label: "排隊", description: "管理度身及取貨叫號", icon: ClipboardList, path: "/queue" },
  { id: "track", label: "查單", description: "搜尋及更新訂單", icon: Search, path: "/track" },
  { id: "fitting", label: "度身", description: "處理客人度身流程", icon: Users, path: "/fitting" },
  { id: "pickup", label: "取貨", description: "管理執貨及取貨", icon: ClipboardList, path: "/pickup" },
  { id: "cashier", label: "收銀", description: "核對訂單及完成付款", icon: ShoppingCart, path: "/cashier" },
  { id: "products", label: "商品", description: "管理款式、尺碼及價格", icon: Settings, path: "/products" },
  { id: "records", label: "記錄", description: "查看銷售及收據記錄", icon: ClipboardList, path: "/records" },
  { id: "staff", label: "員工", description: "管理員工帳戶及權限", icon: Users, path: "/staff" },
];

export default function DirectoryPage({ availableIds = [], onNavigate }) {
  const items = DIRECTORY_ITEMS.filter((item) => availableIds.includes(item.id));

  return (
    <section style={{ padding: "4px 0 16px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ color: "#1F3A5F", fontSize: 24, fontWeight: 800 }}>功能目錄</div>
        <div style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>選擇要進入的工作頁面</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        {items.map(({ id, label, description, icon: Icon, path }) => (
          <button
            key={id}
            className="pos-btn"
            onClick={() => onNavigate(id, path)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minHeight: 88,
              padding: 14,
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              background: "#fff",
              color: "#1F3A5F",
              textAlign: "left",
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
            }}
          >
            <span style={{ display: "grid", placeItems: "center", width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: "#EAF0F8" }}>
              <Icon size={20} />
            </span>
            <span>
              <span style={{ display: "block", fontSize: 15, fontWeight: 800 }}>{label}</span>
              <span style={{ display: "block", marginTop: 4, color: "#64748B", fontSize: 11 }}>{description}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
