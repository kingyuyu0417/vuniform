const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  try {
    console.log('🔍 檢查 Supabase app_storage 表的產品數據...\n');
    
    const { data, error } = await supabase
      .from('app_storage')
      .select('key, value')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      console.log('❌ app_storage 表為空');
      return;
    }
    
    console.log(`✅ 找到 ${data.length} 筆記錄:\n`);
    data.forEach(record => {
      console.log(`📌 Key: ${record.key}`);
      if (record.key === 'products') {
        const products = JSON.parse(record.value);
        console.log(`   數量: ${products.length} 件`);
        console.log(`   產品列表:`);
        products.slice(0, 5).forEach(p => {
          console.log(`     - ${p.name} (${p.school})`);
        });
        if (products.length > 5) {
          console.log(`     ... 還有 ${products.length - 5} 件`);
        }
      } else {
        const preview = record.value.substring(0, 100);
        console.log(`   內容: ${preview}...`);
      }
      console.log();
    });
    
  } catch (err) {
    console.error('❌ 錯誤:', err.message);
  }
})();