const OBJECT_TYPE = '[object Object]';
const DATE_TIME_PARTS = {
  year: 'YYYY',
  month: 'MM',
  day: 'DD',
  hour: 'HH',
  minute: 'mm',
  second: 'ss',
};
const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const HTML_UNESCAPE_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/**
 * 将字符串拆分为单词数组，供命名格式转换方法复用。
 *
 * @param {*} value - 需要拆词的任意值。
 * @returns {string[]} 拆分后的小写单词数组。
 */
function splitWords(value) {
  return String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .match(/[A-Za-z0-9]+/g)
    ?.map((word) => word.toLowerCase()) ?? [];
}

/**
 * 判断目标值是否为普通对象，排除数组、日期、null 等特殊结构。
 *
 * @param {*} value - 需要判断的任意值。
 * @returns {boolean} 普通对象返回 true，否则返回 false。
 */
export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === OBJECT_TYPE;
}

/**
 * 判断目标值是否为空，覆盖字符串、数组、Map、Set 与普通对象。
 *
 * @param {*} value - 需要判断的任意值。
 * @returns {boolean} 空值返回 true，否则返回 false。
 */
export function isEmpty(value) {
  if (value == null) {
    return true;
  }

  if (typeof value === 'string' || Array.isArray(value)) {
    return value.length === 0;
  }

  if (value instanceof Map || value instanceof Set) {
    return value.size === 0;
  }

  if (isPlainObject(value)) {
    return Object.keys(value).length === 0;
  }

  return false;
}

/**
 * 深拷贝常见数据结构，支持对象、数组、Date、RegExp、Map、Set 与循环引用。
 *
 * @param {*} value - 需要拷贝的数据。
 * @param {WeakMap<object, *>} cache - 内部缓存，用于处理循环引用。
 * @returns {*} 拷贝后的新数据。
 */
export function deepClone(value, cache = new WeakMap()) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (cache.has(value)) {
    return cache.get(value);
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags);
  }

  if (value instanceof Map) {
    const clonedMap = new Map();
    cache.set(value, clonedMap);
    value.forEach((mapValue, mapKey) => {
      clonedMap.set(deepClone(mapKey, cache), deepClone(mapValue, cache));
    });
    return clonedMap;
  }

  if (value instanceof Set) {
    const clonedSet = new Set();
    cache.set(value, clonedSet);
    value.forEach((setValue) => {
      clonedSet.add(deepClone(setValue, cache));
    });
    return clonedSet;
  }

  const clonedValue = Array.isArray(value) ? [] : {};
  cache.set(value, clonedValue);

  Object.keys(value).forEach((key) => {
    clonedValue[key] = deepClone(value[key], cache);
  });

  return clonedValue;
}

/**
 * 创建防抖函数，适合搜索输入、窗口 resize 等高频触发场景。
 *
 * @param {Function} callback - 延迟执行的回调函数。
 * @param {number} delay - 延迟毫秒数。
 * @returns {Function} 包装后的防抖函数。
 */
export function debounce(callback, delay = 300) {
  let timer = null;

  return function debouncedCallback(...args) {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      callback.apply(this, args);
    }, delay);
  };
}

/**
 * 创建节流函数，适合滚动、拖拽、按钮防连点等固定频率触发场景。
 *
 * @param {Function} callback - 需要限制执行频率的回调函数。
 * @param {number} delay - 间隔毫秒数。
 * @returns {Function} 包装后的节流函数。
 */
export function throttle(callback, delay = 300) {
  let lastRunTime = 0;
  let timer = null;

  return function throttledCallback(...args) {
    const now = Date.now();
    const remainingTime = delay - (now - lastRunTime);

    if (remainingTime <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      lastRunTime = now;
      callback.apply(this, args);
      return;
    }

    if (!timer) {
      timer = setTimeout(() => {
        lastRunTime = Date.now();
        timer = null;
        callback.apply(this, args);
      }, remainingTime);
    }
  };
}

/**
 * 暂停指定时间，适合异步流程中的等待、重试间隔和演示延迟。
 *
 * @param {number} ms - 等待毫秒数。
 * @returns {Promise<void>} 等待结束后 resolve。
 */
export function sleep(ms = 0) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 将数字限制在最小值与最大值之间。
 *
 * @param {number} value - 原始数字。
 * @param {number} min - 允许的最小值。
 * @param {number} max - 允许的最大值。
 * @returns {number} 限制后的数字。
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * 按固定长度拆分数组，常用于分页、批量请求和宫格布局数据整理。
 *
 * @param {Array} list - 原始数组。
 * @param {number} size - 每组数量。
 * @returns {Array[]} 分组后的二维数组。
 */
export function chunk(list, size = 1) {
  if (!Array.isArray(list) || size <= 0) {
    return [];
  }

  const result = [];
  for (let index = 0; index < list.length; index += size) {
    result.push(list.slice(index, index + size));
  }

  return result;
}

/**
 * 扁平化数组，可按指定深度展开嵌套数组。
 *
 * @param {Array} list - 原始数组。
 * @param {number} depth - 展开深度。
 * @returns {Array} 扁平化后的数组。
 */
export function flatten(list, depth = 1) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list.flat(depth);
}

/**
 * 数组去重，支持通过字段名或取值函数对对象数组去重。
 *
 * @param {Array} list - 原始数组。
 * @param {string|Function} iteratee - 去重字段名或取值函数。
 * @returns {Array} 去重后的数组。
 */
export function uniqueBy(list, iteratee) {
  if (!Array.isArray(list)) {
    return [];
  }

  const seen = new Set();
  return list.filter((item) => {
    const key = typeof iteratee === 'function'
      ? iteratee(item)
      : iteratee
        ? item?.[iteratee]
        : item;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/**
 * 按字段名或取值函数对数组分组。
 *
 * @param {Array} list - 原始数组。
 * @param {string|Function} iteratee - 分组字段名或取值函数。
 * @returns {Record<string, Array>} 分组后的对象。
 */
export function groupBy(list, iteratee) {
  if (!Array.isArray(list)) {
    return {};
  }

  return list.reduce((result, item) => {
    const key = typeof iteratee === 'function' ? iteratee(item) : item?.[iteratee];
    const groupKey = String(key ?? '');
    result[groupKey] = result[groupKey] ?? [];
    result[groupKey].push(item);
    return result;
  }, {});
}

/**
 * 生成数字区间数组，适合页码、序号和简单循环数据生成。
 *
 * @param {number} start - 起始值；只有一个参数时表示结束值，起始值默认为 0。
 * @param {number} end - 结束值，结果不包含该值。
 * @param {number} step - 步长，传 0 时返回空数组防止死循环。
 * @returns {number[]} 生成后的数字数组。
 */
export function range(start, end, step) {
  const rangeStart = end === undefined ? 0 : start;
  const rangeEnd = end === undefined ? start : end;
  const rangeStep = step ?? (rangeStart <= rangeEnd ? 1 : -1);

  if (rangeStep === 0) {
    return [];
  }

  const result = [];
  const shouldContinue = rangeStep > 0
    ? (value) => value < rangeEnd
    : (value) => value > rangeEnd;

  for (let value = rangeStart; shouldContinue(value); value += rangeStep) {
    result.push(value);
  }

  return result;
}

/**
 * 按字段名或取值函数统计数组数值总和。
 *
 * @param {Array} list - 原始数组。
 * @param {string|Function} iteratee - 求和字段名或取值函数，缺省时直接累加数组项。
 * @returns {number} 求和结果，无法转为数字的值按 0 处理。
 */
export function sumBy(list, iteratee) {
  if (!Array.isArray(list)) {
    return 0;
  }

  return list.reduce((total, item) => {
    const rawValue = typeof iteratee === 'function'
      ? iteratee(item)
      : iteratee
        ? item?.[iteratee]
        : item;
    const numberValue = Number(rawValue);
    return total + (Number.isFinite(numberValue) ? numberValue : 0);
  }, 0);
}

/**
 * 按字段名或取值函数排序数组，返回新数组避免修改原始数据。
 *
 * @param {Array} list - 原始数组。
 * @param {string|Function} iteratee - 排序字段名或取值函数。
 * @param {'asc'|'desc'} order - 排序方向，默认升序。
 * @returns {Array} 排序后的新数组。
 */
export function sortBy(list, iteratee, order = 'asc') {
  if (!Array.isArray(list)) {
    return [];
  }

  const direction = order === 'desc' ? -1 : 1;
  return [...list].sort((left, right) => {
    const leftValue = typeof iteratee === 'function' ? iteratee(left) : left?.[iteratee];
    const rightValue = typeof iteratee === 'function' ? iteratee(right) : right?.[iteratee];

    if (leftValue == null && rightValue == null) {
      return 0;
    }

    if (leftValue == null) {
      return 1;
    }

    if (rightValue == null) {
      return -1;
    }

    return leftValue > rightValue ? direction : leftValue < rightValue ? -direction : 0;
  });
}

/**
 * 从对象中安全读取深层路径，路径不存在时返回默认值。
 *
 * @param {object} source - 数据源对象。
 * @param {string|string[]} path - 点路径或路径数组。
 * @param {*} defaultValue - 兜底返回值。
 * @returns {*} 命中的值或默认值。
 */
export function getValue(source, path, defaultValue) {
  const pathList = Array.isArray(path) ? path : String(path).split('.').filter(Boolean);
  const result = pathList.reduce((currentValue, key) => currentValue?.[key], source);
  return result === undefined ? defaultValue : result;
}

/**
 * 按路径设置对象深层值，会在路径不存在时自动创建中间对象。
 *
 * @param {object} source - 需要写入的数据源对象。
 * @param {string|string[]} path - 点路径或路径数组。
 * @param {*} value - 需要写入的值。
 * @returns {object} 写入后的原对象；source 非对象时返回空对象。
 */
export function setValue(source, path, value) {
  if (source === null || typeof source !== 'object') {
    return {};
  }

  const pathList = Array.isArray(path) ? path : String(path).split('.').filter(Boolean);

  if (pathList.length === 0) {
    return source;
  }

  let currentValue = source;
  pathList.forEach((key, index) => {
    const isLastKey = index === pathList.length - 1;

    if (isLastKey) {
      currentValue[key] = value;
      return;
    }

    if (currentValue[key] === null || typeof currentValue[key] !== 'object') {
      currentValue[key] = {};
    }

    currentValue = currentValue[key];
  });

  return source;
}

/**
 * 从对象中挑选指定字段，适合接口入参白名单和展示数据整理。
 *
 * @param {object} source - 数据源对象。
 * @param {string[]} keys - 需要保留的字段列表。
 * @returns {object} 挑选后的新对象。
 */
export function pick(source, keys = []) {
  if (!isPlainObject(source)) {
    return {};
  }

  return keys.reduce((result, key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key];
    }

    return result;
  }, {});
}

/**
 * 从对象中排除指定字段，适合过滤敏感字段和清理临时属性。
 *
 * @param {object} source - 数据源对象。
 * @param {string[]} keys - 需要排除的字段列表。
 * @returns {object} 排除后的新对象。
 */
export function omit(source, keys = []) {
  if (!isPlainObject(source)) {
    return {};
  }

  const blockedKeys = new Set(keys);
  return Object.keys(source).reduce((result, key) => {
    if (!blockedKeys.has(key)) {
      result[key] = source[key];
    }

    return result;
  }, {});
}

/**
 * 深度合并普通对象，数组和特殊对象会按新值整体覆盖并深拷贝。
 *
 * @param {object} target - 基础对象。
 * @param {...object} sources - 需要合并进来的对象列表。
 * @returns {object} 合并后的新对象，不修改入参。
 */
export function merge(target = {}, ...sources) {
  const result = isPlainObject(target) ? deepClone(target) : {};

  sources.forEach((source) => {
    if (!isPlainObject(source)) {
      return;
    }

    Object.keys(source).forEach((key) => {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
        result[key] = merge(targetValue, sourceValue);
        return;
      }

      result[key] = deepClone(sourceValue);
    });
  });

  return result;
}

/**
 * 安全解析 JSON 字符串，解析失败时返回默认值而不是抛出异常。
 *
 * @param {string} value - JSON 字符串。
 * @param {*} defaultValue - 解析失败时的兜底值。
 * @returns {*} 解析结果或兜底值。
 */
export function safeJsonParse(value, defaultValue = null) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * 生成随机字符串，适合临时 key、请求标识和前端短 ID。
 *
 * @param {number} length - 字符串长度。
 * @returns {string} 随机字符串。
 */
export function randomString(length = 8) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';

  for (let index = 0; index < length; index += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

/**
 * 将字符串首字母大写，其余字符转为小写。
 *
 * @param {*} value - 需要转换的任意值。
 * @returns {string} 首字母大写后的字符串。
 */
export function capitalize(value) {
  const text = String(value ?? '');

  if (!text) {
    return '';
  }

  return `${text.charAt(0).toUpperCase()}${text.slice(1).toLowerCase()}`;
}

/**
 * 将字符串转换为 camelCase，适合字段名和变量名整理。
 *
 * @param {*} value - 需要转换的任意值。
 * @returns {string} camelCase 字符串。
 */
export function camelCase(value) {
  return splitWords(value)
    .map((word, index) => (index === 0 ? word : capitalize(word)))
    .join('');
}

/**
 * 将字符串转换为 kebab-case，适合 URL、CSS 类名和短横线命名。
 *
 * @param {*} value - 需要转换的任意值。
 * @returns {string} kebab-case 字符串。
 */
export function kebabCase(value) {
  return splitWords(value).join('-');
}

/**
 * 转义 HTML 特殊字符，避免将用户输入直接拼进 HTML 时产生注入风险。
 *
 * @param {*} value - 需要转义的任意值。
 * @returns {string} 转义后的字符串。
 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

/**
 * 还原常见 HTML 实体，适合展示前处理已转义的简单文本。
 *
 * @param {*} value - 需要还原的任意值。
 * @returns {string} 还原后的字符串。
 */
export function unescapeHtml(value) {
  return String(value ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (entity) => HTML_UNESCAPE_MAP[entity]);
}

/**
 * 格式化日期，默认输出 YYYY-MM-DD HH:mm:ss。
 *
 * @param {Date|string|number} value - Date 对象、时间戳或可解析的日期字符串。
 * @param {string} template - 日期格式模板。
 * @returns {string} 格式化后的日期字符串，非法日期返回空字符串。
 */
export function formatDate(value = new Date(), template = 'YYYY-MM-DD HH:mm:ss') {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = {
    [DATE_TIME_PARTS.year]: String(date.getFullYear()),
    [DATE_TIME_PARTS.month]: String(date.getMonth() + 1).padStart(2, '0'),
    [DATE_TIME_PARTS.day]: String(date.getDate()).padStart(2, '0'),
    [DATE_TIME_PARTS.hour]: String(date.getHours()).padStart(2, '0'),
    [DATE_TIME_PARTS.minute]: String(date.getMinutes()).padStart(2, '0'),
    [DATE_TIME_PARTS.second]: String(date.getSeconds()).padStart(2, '0'),
  };

  return Object.keys(parts).reduce((result, token) => result.replace(token, parts[token]), template);
}

/**
 * 将对象序列化为查询字符串，自动跳过 undefined 和 null。
 *
 * @param {object} params - 查询参数对象。
 * @returns {string} 不带问号的查询字符串。
 */
export function stringifyQuery(params = {}) {
  if (!isPlainObject(params)) {
    return '';
  }

  return Object.keys(params)
    .filter((key) => params[key] != null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join('&');
}

/**
 * 解析查询字符串为对象，支持带问号或完整 URL 的输入。
 *
 * @param {string} query - 查询字符串或 URL。
 * @returns {Record<string, string>} 解析后的参数对象。
 */
export function parseQuery(query = '') {
  const queryString = String(query).includes('?') ? String(query).split('?').pop() : String(query);
  const cleanQuery = queryString.split('#')[0];

  if (!cleanQuery) {
    return {};
  }

  return cleanQuery.split('&').reduce((result, pair) => {
    const [rawKey, rawValue = ''] = pair.split('=');

    if (!rawKey) {
      return result;
    }

    result[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
    return result;
  }, {});
}
