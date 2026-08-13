# npm 常用 JS 方法包设计

## 目标

创建一个零依赖 npm 工具包，提供前端与 Node.js 中高频使用的 JavaScript 方法，并具备可发布到 npm 的基础工程结构。

## 包结构

- `src/index.js`：ES Module 源码入口，承载所有工具方法。
- `dist/index.cjs`：CommonJS 兼容入口，支持 `require()` 用户。
- `index.d.ts`：类型声明文件，提升 TypeScript 和编辑器提示体验。
- `test/index.test.js`：基于 Node.js 内置 test runner 的核心行为测试。
- `README.md`：安装、使用、方法列表和发布说明。

## 方法范围

首版包含类型判断、空值判断、深拷贝、防抖、节流、等待、数字限制、数组分组、数组去重、对象取值、字段挑选与排除、JSON 安全解析、随机字符串、日期格式化、查询字符串解析与序列化。

## 发布策略

通过 `package.json` 的 `exports` 同时声明 ESM 与 CommonJS 入口，使用 `files` 白名单控制发布内容。发布前执行 `npm test` 与 `npm run pack:check`，确保核心方法可用且发布包内容符合预期。

## 约束

当前目录不是 git 仓库，因此不执行设计文档提交。包名暂沿用已有 `npmpge`，正式发布前可根据 npm 占用情况修改。
