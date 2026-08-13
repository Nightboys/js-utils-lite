# @nightboy/js-utils-lite

一个零依赖 JavaScript 常用方法工具包，适合在浏览器、Node.js、现代打包工具中使用。

## 安装

```bash
npm install @nightboy/js-utils-lite
```

## 使用

```js
import { deepClone, debounce, formatDate, uniqueBy } from '@nightboy/js-utils-lite';

const list = uniqueBy([{ id: 1 }, { id: 1 }, { id: 2 }], 'id');
const cloned = deepClone({ user: { name: 'codex' } });
const today = formatDate(new Date(), 'YYYY-MM-DD');
const onSearch = debounce((keyword) => {
  console.log(keyword);
}, 300);
```

CommonJS 也可以使用：

```js
const { deepClone, throttle } = require('@nightboy/js-utils-lite');
```

## 方法列表

| 方法 | 说明 |
| --- | --- |
| `isPlainObject(value)` | 判断是否为普通对象 |
| `isEmpty(value)` | 判断字符串、数组、Map、Set、对象是否为空 |
| `deepClone(value)` | 深拷贝对象、数组、Date、RegExp、Map、Set，支持循环引用 |
| `debounce(callback, delay)` | 创建防抖函数 |
| `throttle(callback, delay)` | 创建节流函数 |
| `sleep(ms)` | 等待指定毫秒数 |
| `clamp(value, min, max)` | 将数字限制在范围内 |
| `chunk(list, size)` | 按固定长度拆分数组 |
| `flatten(list, depth)` | 按深度扁平化数组 |
| `uniqueBy(list, iteratee)` | 数组去重，支持字段名或取值函数 |
| `groupBy(list, iteratee)` | 数组分组，支持字段名或取值函数 |
| `range(start, end, step)` | 生成数字区间数组 |
| `sumBy(list, iteratee)` | 按字段名或取值函数统计数组总和 |
| `sortBy(list, iteratee, order)` | 按字段名或取值函数排序数组 |
| `getValue(source, path, defaultValue)` | 安全读取对象深层路径 |
| `setValue(source, path, value)` | 按路径设置对象深层值 |
| `pick(source, keys)` | 挑选对象字段 |
| `omit(source, keys)` | 排除对象字段 |
| `merge(target, ...sources)` | 深度合并普通对象 |
| `safeJsonParse(value, defaultValue)` | 安全解析 JSON |
| `randomString(length)` | 生成随机字符串 |
| `capitalize(value)` | 首字母大写 |
| `camelCase(value)` | 转换为 camelCase |
| `kebabCase(value)` | 转换为 kebab-case |
| `escapeHtml(value)` | 转义 HTML 特殊字符 |
| `unescapeHtml(value)` | 还原常见 HTML 实体 |
| `formatDate(value, template)` | 格式化日期 |
| `stringifyQuery(params)` | 对象转查询字符串 |
| `parseQuery(query)` | 查询字符串转对象 |

## 发布前检查

```bash
npm test
npm run pack:check
```

确认包名未被占用并登录 npm 后发布：

```bash
npm login
npm publish
```

如果要改包名，请先修改 `package.json` 中的 `name` 字段，再执行发布。
