/**
 * 轻量级数据验证框架
 * 用于表单验证、API 响应验证、业务逻辑检查
 */

export class ValidationRule {
  constructor(name, validator, message) {
    this.name = name;
    this.validator = validator;
    this.message = message;
  }

  validate(value) {
    try {
      const isValid = this.validator(value);
      return {
        valid: isValid,
        error: isValid ? null : this.message,
      };
    } catch (error) {
      return {
        valid: false,
        error: `验证异常: ${error.message}`,
      };
    }
  }
}

/**
 * 内置验证规则
 */
export const validators = {
  required: () =>
    new ValidationRule(
      'required',
      (value) => Boolean(value && String(value).trim()),
      '此字段为必填项'
    ),

  email: () =>
    new ValidationRule(
      'email',
      (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      '邮箱格式无效'
    ),

  phone: () =>
    new ValidationRule(
      'phone',
      (value) => !value || /^[\d\s\-\+\(\)]{7,}$/.test(value),
      '电话号码格式无效'
    ),

  minLength: (min) =>
    new ValidationRule(
      'minLength',
      (value) => !value || String(value).length >= min,
      `最少需要 ${min} 个字符`
    ),

  maxLength: (max) =>
    new ValidationRule(
      'maxLength',
      (value) => !value || String(value).length <= max,
      `最多只能 ${max} 个字符`
    ),

  min: (min) =>
    new ValidationRule(
      'min',
      (value) => !value || Number(value) >= min,
      `最小值为 ${min}`
    ),

  max: (max) =>
    new ValidationRule(
      'max',
      (value) => !value || Number(value) <= max,
      `最大值为 ${max}`
    ),

  numeric: () =>
    new ValidationRule(
      'numeric',
      (value) => !value || /^\d+(\.\d+)?$/.test(value),
      '必须为数字'
    ),

  pattern: (pattern, description = '格式无效') =>
    new ValidationRule(
      'pattern',
      (value) => !value || pattern.test(value),
      description
    ),

  custom: (validator, message) =>
    new ValidationRule('custom', validator, message),
};

/**
 * 字段验证器
 */
export class FieldValidator {
  constructor(name) {
    this.name = name;
    this.rules = [];
  }

  addRule(rule) {
    this.rules.push(rule);
    return this;
  }

  validate(value) {
    const errors = [];

    for (const rule of this.rules) {
      const result = rule.validate(value);
      if (!result.valid) {
        errors.push(result.error);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      fieldName: this.name,
    };
  }
}

/**
 * 表单验证器
 */
export class FormValidator {
  constructor() {
    this.fields = new Map();
  }

  addField(name, ...rules) {
    const validator = new FieldValidator(name);
    rules.forEach((rule) => validator.addRule(rule));
    this.fields.set(name, validator);
    return this;
  }

  validate(data) {
    const errors = {};
    let isValid = true;

    for (const [fieldName, fieldValidator] of this.fields) {
      const result = fieldValidator.validate(data[fieldName]);
      if (!result.valid) {
        errors[fieldName] = result.errors;
        isValid = false;
      }
    }

    return { valid: isValid, errors };
  }
}

/**
 * 商品验证
 */
export const validateProduct = (product) => {
  const validator = new FormValidator()
    .addField('name', validators.required())
    .addField('school', validators.required())
    .addField('sizes', validators.custom(
      (value) => Array.isArray(value) && value.length > 0,
      '至少需要一个尺寸'
    ));

  return validator.validate(product);
};

/**
 * 订单验证
 */
export const validateOrder = (order) => {
  const validator = new FormValidator()
    .addField('school', validators.required())
    .addField('total', validators.required(), validators.min(0))
    .addField('items', validators.custom(
      (value) => Array.isArray(value) && value.length > 0,
      '订单至少需要一个商品'
    ));

  return validator.validate(order);
};

/**
 * 客户信息验证
 */
export const validateCustomer = (customer) => {
  const validator = new FormValidator()
    .addField('name', validators.required(), validators.minLength(2))
    .addField('phone', validators.phone());

  return validator.validate(customer);
};

/**
 * 员工信息验证
 */
export const validateStaff = (staff) => {
  const validator = new FormValidator()
    .addField('email', validators.required(), validators.email())
    .addField('role', validators.required(), 
      validators.custom(
        (value) => ['admin', 'manager', 'staff'].includes(value),
        '角色必须为 admin、manager 或 staff'
      )
    );

  return validator.validate(staff);
};

/**
 * 批量数据验证（如 CSV 导入）
 */
export const validateBatch = (items, validator) => {
  const results = items.map((item, index) => ({
    index,
    data: item,
    result: validator(item),
  }));

  const validItems = results.filter((r) => r.result.valid).map((r) => r.data);
  const invalidItems = results.filter((r) => !r.result.valid);

  return {
    totalCount: items.length,
    validCount: validItems.length,
    invalidCount: invalidItems.length,
    validItems,
    invalidItems,
    hasErrors: invalidItems.length > 0,
  };
};
