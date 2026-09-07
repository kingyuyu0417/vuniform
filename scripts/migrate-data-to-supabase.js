#!/usr/bin/env node

/**
 * 数据迁移脚本：从 localStorage 到 Supabase
 * 用于升级到 Auth 系统时使用
 * 
 * 使用方法:
 * node scripts/migrate-data-to-supabase.js
 */

const fs = require('fs');
const path = require('path');

const LOG_PREFIX = '📦 [迁移]';

class DataMigrationRunner {
  constructor() {
    this.results = {
      totalRecords: 0,
      migratedRecords: 0,
      errors: [],
      startTime: new Date(),
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('zh-HK');
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async validateEnvironment() {
    this.log('验证环境配置...');

    const requiredEnvVars = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
    ];

    const missing = requiredEnvVars.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      this.log(`缺少环境变量: ${missing.join(', ')}`, 'error');
      throw new Error('环境配置不完整');
    }

    this.log('环境验证通过', 'success');
  }

  async createBackup(data, backupName = 'data-backup') {
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `${backupName}-${timestamp}.json`);

    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
    this.log(`备份已创建: ${backupFile}`, 'success');

    return backupFile;
  }

  async migrateProducts(supabase, products) {
    this.log(`开始迁移 ${products.length} 个商品...`);

    const batch = [];
    for (const product of products) {
      const record = {
        id: product.id || `prod-${Date.now()}-${Math.random()}`,
        school: product.school || '未分类',
        name: product.name,
        sizes: JSON.stringify(product.sizes || []),
        created_at: new Date().toISOString(),
      };
      batch.push(record);

      // 每 100 条记录批量插入一次
      if (batch.length >= 100) {
        const { error } = await supabase.from('products').insert(batch);
        if (error) {
          this.log(`商品迁移失败: ${error.message}`, 'error');
          this.results.errors.push({ table: 'products', error });
        } else {
          this.results.migratedRecords += batch.length;
          this.log(`已迁移 ${batch.length} 条商品记录`, 'success');
        }
        batch.length = 0;
      }
    }

    // 处理剩余记录
    if (batch.length > 0) {
      const { error } = await supabase.from('products').insert(batch);
      if (error) {
        this.log(`商品迁移失败: ${error.message}`, 'error');
        this.results.errors.push({ table: 'products', error });
      } else {
        this.results.migratedRecords += batch.length;
        this.log(`已迁移 ${batch.length} 条商品记录`, 'success');
      }
    }
  }

  async migrateOrders(supabase, orders) {
    this.log(`开始迁移 ${orders.length} 个订单...`);

    for (const order of orders) {
      const orderRecord = {
        id: order.id || `ord-${Date.now()}`,
        school: order.school,
        total: order.total || 0,
        item_count: order.itemCount || (order.items?.length || 0),
        customer_surname: order.customerSurname || null,
        customer_phone_last4: order.customerPhoneLast4 || null,
        created_at: order.createdAt || new Date().toISOString(),
      };

      const { error: orderError } = await supabase.from('orders').insert(orderRecord);

      if (orderError) {
        this.log(`订单 ${order.id} 迁移失败: ${orderError.message}`, 'error');
        this.results.errors.push({ table: 'orders', orderId: order.id, error: orderError });
        continue;
      }

      // 迁移订单项
      if (order.items && Array.isArray(order.items)) {
        const items = order.items.map((item) => ({
          order_id: orderRecord.id,
          product_id: item.productId || item.id,
          product_name: item.name,
          size: item.size,
          quantity: item.quantity || 1,
          unit_price: item.price || 0,
          subtotal: (item.price || 0) * (item.quantity || 1),
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(items);

        if (itemsError) {
          this.log(`订单项迁移失败: ${itemsError.message}`, 'error');
          this.results.errors.push({ table: 'order_items', orderId: order.id, error: itemsError });
        }
      }

      this.results.migratedRecords++;
    }

    this.log(`已迁移 ${this.results.migratedRecords} 个订单`, 'success');
  }

  async migrateStaff(supabase, accounts) {
    this.log(`开始迁移 ${accounts.length} 个员工账户...`);

    for (const account of accounts) {
      // 注意：这里只迁移账户信息，不包括密码
      // 实际密码应通过 Supabase Auth UI 单独创建
      const staffRecord = {
        display_name: account.name || 'Unknown',
        email: account.email || `${account.id}@uniform-pos.local`,
        role: account.role || 'staff',
        status: 'active',
      };

      this.log(`账户 ${account.id} 已标记为待迁移 (手动创建 Auth 用户后导入)`, 'warn');
    }

    this.log('员工账户请在 Supabase UI 中手动创建，然后运行本迁移脚本的员工导入部分', 'warn');
  }

  async generateMigrationReport() {
    const duration = new Date() - this.results.startTime;
    const report = {
      ...this.results,
      duration,
      durationSeconds: Math.round(duration / 1000),
      successRate: this.results.totalRecords > 0
        ? Math.round((this.results.migratedRecords / this.results.totalRecords) * 100)
        : 0,
    };

    return report;
  }

  printReport(report) {
    console.log('\n========== 迁移报告 ==========\n');
    console.log(`✅ 成功迁移: ${report.migratedRecords} / ${report.totalRecords} 条记录`);
    console.log(`📊 成功率: ${report.successRate}%`);
    console.log(`⏱️  耗时: ${report.durationSeconds} 秒`);

    if (report.errors.length > 0) {
      console.log(`\n❌ 错误 (${report.errors.length}):`);
      report.errors.forEach((err) => {
        console.log(`  - [${err.table}] ${err.error.message}`);
      });
    }

    console.log('\n已完成迁移！请验证数据完整性。');
  }
}

/**
 * 主迁移流程
 */
async function runMigration() {
  const runner = new DataMigrationRunner();

  try {
    // 步骤 1: 验证环境
    await runner.validateEnvironment();

    // 步骤 2: 创建 Supabase 客户端
    runner.log('连接 Supabase...');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );

    // 步骤 3: 读取现有数据（模拟从 localStorage 导出）
    runner.log('读取本地数据...');
    const localDataPath = path.join(process.cwd(), 'database-products-snapshot.json');
    let localData = { products: [], orders: [], staff: [] };

    if (fs.existsSync(localDataPath)) {
      const fileContent = fs.readFileSync(localDataPath, 'utf-8');
      localData = JSON.parse(fileContent);
      runner.log(`已读取本地文件: ${localDataPath}`, 'success');
    } else {
      runner.log('未找到本地数据文件，使用空数据', 'warn');
    }

    // 步骤 4: 创建备份
    await runner.createBackup(localData, 'pre-migration-backup');

    // 步骤 5: 执行迁移
    runner.results.totalRecords = (localData.products?.length || 0) +
      (localData.orders?.length || 0) +
      (localData.staff?.length || 0);

    if (localData.products?.length > 0) {
      await runner.migrateProducts(supabase, localData.products);
    }

    if (localData.orders?.length > 0) {
      await runner.migrateOrders(supabase, localData.orders);
    }

    if (localData.staff?.length > 0) {
      await runner.migrateStaff(supabase, localData.staff);
    }

    // 步骤 6: 生成报告
    const report = await runner.generateMigrationReport();
    runner.printReport(report);

    // 步骤 7: 保存报告
    const reportPath = path.join(process.cwd(), `migration-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 详细报告已保存: ${reportPath}`);

    process.exit(0);
  } catch (error) {
    runner.log(`迁移失败: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

// 检查是否在 npm script 中运行
if (require.main === module) {
  runMigration();
}

module.exports = { DataMigrationRunner, runMigration };
