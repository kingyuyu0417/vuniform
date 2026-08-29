# 校服銷售系統

## 唯一使用版本

日後只使用 `uniform-pos-app-CURRENT`。`uniform-pos-app-ARCHIVE` 及 `uniform-pos-app-舊版本` 只作舊版本備份，不要啟動。正式上載後，所有電腦只使用同一個公開網址；所有資料會經同一個 Supabase 資料庫同步。

## 啟動步驟

1. 安裝 Node.js LTS
2. 在此資料夾執行：
   ```bash
   npm install
   npm run dev
   ```
3. 只在本機測試時打開顯示的網址，例如：
   ```text
   http://localhost:5173
   ```

本機 `localhost` 只適合在這部電腦測試。客人掃描收據 QR Code 時，請在 `.env.local` 設定客人可以連線的公開網址：

```text
VITE_PUBLIC_APP_URL=https://你的公開網站網址
```

設定後要重新啟動 Vite 及重新部署，QR Code 才會連到客人可以開啟的電子收據頁。

## Supabase 設定

1. 複製 `.env.example` 為 `.env.local`。
2. 在 Supabase Project Settings → API 複製 Project URL 和 Publishable key。
3. 填入 `.env.local` 的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。

CSV 商品資料欄位為「學校、款式名稱、碼數、長度、價錢」。一般上衣可留空「長度」；西褲／裙可填腰圍及長度，例如碼數 `30`、長度 `29`，兩個組合可設定不同價錢。
4. 在 Supabase SQL Editor 執行 `supabase/schema.sql`。

安全升級用的 `supabase/secure-migration.sql` 會建立 Auth 員工資料、商品、訂單及訂單項目表。前端完成 Auth 版本後才執行這份 migration；執行前請先備份 `app_storage`。

Auth 登入開關是 `VITE_USE_SUPABASE_AUTH`。只有在 Supabase 已建立 `staff_profiles` 員工角色，而且前端交易已切換到新資料表後，才將它改成 `true`；目前保留 `false` 以維持 PIN 測試模式。

安全切換步驟：

1. 在 Supabase SQL Editor 執行 `supabase/secure-migration.sql`。
2. 在 Authentication → Users 建立員工帳戶。
3. 將 User ID 加入 `staff_profiles`，並設定 `admin`、`manager` 或 `staff` 角色。
4. 確認新帳戶可以登入後，在 `.env.local` 加入 `VITE_USE_SUPABASE_AUTH=true`。
5. 重啟 Vite 並測試登入、查看紀錄及完成交易。

在 Supabase Authentication → URL Configuration，將本機測試網址加入 Redirect URLs，例如 `http://localhost:5173/**`；公開部署後則加入公開網址。員工按邀請連結後會在 App 內設定密碼。

Auth 模式的銷售交易會用 `create_order_with_items` 一次寫入 `orders` 和 `order_items`。商品資料會由管理員首次登入時自動遷移到 `products`。

收據編號由 Supabase 每日流水號自動產生，格式為 `VU-YYYYMMDD-0001`。啟用新編號前，請先在 Supabase 執行最新的 `supabase/secure-migration.sql`，它會建立每日流水號及更新交易 RPC。

## Auth 員工管理功能

員工管理功能使用 Supabase Edge Function，service key 只放在 Supabase server-side secrets，不可放入 `.env.local`：

```bash
supabase functions deploy manage-staff
```

部署後，管理員登入 POS 的「員工」分頁即可邀請員工、修改角色及停用帳戶。Supabase CLI 需要先登入並連接到正確 Project。

如果 Supabase 顯示 email rate limit exceeded，可在 POS 輸入員工資料及最少 8 個字元的臨時密碼，按「直接建立帳戶（免電郵）」；之後用安全方式將臨時密碼交給員工，員工登入後應立即更改密碼。

舊 `app_storage` 仍保留作為資料備份；完成學校分類資料遷移及測試後，才可移除其匿名政策。

Project URL 必須是 `https://你的-project-ref.supabase.co`，不要加 `/rest/v1`。

## 公開部署

先執行：

```bash
npm run build
```

將 `dist` 資料夾部署到 Netlify Drop，或連接 GitHub 後部署到 Vercel。部署平台需要設定同一組 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 環境變數。

要自動更新，先將專案推送到 GitHub，再在 Netlify 選 **Add new project → Import from Git**，選取 repository。`netlify.toml` 已固定 `npm run build` 和 `dist` 設定；之後每次 `git push` 都會自動部署。

目前 schema 的匿名政策只適合測試。正式公開前，必須改用 Supabase Auth 和更嚴格的 Row Level Security，避免任何人讀寫全部 POS 資料。

## 預設登入 PIN

- 管理員：0000
- 店長：1111
- 店員A：2222
- 店員B：3333

## 功能

- 銷售 POS
- 商品管理
- CSV 匯入匯出
- 當日記錄
- 員工帳號管理
- 收據 QR Code
