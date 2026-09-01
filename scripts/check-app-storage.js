#!/usr/bin/env node

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

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  try {
    console.log('🔍 檢查 Supabase app_storage 表的產品數據...\n');
    
    const { data, error } = await supabase
      .from('app_storage')
      .select('key, value')
      .order('key', { ascending: true });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      console.log('❌ app_storage 表為空');
      return;
    }
    
    console.log(`✅ 找到 ${data.length} 筆記錄:\n`);
    data.forEach(record => {
      console.log(`📌 Key: "${record.key}"`);
      
      if (record.key === 'products') {
        try {
          const products = JSON.parse(record.value);
          console.log(`   ✅ 數量: ${products.length} 件`);
          console.log(`   產品列表:`);
          products.slice(0, 10).forEach(p => {
            console.log(`     - ${p.name} (${p.school || '未指定學校'})`);
          });
          if (products.length > 10) {
            console.log(`     ... 還有 ${products.length - 10} 件`);
          }
        } catch (e) {
          console.log(`   ❌ 解析失敗: ${e.message}`);
        }
      } else {
        const preview = record.value.substring(0, 80);
        console.log(`   內容預覽: ${preview}${record.value.length > 80 ? '...' : ''}`);
      }
      console.log();
    });
    
  } catch (err) {
    console.error('❌ 錯誤:', err.message);
  }
})();