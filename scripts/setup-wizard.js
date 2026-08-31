#!/usr/bin/env node

/**
 * 🚀 校服銷售系統 - Supabase 完全設置向導
 * 自動化解決所有 Supabase 配置問題
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 讀取環境變量
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};

envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.trim();
  }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const PROJECT_ID = SUPABASE_URL.split('//')[1]?.split('.')[0];

// SQL 代碼
const GUEST_VISITS_SQL = `create table if not exists public.guest_visits (
  id text primary key,
  queue_no text not null unique,
  queueNo text,
  guest_name text,
  guestName text,
  class_name text,
  className text,
  height_cm text,
  heightCm text,
  weight_kg text,
  weightKg text,
  phone text,
  notes text default '',
  status text not null default 'waiting',
  school text,
  created_at timestamptz not null default now(),
  createdAt timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists guest_visits_queue_no_idx on public.guest_visits(queue_no);
create index if not exists guest_visits_status_idx on public.guest_visits(status);
create index if not exists guest_visits_school_idx on public.guest_visits(school);

alter table public.guest_visits enable row level security;

drop policy if exists "Allow guest visit access" on public.guest_visits;
create policy "Allow guest visit access"
on public.guest_visits
for all
to anon
using (true)
with check (true);`;

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkTables() {
  log('\n📊 檢查數據庫表狀態...\n', 'cyan');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const tables = ['guest_visits'];
  const results = {};

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error?.message.includes('Could not find')) {
        log(`   ❌ ${table}:`, 'red');
        results[table] = false;
      } else if (error) {
        log(`   ⚠️  ${table} (無法確定):`, 'yellow');
        results[table] = null;
      } else {
        log(`   ✅ ${table}:`, 'green');
        results[table] = true;
      }
    } catch (err) {
      log(`   ❌ ${table} (錯誤):`, 'red');
      results[table] = false;
    }
  }

  return results;
}

function generateInstructions() {
  return `
╔════════════════════════════════════════════════════════════════════╗
║        🚀 Supabase 配置 - 3 步快速設置                             ║
╚════════════════════════════════════════════════════════════════════╝

📍 目標: 創建 guest_visits 表

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 步驟 1️⃣ : 打開 Supabase SQL Editor

   🌐 直接打開此鏈接:
   ${colors.bright}https://app.supabase.com/project/${PROJECT_ID}/sql/new${colors.reset}

   或手動操作:
   1. 訪問 https://app.supabase.com
   2. 選擇項目: ${PROJECT_ID}
   3. 進入左側菜單 "SQL Editor"
   4. 點擊 "+ New Query"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 步驟 2️⃣ : 複製並粘貼 SQL 代碼

   ${colors.bright}--- 複製以下代碼 ---${colors.reset}

${GUEST_VISITS_SQL}

   ${colors.bright}--- 代碼結束 ---${colors.reset}

   操作:
   1. 全選上面的 SQL 代碼 (Ctrl+A)
   2. 複製 (Ctrl+C)
   3. 在 SQL Editor 中粘貼 (Ctrl+V)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 步驟 3️⃣ : 執行 SQL

   1. 點擊 ${colors.bright}RUN${colors.reset} 按鈕 (藍色)
   2. 等待完成 (應看到 "Success" 提示)
   3. 返回此終端

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 驗證

   執行完成後，運行驗證命令:
   ${colors.bright}npm run verify:supabase${colors.reset}

   或運行完整檢查:
   ${colors.bright}node scripts/setup-supabase.js${colors.reset}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❓ 遇到問題?

   Q1: 在哪裡找到 SQL Editor?
   A: 登入 https://app.supabase.com 後，左側菜單找 "SQL Editor"

   Q2: SQL 執行失敗怎麼辦?
   A: 檢查是否有 SQL 語法錯誤，或聯絡 Supabase 支持

   Q3: 執行後仍有 404 錯誤?
   A: 清除瀏覽器快取 (Ctrl+Shift+Delete) 後重新加載應用

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 提示:
   • 確保你已登入 Supabase 帳戶
   • SQL 代碼使用 "if not exists"，可安全重複執行
   • 完成後無需刷新頁面，直接進行下一步

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

async function main() {
  log('\n╔════════════════════════════════════════════════════════╗', 'bright');
  log('║   校服銷售系統 - Supabase 完全設置向導                  ║', 'bright');
  log('╚════════════════════════════════════════════════════════╝\n', 'bright');

  log('🔍 檢查當前狀態...\n', 'cyan');
  
  const results = await checkTables();
  const needsSetup = Object.values(results).some(v => v === false);

  if (!needsSetup) {
    const allComplete = Object.values(results).every(v => v === true);
    if (allComplete) {
      log('\n✅ 完美！所有表都已存在。', 'green');
      log('🎉 您的 Supabase 配置已完成。\n', 'green');
      return;
    }
  }

  // 生成並顯示說明
  const instructions = generateInstructions();
  console.log(instructions);

  // 保存 SQL 代碼到文件供參考
  const sqlFile = path.resolve(__dirname, '../supabase/guest-visits-only.sql');
  fs.writeFileSync(sqlFile, GUEST_VISITS_SQL);
  
  log(`\n💾 SQL 代碼已保存到: supabase/guest-visits-only.sql`, 'green');
  log(`   您可以直接在 Supabase SQL Editor 中打開此文件\n`, 'green');
}

main().catch(err => {
  log(`\n❌ 錯誤: ${err.message}\n`, 'red');
  process.exit(1);
});
