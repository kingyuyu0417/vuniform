import React from 'react';
import { AlertCircle, CheckCircle, InfoIcon, XCircle } from 'lucide-react';

/**
 * 通用警告/错误提示框
 */
export const Alert = ({ type = 'info', title, message, onClose, children }) => {
  const typeStyles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const iconMap = {
    error: <XCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
    info: <InfoIcon className="w-5 h-5" />,
  };

  return (
    <div className={`border rounded-lg p-4 ${typeStyles[type]}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">{iconMap[type]}</div>
        <div className="ml-3 flex-1">
          {title && <h3 className="font-semibold">{title}</h3>}
          {message && <p className="text-sm mt-1">{message}</p>}
          {children}
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-3 text-gray-400 hover:text-gray-600">
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * 通用按钮组件
 */
export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  ...props
}) => {
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50',
  };

  const sizeStyles = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      disabled={disabled || loading}
      onClick={onClick}
      className={`
        rounded font-medium transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {loading ? '加载中...' : children}
    </button>
  );
};

/**
 * 模态框组件
 */
export const Modal = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg shadow-xl ${sizeStyles[size]} max-h-screen overflow-y-auto`}>
        <div className="sticky top-0 flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="p-6 border-t bg-gray-50">{footer}</div>}
      </div>
    </div>
  );
};

/**
 * 加载指示器
 */
export const LoadingSpinner = ({ message = '加载中...', size = 'md' }) => {
  const sizeClass = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }[size];

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className={`${sizeClass} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`} />
      {message && <p className="mt-4 text-gray-600">{message}</p>}
    </div>
  );
};

/**
 * 数据表格组件
 */
export const DataTable = ({ columns, data, onRowClick, loading = false }) => {
  if (loading) return <LoadingSpinner />;

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        暂无数据
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-2 text-left font-semibold text-sm">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              onClick={() => onRowClick && onRowClick(row)}
              className="border-b hover:bg-gray-50 cursor-pointer"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-sm">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * 表单字段组件
 */
export const FormField = ({
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
  placeholder = '',
  disabled = false,
  required = false,
}) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2
          ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
        `}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

/**
 * 状态徽章组件
 */
export const Badge = ({ status, label }) => {
  const statusStyles = {
    pending: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    error: 'bg-red-100 text-red-800',
    default: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${statusStyles[status] || statusStyles.default}`}>
      {label}
    </span>
  );
};

/**
 * 确认对话框
 */
export const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, isDestructive = false }) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <div className="space-y-4">
        <p>{message}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button
            variant={isDestructive ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            确认
          </Button>
        </div>
      </div>
    </Modal>
  );
};

/**
 * 进度条组件
 */
export const ProgressBar = ({ value, max = 100, label }) => {
  const percentage = (value / max) * 100;

  return (
    <div className="w-full">
      {label && <p className="text-sm font-medium mb-1">{label}</p>}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {value} / {max}
      </p>
    </div>
  );
};
