/**
 * 结构化错误处理与日志系统
 * 提供一致的错误格式、重试策略、用户友好提示
 */

export class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.code = options.code || 'UNKNOWN_ERROR';
    this.statusCode = options.statusCode || 500;
    this.context = options.context || {};
    this.timestamp = new Date().toISOString();
    this.isRetryable = options.isRetryable !== false;
    this.originalError = options.originalError || null;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      isRetryable: this.isRetryable,
    };
  }
}

export class SupabaseError extends AppError {
  constructor(message, supabaseError) {
    super(message, {
      code: 'SUPABASE_ERROR',
      statusCode: supabaseError?.status || 500,
      originalError: supabaseError,
      isRetryable: supabaseError?.status >= 500 || supabaseError?.status === 429,
    });
    this.name = 'SupabaseError';
  }
}

export class ValidationError extends AppError {
  constructor(message, fieldErrors = {}) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      isRetryable: false,
    });
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export class NetworkError extends AppError {
  constructor(message, originalError) {
    super(message, {
      code: 'NETWORK_ERROR',
      statusCode: 0,
      originalError,
      isRetryable: true,
    });
    this.name = 'NetworkError';
  }
}

/**
 * 重试策略：指数退避
 */
export const retryWithBackoff = async (
  asyncFn,
  options = {}
) => {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    shouldRetry = (error) => error.isRetryable,
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await asyncFn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );

      console.warn(
        `⏳ 重试 (${attempt + 1}/${maxRetries}) 在 ${delayMs}ms 后...`,
        error.message
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
};

/**
 * 用户友好的错误消息映射
 */
const ERROR_MESSAGES = {
  SUPABASE_ERROR: {
    400: '数据格式有误，请检查输入',
    401: '未授权，请重新登入',
    403: '您没有权限执行此操作',
    404: '数据未找到',
    429: '请求过于频繁，请稍后再试',
    500: '服务器出错，请稍后再试',
    default: '与数据库连接失败',
  },
  NETWORK_ERROR: {
    default: '网络连接失败，请检查您的网络',
  },
  VALIDATION_ERROR: {
    default: '输入数据有误，请检查',
  },
};

/**
 * 获取用户友好的错误提示
 */
export const getUserFriendlyError = (error) => {
  if (error instanceof AppError) {
    const messages = ERROR_MESSAGES[error.code] || {};
    const message = messages[error.statusCode] || messages.default;
    return {
      title: error.name,
      message,
      details: error.context,
      canRetry: error.isRetryable,
    };
  }

  return {
    title: '出错了',
    message: error.message || '发生未知错误',
    canRetry: false,
  };
};

/**
 * 结构化日志
 */
export const logError = (error, context = {}) => {
  const errorData = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    ...context,
  };

  if (error instanceof AppError) {
    console.error(`[${error.code}]`, error.toJSON());
  } else {
    console.error('[UNKNOWN_ERROR]', errorData);
  }

  // 可以集成到错误追踪服务（如 Sentry）
  // sentryClient.captureException(error, { contexts: { app: context } });
};

/**
 * 安全包装异步操作
 */
export const safeAsync = (asyncFn, errorHandler = null) => {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      logError(error, { args });

      if (errorHandler) {
        errorHandler(error);
      }

      throw error;
    }
  };
};

/**
 * 错误恢复助手
 */
export const createErrorRecovery = () => {
  const recovery = {
    fallbackToLocalStorage: false,
    offlineMode: false,
    syncQueue: [],

    markAsOffline() {
      this.offlineMode = true;
      this.fallbackToLocalStorage = true;
      console.warn('⚠️ 已切换到离线模式，使用本地存储');
    },

    markAsOnline() {
      this.offlineMode = false;
      console.log('✅ 已恢复在线，同步队列中的操作');
      this.processSyncQueue();
    },

    addToSyncQueue(operation) {
      this.syncQueue.push({
        ...operation,
        addedAt: new Date().toISOString(),
      });
    },

    async processSyncQueue() {
      while (this.syncQueue.length > 0) {
        const operation = this.syncQueue.shift();
        try {
          await operation.execute();
        } catch (error) {
          console.error('同步失败，重新加入队列:', error);
          this.addToSyncQueue(operation);
          break;
        }
      }
    },
  };

  return recovery;
};
