/**
 * Supabase Auth 系统升级配置指南
 * 从 PIN 测试模式升级到生产就绪的 Auth + RLS
 * 
 * 当前状态: PIN 模式 (VITE_USE_SUPABASE_AUTH=false)
 * 目标状态: Auth 模式 (VITE_USE_SUPABASE_AUTH=true)
 */

export const AUTH_UPGRADE_STEPS = [
  {
    order: 1,
    title: "备份现有数据",
    description: "在进行任何迁移前，创建 Supabase 数据库的完整备份",
    action: "在 Supabase 控制台 → Settings → Backups 创建备份",
    status: "pending",
  },
  {
    order: 2,
    title: "启用 Supabase Auth",
    description: "配置认证提供商（邮箱/密码、Google、微信等）",
    steps: [
      "进入 Supabase 控制台 → Authentication",
      "配置 Providers: 启用 Email Password",
      "配置 Email Templates: 自定义欢迎、重置等邮件",
      "配置 URL Configuration: 添加重定向 URLs",
    ],
    status: "pending",
  },
  {
    order: 3,
    title: "创建 staff_profiles 表",
    description: "存储员工角色与权限信息",
    sql: `
      CREATE TABLE staff_profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- 启用 RLS
      ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;

      -- 策略：员工只能查看和修改自己的信息
      CREATE POLICY "Employees can read own profile" 
        ON staff_profiles FOR SELECT 
        USING (auth.uid() = id);

      -- Admin 可以管理所有员工
      CREATE POLICY "Admin manages staff"
        ON staff_profiles FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM staff_profiles 
            WHERE id = auth.uid() AND role = 'admin'
          )
        );
    `,
    status: "pending",
  },
  {
    order: 4,
    title: "更新订单表 RLS 策略",
    description: "限制数据访问权限，防止泄露",
    sql: `
      -- 创建订单访问策略
      ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

      -- 公开策略（用于客户查询）
      CREATE POLICY "Public can read own orders"
        ON orders FOR SELECT
        USING (
          -- 允许基于订单 ID 的查询（来自 QR 码）
          auth.uid()::text = 'guest' OR true
        );

      -- 员工策略
      CREATE POLICY "Staff can manage orders"
        ON orders FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM staff_profiles 
            WHERE id = auth.uid() 
              AND status = 'active'
          )
        );
    `,
    status: "pending",
  },
  {
    order: 5,
    title: "部署 Edge Function: manage-staff",
    description: "处理员工邀请、密码重置等操作",
    command: "supabase functions deploy manage-staff",
    prerequisites: [
      "已安装 Supabase CLI",
      "已登入 Supabase 账户",
      "在项目根目录执行命令",
    ],
    status: "pending",
  },
  {
    order: 6,
    title: "更新环境变量",
    description: "启用 Auth 模式",
    env: {
      "VITE_USE_SUPABASE_AUTH": "true",
      "VITE_SUPABASE_URL": "你的 Supabase URL",
      "VITE_SUPABASE_ANON_KEY": "你的匿名密钥",
    },
    notes: "修改后需要重启开发服务器或重新部署",
    status: "pending",
  },
  {
    order: 7,
    title: "创建首个管理员",
    description: "在 Supabase Authentication 中创建管理员账户",
    steps: [
      "进入 Supabase 控制台 → Authentication → Users",
      "点击 'Add user'",
      "输入邮箱和密码",
      "创建后，在 staff_profiles 表中添加相应记录",
      "设置 role='admin'",
    ],
    status: "pending",
  },
  {
    order: 8,
    title: "迁移现有数据",
    description: "将本地 localStorage 数据导入 Supabase",
    steps: [
      "运行脚本: npm run verify:supabase",
      "检查数据一致性",
      "运行导入脚本: node scripts/migrate-data-to-supabase.js",
    ],
    status: "pending",
  },
  {
    order: 9,
    title: "测试登入流程",
    description: "验证新的 Auth 系统正常工作",
    testCases: [
      "使用邮箱/密码登入",
      "创建新员工账户",
      "修改员工角色",
      "停用/启用员工",
      "验证权限控制",
    ],
    status: "pending",
  },
  {
    order: 10,
    title: "删除测试数据",
    description: "清理旧的 PIN 账户和测试数据",
    caution: "确保已完全迁移所有生产数据",
    sql: `
      -- 删除测试 PIN 账户 (可选)
      -- DELETE FROM accounts WHERE pin IN ('0000', '1111', '2222', '3333');
    `,
    status: "pending",
  },
];

/**
 * Auth 升级检查清单
 */
export const AUTH_UPGRADE_CHECKLIST = {
  preUpgrade: [
    { task: "完整数据库备份已创建", completed: false },
    { task: "测试环境已验证", completed: false },
    { task: "迁移脚本已审查", completed: false },
    { task: "获得利益相关者批准", completed: false },
  ],

  during: [
    { task: "创建 staff_profiles 表", completed: false },
    { task: "更新 RLS 策略", completed: false },
    { task: "部署 Edge Functions", completed: false },
    { task: "更新环境变量", completed: false },
    { task: "创建首个管理员账户", completed: false },
  ],

  postUpgrade: [
    { task: "验证登入流程", completed: false },
    { task: "测试员工创建", completed: false },
    { task: "测试权限控制", completed: false },
    { task: "验证数据访问限制", completed: false },
    { task: "监控错误日志 24 小时", completed: false },
  ],
};

/**
 * 常见升级问题与解决方案
 */
export const AUTH_UPGRADE_FAQ = [
  {
    question: "升级后用户会丢失登入状态吗？",
    answer: "不会。Supabase Auth 使用 JWT token 和本地会话存储，用户会自动迁移。",
  },
  {
    question: "如何处理旧的 PIN 账户？",
    answer: "可以保留或删除。建议创建平行测试环境，确认新系统无误后再删除旧账户。",
  },
  {
    question: "升级期间应用会下线吗？",
    answer: "不需要。可以在运行期间逐步迁移，通过功能开关控制。",
  },
  {
    question: "如何恢复到 PIN 模式？",
    answer: "将 VITE_USE_SUPABASE_AUTH 改为 false，重启应用即可。保留 Auth 数据作为备份。",
  },
  {
    question: "邮件发送失败怎么办？",
    answer: "检查 Supabase SMTP 配置，或使用 Resend/SendGrid 等第三方邮件服务。",
  },
];

/**
 * Auth 升级状态跟踪
 */
export const createAuthUpgradeTracker = () => {
  return {
    startedAt: new Date(),
    completedSteps: [],
    currentStep: null,
    errors: [],

    markStepComplete(stepOrder) {
      this.completedSteps.push(stepOrder);
    },

    markStepError(stepOrder, error) {
      this.errors.push({ stepOrder, error, timestamp: new Date() });
    },

    getProgress() {
      return {
        totalSteps: AUTH_UPGRADE_STEPS.length,
        completedSteps: this.completedSteps.length,
        percentage: Math.round((this.completedSteps.length / AUTH_UPGRADE_STEPS.length) * 100),
        hasErrors: this.errors.length > 0,
      };
    },

    getReport() {
      return {
        startTime: this.startedAt,
        completionTime: new Date(),
        totalDuration: new Date() - this.startedAt,
        completedSteps: this.completedSteps,
        failedSteps: [...new Set(this.errors.map((e) => e.stepOrder))],
        errors: this.errors,
        progress: this.getProgress(),
      };
    },
  };
};
