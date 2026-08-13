# `create-nightboy` 多模板脚手架实施计划

## 目标

依据已确认的设计规格，在 `packages/create-nightboy` 中实现可独立发布的多模板脚手架，并验证 6 个生成项目能够安装、格式校验、测试和构建。

## 阶段一：独立包与 CLI 核心

### 1. 创建包清单和入口

新增：

- `packages/create-nightboy/package.json`
- `packages/create-nightboy/bin/create-nightboy.js`
- `packages/create-nightboy/LICENSE`

要求：

- 使用 ESM 和 Node.js 18+。
- 注册 `create-nightboy` 命令。
- 仅发布 `bin`、`src`、`templates`、README 和 LICENSE。
- 锁定 `commander`、`@inquirer/prompts`、`picocolors` 的 Node 18 兼容精确版本。

### 2. 实现输入、交互和退出行为

新增：

- `packages/create-nightboy/src/cli.js`
- `packages/create-nightboy/src/prompts.js`

实现：

- 项目名、模板、包管理器、安装、Git、强制覆盖参数。
- TTY 下补问缺失选项，非 TTY 下应用确定性默认值。
- 参数校验错误退出码 `1`、后处理失败退出码 `2`、取消退出码 `130`。
- 输出生成结果和恢复命令。

### 3. 实现路径安全和包管理器适配

新增：

- `packages/create-nightboy/src/safety.js`
- `packages/create-nightboy/src/package-manager.js`

实现：

- 项目名和目标路径校验。
- 根目录、用户目录、当前目录、工作目录外路径和符号链接逃逸保护。
- 非空目录授权判断。
- npm、pnpm、yarn 命令映射、可用性检测和无 shell 子进程执行。

### 4. 实现模板源和事务式生成

新增：

- `packages/create-nightboy/src/template-sources/index.js`
- `packages/create-nightboy/src/template-sources/local.js`
- `packages/create-nightboy/src/template-sources/metadata.js`
- `packages/create-nightboy/src/template-sources/remote.js`
- `packages/create-nightboy/src/create-project.js`

实现：

- `listTemplates()`、`materializeTemplate()` 统一契约。
- 本地与远程源复用同一份六模板元数据；远程源按模板 ID 映射六个独立 Git 仓库。
- 物化目标由调用方预先创建且必须为空；模板源只能写入目标内部，失败后由 `createProject()` 清理整个临时目录。
- 远程模板使用默认分支浅克隆，清理 `.git`，并在任何模板转换前校验必要文件、真实路径边界、全部符号链接和明确定义的 ESLint 残留。
- `index.js` 显式选择本地或远程源；远程失败直接报错，不自动回退。
- 模板元数据完整校验。
- 同级临时目录生成、文件改名、结构化修改 `package.json`、文本变量替换。
- 原目标备份、原子迁移、失败回滚和备份清理告警。

## 阶段二：六个业务模板

### 5. Vue JavaScript / TypeScript 模板

新增 `templates/vue` 和 `templates/vue-ts`：

- Vite、Vue 3、Vue Router、Pinia、Axios。
- 首页、404、路由、状态、请求层、环境变量和基础样式。
- Vitest、Vue Test Utils、Prettier。
- JavaScript 与 TypeScript 保持相同业务结构。

### 6. React JavaScript / TypeScript 模板

新增 `templates/react` 和 `templates/react-ts`：

- Vite、React、Wouter、Zustand、Axios。
- 首页、404、路由、状态、请求层、环境变量和基础样式。
- Vitest、Testing Library、Prettier。
- JavaScript 与 TypeScript 保持相同业务结构。

### 7. Node.js TypeScript 模板

新增 `templates/node-ts`：

- Express 应用和服务启动分离。
- 健康检查路由、控制器、服务和统一错误处理。
- dotenv、Vitest、Supertest、Prettier、TypeScript。

### 8. npm TypeScript 工具库模板

新增 `templates/library-ts`：

- TypeScript 源码、Vitest 测试。
- tsup 生成 ESM、CommonJS 和类型声明。
- `exports`、发布白名单和 dry-run 检查。

所有模板依赖使用 Node.js 18 兼容的精确版本，不携带 lockfile。

## 阶段三：测试与文档

### 9. 单元测试

新增 `packages/create-nightboy/test` 下的测试，覆盖：

- 项目名和路径安全。
- 模板元数据、文件转换和变量替换。
- 包管理器映射与后处理控制流。
- TTY、非 TTY、布尔三态和退出码。
- 远程源克隆到已存在空目录、非空目录拒绝、未知模板 ID、Git 缺失、仓库不可达和克隆中断。
- 成功克隆后 `.git` 完全移除，符号链接逃逸、必要文件缺失和 ESLint 残留均被拒绝。
- 远程物化或校验失败后临时目录被清理，且不会回退调用本地模板源。

### 10. 模板生成与 CLI 端到端测试

覆盖：

- 6 个模板逐一生成。
- 非交互完整参数调用。
- 目录冲突、`--force`、禁用安装和 Git。
- 用户取消、包管理器缺失和提交失败回滚。

### 11. 文档

新增脚手架包 README，并在根 README 增加独立包导航。文档列出模板、参数、安全规则、三种包管理器和本地维护命令。

## 阶段四：发布级验证

依次执行：

1. `npm install` 安装脚手架自身依赖。
2. `npm test` 运行 CLI 测试。
3. 将 6 个模板生成到临时目录。
4. 每个模板执行 npm 安装、格式校验、测试和构建。
5. 执行 `npm pack --dry-run` 检查发布文件。
6. 生成 tarball，在隔离目录安装并运行 `create-nightboy --help` 和实际生成冒烟测试。

## 完成标准

- 设计规格中的全部验收项有实现和对应验证证据。
- 现有 `@nightboy/js-utils-lite` 的测试和发布检查仍通过。
- 根工具库和 `create-nightboy` 的发布边界保持独立。
