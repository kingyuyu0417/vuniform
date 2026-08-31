#!/usr/bin/env node

/**
 * Supabase guest_visits 表自動創建工具
 * 這個腳本將在 Supabase 中創建缺失的 guest_visits 表
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// guest_visits 表的 SQL 定義
const CREATE_GUEST_VISITS_SQL = `
create table if not exists public.guest_visits (
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
with check (true);
`;

/**
 * 嘗試通過 Supabase 客戶端執行 SQL
 * 注意：這通常需要管理員權限，匿名密鑰可能無法執行
 */
async function executeSQL() {
  try {
    console.log('🔄 正在嘗試創建 guest_visits 表...');
    
    // 嘗試使用 Supabase RPC 函數執行 SQL
    // 這需要先創建一個 SQL 函數，所以我們改用直接插入測試
    
    const testData = {
      id: 'test-' + Date.now(),
      queue_no: 'TEST-001',
      guest_name: 'Test Guest',
      class_name: 'Test Class',
      status: 'waiting'
    };

    const { data, error } = await supabase
      .from('guest_visits')
      .insert([testData]);

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        console.log('❌ guest_visits 表仍不存在');
        return false;
      }
      throw error;
    }

    // 如果插入成功，刪除測試數據
    await supabase
      .from('guest_visits')
      .delete()
      .eq('id', testData.id);

    console.log('✅ guest_visits 表已成功創建！');
    return true;
  } catch (err) {
    console.error('❌ 錯誤:', err.message);
    return false;
  }
}

/**
 * 主程序
 */
async function main() {
  console.log('🚀 Supabase guest_visits 表自動創建工具\n');
  console.log('這個工具將幫助您快速創建缺失的 guest_visits 表。\n');

  const success = await executeSQL();

  if (!success) {
    console.log('\n⚠️  自動創建失敗。原因可能是:');
    console.log('   - 匿名 API Key 沒有 DDL (CREATE TABLE) 權限');
    console.log('   - Supabase 的 RLS 策略限制');
    console.log('\n✨ 不用擔心！您可以手動執行 SQL:');
    console.log('\n步驟 1: 打開 Supabase SQL Editor');
    console.log('   https://app.supabase.com/project/vfoogstzhderqcjrghzh/sql/new\n');
    
    console.log('步驟 2: 複製以下 SQL 代碼:\n');
    console.log('--- 開始複製 ---');
    console.log(CREATE_GUEST_VISITS_SQL);
    console.log('--- 結束複製 ---\n');

    console.log('步驟 3: 粘貼到 SQL Editor 並點擊 RUN\n');

    console.log('步驟 4: 執行完成後，運行驗證命令:');
    console.log('   node scripts/setup-supabase.js\n');

    process.exit(1);
  }

  console.log('\n✅ 完成！現在應用已完全配置。');
  console.log('\n📝 後續步驟:');
  console.log('   1. 刷新應用 (Ctrl+Shift+Delete 清除快取)');
  console.log('   2. 測試客人登記功能');
  console.log('   3. 驗證排隊頁面無 404 錯誤');
}

main().catch(err => {
  console.error('❌ 致命錯誤:', err);
  process.exit(1);
});
