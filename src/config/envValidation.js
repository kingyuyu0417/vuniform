/**
 * 环境变量验证与启动检查
 * 确保应用在生产环境中不会因缺少关键配置而默认降级
 */

const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

const OPTIONAL_ENV_VARS = [
  'VITE_USE_SUPABASE_AUTH',
  'VITE_PUBLIC_APP_URL',
];

/**
 * 检查单个环境变量
 */
export const validateEnvVar = (key, value, options = {}) => {
  const { required = false, pattern = null, placeholder = false } = options;

  // 检查是否为占位符值
  if (placeholder && value) {
    const isPlaceholder = /your|你的|placeholder|example|示例|xxx|xxxxxx/i.test(value);
    if (isPlaceholder) {
      return {
        valid: false,
        error: `${key} 看起来是占位符值，请设置为真实值`,
        type: 'placeholder',
      };
    }
  }

  // 检查必填字段
  if (required && !value) {
    return {
      valid: false,
      error: `缺少必需的环境变量: ${key}`,
      type: 'missing',
    };
  }

  // 检查正则模式
  if (value && pattern && !pattern.test(value)) {
    return {
      valid: false,
      error: `${key} 格式无效`,
      type: 'invalid_format',
    };
  }

  return { valid: true };
};

/**
 * 验证所有环境变量
 */
export const validateAllEnvVars = () => {
  const errors = [];
  const warnings = [];

  // 验证必填变量
  REQUIRED_ENV_VARS.forEach((key) => {
    const value = import.meta.env[key];
    const result = validateEnvVar(key, value, {
      required: true,
      placeholder: true,
    });

    if (!result.valid) {
      errors.push(result);
    }
  });

  // 验证可选变量（如果设置了）
  OPTIONAL_ENV_VARS.forEach((key) => {
    const value = import.meta.env[key];
    if (value) {
      const result = validateEnvVar(key, value, { placeholder: true });
      if (!result.valid) {
        warnings.push(result);
      }
    }
  });

  // Supabase URL 格式检查
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl && !supabaseUrl.match(/^https:\/\/[^\s/]+\.supabase\.co\/?$/)) {
    errors.push({
      valid: false,
      error: 'VITE_SUPABASE_URL 必须是有效的 Supabase 项目 URL (https://xxx.supabase.co)',
      type: 'invalid_url_format',
    });
  }

  return { errors, warnings };
};

/**
 * 生成启动检查报告
 */
export const generateStartupReport = () => {
  const { errors, warnings } = validateAllEnvVars();
  const isProduction = import.meta.env.PROD;

  const report = {
    environment: isProduction ? '生产' : '开发',
    timestamp: new Date().toISOString(),
    errors,
    warnings,
    supabaseConfigured: !!import.meta.env.VITE_SUPABASE_URL,
    authEnabled: import.meta.env.VITE_USE_SUPABASE_AUTH === 'true',
  };

  return report;
};

/**
 * 在控制台输出检查结果
 */
export const logStartupCheck = () => {
  const report = generateStartupReport();

  console.group('🚀 Uniform POS 应用启动检查');
  console.log(`环境: ${report.environment}`);
  console.log(`时间: ${report.timestamp}`);
  console.log(`Supabase 已配置: ${report.supabaseConfigured ? '✅' : '❌'}`);
  console.log(`Auth 已启用: ${report.authEnabled ? '✅' : '❌'}`);

  if (report.errors.length > 0) {
    console.error(`❌ 发现 ${report.errors.length} 个错误:`);
    report.errors.forEach((err) => {
      console.error(`  - ${err.error}`);
    });
  }

  if (report.warnings.length > 0) {
    console.warn(`⚠️  发现 ${report.warnings.length} 个警告:`);
    report.warnings.forEach((warn) => {
      console.warn(`  - ${warn.error}`);
    });
  }

  if (report.errors.length === 0 && report.warnings.length === 0) {
    console.log('✅ 所有检查通过！');
  }

  console.groupEnd();

  return report;
};

/**
 * 获取用户友好的错误消息
 */
export const getStartupErrorUI = (errors) => {
  if (!errors || errors.length === 0) return null;

  return {
    title: '⚠️ 应用配置不完整',
    message: '缺少必需的环境变量。请检查 .env.local 配置。',
    errors: errors.map((err) => ({
      type: err.type,
      message: err.error,
      suggestion:
        err.type === 'missing'
          ? '请在 .env.local 中添加该变量'
          : err.type === 'placeholder'
            ? '请将占位符值替换为真实值'
            : '请检查变量格式',
    })),
  };
};
