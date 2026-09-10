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
      <div style={{ marginBottom: 22, padding: "4px 2px" }}>
        <div style={{ color: "#1F3A5F", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>功能目錄</div>
        <div style={{ color: "#64748B", fontSize: 13, marginTop: 6 }}>選擇要進入的工作頁面</div>
      </div>
      <div className="directory-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        {items.map(({ id, label, description, icon: Icon, path }) => (
          <button
            key={id}
            className="pos-btn"
            onClick={() => onNavigate(id, path)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minHeight: 92,
              padding: "15px 16px",
              border: "1px solid #E2E8F0",
              borderRadius: 14,
              background: "linear-gradient(145deg, #fff 0%, #F8FAFD 100%)",
              color: "#1F3A5F",
              textAlign: "left",
              boxShadow: "0 3px 10px rgba(15, 23, 42, 0.06)",
              transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
            }}
          >
            <span style={{ display: "grid", placeItems: "center", width: 42, height: 42, flexShrink: 0, borderRadius: 12, background: "#EAF0F8" }}>
              <Icon size={20} />
            </span>
            <span>
              <span style={{ display: "block", fontSize: 15, fontWeight: 800 }}>{label}</span>
              <span style={{ display: "block", marginTop: 4, color: "#64748B", fontSize: 11 }}>{description}</span>
            </span>
          </button>
        ))}
      </div>
      <style>{`
        .directory-grid .pos-btn:hover {
          transform: translateY(-2px);
          border-color: #B8CBE1;
          box-shadow: 0 8px 18px rgba(31, 58, 95, 0.11);
        }
        @media (max-width: 520px) {
          .directory-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
        }
      `}</style>
    </section>
  );
}
