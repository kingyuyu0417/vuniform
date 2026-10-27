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

商品新增表單使用季節、分類及款式欄位前，請先在 Supabase SQL Editor 執行 `supabase/product-classification-migration.sql`，為現有商品表加入相容的新欄位。

Auth 登入開關是 `VITE_USE_SUPABASE_AUTH`。只有在 Supabase 已建立 `staff_profiles` 員工角色，而且前端交易已切換到新資料表後，才將它改成 `true`；目前保留 `false` 以維持 PIN 測試模式。

安全切換步驟：

1. 在 Supabase SQL Editor 執行 `supabase/secure-migration.sql`。
2. 在 Authentication → Users 建立員工帳戶。
3. 將 User ID 加入 `staff_profiles`，並設定 `admin`、`manager`、`sales` 或 `staff` 角色。
4. 確認新帳戶可以登入後，在 `.env.local` 加入 `VITE_USE_SUPABASE_AUTH=true`。
5. 重啟 Vite 並測試登入、查看紀錄及完成交易。

在 Supabase Authentication → URL Configuration，將本機測試網址加入 Redirect URLs，例如 `http://localhost:5173/**`；公開部署後則加入公開網址。員工按邀請連結後會在 App 內設定密碼。

Auth 模式的銷售交易會用 `create_order_idempotently` 一次寫入 `orders` 和 `order_items`。商品資料會由管理員首次登入時自動遷移到 `products`。

更新客人登記及排隊查詢前，先在 Supabase SQL Editor 執行 `supabase/fix-customer-queue-identity.sql`，再部署前端。此 SQL 以資料庫鎖原子配置每日籌號，並新增按唯一訂單 ID 查詢狀態的安全 RPC；若跳過 SQL，客人登記會明確提示資料庫尚未更新，不會退回可能產生重複籌號的直接寫入方式。

收據編號由 Supabase 每日流水號自動產生，格式為 `VU-YYYYMMDD-0001`。啟用新版結帳及退貨數量防護前，先執行 `supabase/secure-migration.sql`，再執行 `supabase/idempotent-sales-checkout.sql`。此 migration 同時記錄退貨所屬原單商品、退換原因及付款／退款渠道，並在資料庫阻止超退、缺少原因或無效支付方式的退換；舊版無法追蹤退貨商品的換貨記錄會先被視為未核實，需管理員檢查。新版 App 只會呼叫具冪等保護的 RPC；若 migration 尚未執行，結帳會保留購物車並提示管理員，不會退回非原子寫入方式。

`supabase/idempotent-sales-checkout.sql` 亦會建立商品及訂單項目的英文收據名稱欄位。若結帳顯示 `42703: column order_items.receipt_name_en does not exist`，請在 Supabase SQL Editor 重新執行這份 SQL，再於原銷售分頁保持原商品及金額重試；同一交易識別碼會用來完成已建立但尚未確認的收據。

若結帳顯示 `42702: column reference "original_qty" is ambiguous`，請管理員在 Supabase SQL Editor 執行更新後的 `supabase/idempotent-sales-checkout.sql`，以更新結帳 RPC 的欄位引用。執行完成後重新載入銷售頁，保留原購物車及金額重試；不要另開新單或更改商品，系統會沿用同一交易識別碼。

銷售記錄作廢只供管理員操作，需重新輸入管理員密碼並填寫原因。作廢會保留原單及稽核記錄，但不計入收入、件數或客人統計。啟用前須在 Supabase SQL Editor 執行 `supabase/void-sales-order.sql`；資料庫 RPC 亦會驗證管理員角色及最近 5 分鐘內的重新登入憑證。

銷售結帳可記錄現金、信用卡或轉帳；退換退款可獨立記錄退款渠道。銷售記錄頁的每日收市對數會分渠道列出實收及退款，並分開顯示銷售、退回貨品參考額、換貨淨差額及淨收入。相同收銀員兩分鐘內開出完全相同商品、數量及金額時，系統只會顯示非阻擋式警示，店員確認後仍可完成真實交易。

未完成的銷售會按收銀員及瀏覽器分頁自動保存在本機，重新整理同一分頁後可還原購物車、整單替換、換貨及付款輸入。草稿最長保存 24 小時，不會同步到其他裝置；埋單成功或清空購物車後會刪除。

電子收據的「View in English」會在新分頁以 Google Translate 翻譯整張收據；翻譯時收據頁面內容（包括客人姓氏、電話末四位、單號、商品及金額）會交給 Google，原收據頁保持開啟。

每個尺碼可在商品管理輸入「兩件優惠總價」。結帳時，同款、同單價及同優惠總價的尺碼可混搭；每兩件套用一次優惠，奇數剩餘件按原價計算。退回優惠商品時會按原單及先前退貨重新計算退款。正式啟用前，請在 Supabase SQL Editor 先執行更新後的 `supabase/idempotent-sales-checkout.sql`，再執行 `supabase/replace-sales-order.sql`，然後部署前端；若缺少資料庫欄位，系統會阻止優惠結帳。部署後仍須在商品管理為適用商品尺碼設定優惠價，系統不會自行修改現有商品價格。

若整單替換結帳顯示 `P0001: Replacement must stay in the original branch`，請管理員在 Supabase SQL Editor 重新執行 `supabase/replace-sales-order.sql`，更新替換 RPC。RPC 會先確認職員仍有權限處理原單分店，再以資料庫原單的分店欄位建立替換單；完成後重新載入銷售頁，保留原購物車及金額重試，不要另開新單。

## Auth 員工管理功能

員工管理功能使用 Supabase Edge Function，service key 只放在 Supabase server-side secrets，不可放入 `.env.local`：

```bash
supabase functions deploy manage-staff
```

部署後，管理員登入 POS 的「員工」分頁即可邀請員工、修改角色及停用帳戶。Supabase CLI 需要先登入並連接到正確 Project。

如果 Supabase 顯示 email rate limit exceeded，可在 POS 輸入員工資料及最少 8 個字元的臨時密碼，按「直接建立帳戶（免電郵）」；之後用安全方式將臨時密碼交給員工，員工登入後應立即更改密碼。

## 分店權限隔離

如需讓店長／店員只查看所屬分店，先在 Supabase SQL Editor 執行 `supabase/branch-isolation-migration.sql`。此 migration 會建立分店、員工分店欄位、學校分店對應及分店 RLS；現有 `school-meta` 內有 `outletName` 的學校會自動分配，其他學校需由管理員在 `school_branches` 補上對應。

執行 migration 後，再部署：

```bash
npx supabase@latest functions deploy manage-staff --project-ref vfoogstzhderqcjrghzh
```

舊 `app_storage` 仍保留作為資料備份；完成學校分類資料遷移及測試後，才可移除其匿名政策。

Project URL 必須是 `https://你的-project-ref.supabase.co`，不要加 `/rest/v1`。

## 公開部署

先執行：

```bash
npm run build
```

本專案只使用 Cloudflare Pages 部署。連接 GitHub repository 後，設定：

- Build command：`npm run build`
- Build output directory：`dist`
- Node.js version：`20`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_USE_SUPABASE_AUTH`
- `VITE_PUBLIC_APP_URL`

Cloudflare Pages 會在每次 `git push` 後自動部署。專案的 Cloudflare Pages 設定保存在 `wrangler.toml`；請不要再使用 Netlify 或 Vercel 設定。Vite 正式建置會優先使用 Cloudflare 建置環境變數，若 Pages 未把 Wrangler 變數注入建置環境，則讀取 `wrangler.toml` 的 production vars 作公開 Supabase 設定。

請透過 GitHub 推送部署，不要直接上傳本機 `dist`。正式建置會檢查 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`；若缺少或仍是佔位值，建置會失敗，避免發布後登入頁才顯示「Supabase 未設定」。本機手動建置時也須先設定這兩個環境變數。

部署商品英文收據名稱功能前，請先在 Supabase SQL Editor 執行 [product-receipt-name-en.sql](./supabase/product-receipt-name-en.sql)，再執行更新後的 [idempotent-sales-checkout.sql](./supabase/idempotent-sales-checkout.sql) 以更新交易 RPC，最後才部署前端。這會為商品及銷售項目新增英文收據名稱欄位，舊資料預設為空白。

數量優惠功能亦須先執行更新後的 [idempotent-sales-checkout.sql](./supabase/idempotent-sales-checkout.sql) 及 [replace-sales-order.sql](./supabase/replace-sales-order.sql)，再部署前端；其後在商品管理逐尺碼設定兩件優惠總價。

如要啟用銷售單據即時同步，部署前請先在 Supabase SQL Editor 執行 [sales-orders-realtime.sql](./supabase/sales-orders-realtime.sql)。此 SQL 只將 `public.orders` 加入 Realtime publication，資料仍按現有 RLS 權限傳送。

如要加快紀錄頁按日期搜尋，請在 Supabase SQL Editor 執行 [sales-record-date-indexes.sql](./supabase/sales-record-date-indexes.sql)，再部署前端；紀錄頁會按已選日期範圍查詢單據，不再等候全量單據及明細載入後才顯示。

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

### 即時取貨叫號畫面

職員從指定學校的 `/queue?school_id=學校名稱` 開啟「客人叫號畫面」，再於客人裝置開啟連結。職員每次手動叫號時，籌號及播報語言會即時同步到客人畫面；客人畫面會顯示籌號，並嘗試播放提示音及以相同語言播報。瀏覽器可能阻擋未經使用者操作的有聲播放；如被阻擋，客人頁會顯示「按此播放最新叫號」按鈕。受管理的 Chrome 裝置可由管理員透過 AutoplayAllowed 或 AutoplayAllowlist 政策允許指定站點自動播放。

客人畫面只經 Supabase Realtime 收取籌號和語言，不讀取客人個人資料。叫號頁會在該分頁開啟期間保留最新籌號供新連線畫面顯示；關閉或重新載入職員叫號頁後不會保存舊籌號，需待下一次叫號更新。
