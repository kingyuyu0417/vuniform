#!/usr/bin/env node

/**
 * Supabase 自動化設置腳本
 * 用途：自動檢查和創建必要的 Supabase 表
 * 使用方式：node scripts/setup-supabase.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 讀取 .env.local
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

console.log('🚀 開始 Supabase 自動化設置...\n');
console.log('📋 配置信息:');
console.log(`   URL: ${SUPABASE_URL}`);
console.log(`   API Key: ${SUPABASE_ANON_KEY?.substring(0, 20)}...`);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ 錯誤：未找到 Supabase 配置');
  console.error('請確保 .env.local 文件中包含 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// 初始化 Supabase 客戶端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 檢查表是否存在
 */
async function checkTable(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      return false; // 表不存在
    }
    
    if (error) {
      console.warn(`⚠️  檢查 ${tableName} 時出現其他錯誤: ${error.message}`);
      return null; // 不確定
    }
    
    return true; // 表存在
  } catch (err) {
    console.warn(`⚠️  異常: ${err.message}`);
    return null;
  }
}

/**
 * 檢查所有必要的表
 */
async function checkAllTables() {
  const tables = [
    'app_storage',
    'guest_visits',
    'pickup_tickets',
    'pickup_ticket_items',
    'orders',
    'order_items'
  ];

  console.log('\n📊 檢查數據庫表...');
  
  const results = {};
  for (const table of tables) {
    process.stdout.write(`   檢查 ${table}... `);
    const exists = await checkTable(table);
    
    if (exists === true) {
      console.log('✅ 存在');
      results[table] = 'exists';
    } else if (exists === false) {
      console.log('❌ 不存在');
      results[table] = 'missing';
    } else {
      console.log('⚠️  不確定');
      results[table] = 'unknown';
    }
  }

  return results;
}

/**
 * 生成 Supabase Web 登入 URL
 */
function generateSupabaseSetupUrl() {
  const projectId = SUPABASE_URL.split('//')[1]?.split('.')[0];
  return `https://app.supabase.com/project/${projectId}/sql/new`;
}

/**
 * 讀取 schema.sql 文件
 */
function readSchemaSQL() {
  const schemaPath = path.resolve(__dirname, '../supabase/schema.sql');
  return fs.readFileSync(schemaPath, 'utf-8');
}

/**
 * 主程序
 */
async function main() {
  const results = await checkAllTables();
  
  const missing = Object.entries(results)
    .filter(([_, status]) => status === 'missing')
    .map(([table, _]) => table);

  const unknown = Object.entries(results)
    .filter(([_, status]) => status === 'unknown')
    .map(([table, _]) => table);

  if (missing.length === 0 && unknown.length === 0) {
    console.log('\n✅ 所有表都已存在！設置完成。');
    console.log('\n🎉 Supabase 已正確配置。您現在可以開始使用應用。');
    return;
  }

  console.log('\n⚠️  發現問題:');
  if (missing.length > 0) {
    console.log(`   缺失的表: ${missing.join(', ')}`);
  }
  if (unknown.length > 0) {
    console.log(`   無法確定: ${unknown.join(', ')}`);
  }

  console.log('\n🔧 解決方案:');
  console.log('\n方案 1: 自動在線設置 (推薦)');
  console.log(`1. 打開: ${generateSupabaseSetupUrl()}`);
  console.log('2. 複製下方的 SQL 代碼');
  console.log('3. 粘貼到 SQL Editor');
  console.log('4. 點擊 RUN 執行\n');

  console.log('方案 2: 本地手動執行');
  console.log('1. 確保安裝了 Supabase CLI: npm install -g supabase');
  console.log('2. 執行: supabase db push');
  console.log('3. 按照提示登入 Supabase\n');

  console.log('方案 3: 複製 SQL 代碼\n');
  
  const schema = readSchemaSQL();
  console.log('--- 開始複製以下 SQL 代碼 ---\n');
  console.log(schema);
  console.log('\n--- 結束複製 ---\n');

  console.log('💡 提示:');
  console.log('- 複製上面的 SQL 代碼');
  console.log('- 在 Supabase SQL Editor 中創建新查詢');
  console.log('- 粘貼代碼並執行');
  console.log('- 執行後重新運行此腳本進行驗證\n');

  console.log(`📝 詳細信息:`);
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  console.log(`   Web 設置: ${generateSupabaseSetupUrl()}\n`);
}

// 運行主程序
main().catch(err => {
  console.error('❌ 錯誤:', err.message);
  process.exit(1);
});
