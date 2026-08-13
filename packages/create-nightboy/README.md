# create-nightboy

用于创建 Vue、React、Node.js 和 TypeScript 工具库项目的多模板脚手架。模板随 npm 包发布，生成过程不需要下载远程仓库。

## 环境要求

- Node.js 18 或更高版本
- npm、pnpm 或 yarn

## 使用

启动交互向导：

```bash
npm create nightboy@latest
```

也可以直接提供参数：

```bash
npm create nightboy@latest my-app -- --template vue-ts
npx create-nightboy api-service --template node-ts --package-manager pnpm --no-install
```

## 模板

| 标识         | 技术栈                                                    |
| ------------ | --------------------------------------------------------- |
| `vue`        | Vue 3、Vite、Vue Router、Pinia、Axios、Vitest             |
| `vue-ts`     | Vue 3、TypeScript、Vite、Vue Router、Pinia、Axios、Vitest |
| `react`      | React、Vite、Wouter、Zustand、Axios、Vitest               |
| `react-ts`   | React、TypeScript、Vite、Wouter、Zustand、Axios、Vitest   |
| `node-ts`    | Express、TypeScript、dotenv、Vitest、Supertest            |
| `library-ts` | TypeScript、tsup、ESM/CommonJS、类型声明、Vitest          |

所有模板使用 Prettier 进行格式化，不包含 ESLint。

## 参数

| 参数                           | 说明                       |
| ------------------------------ | -------------------------- |
| `[project-name]`               | 项目名称和目标目录名       |
| `-t, --template <id>`          | 模板标识                   |
| `-p, --package-manager <name>` | `npm`、`pnpm` 或 `yarn`    |
| `--install` / `--no-install`   | 是否安装依赖               |
| `--git` / `--no-git`           | 是否初始化 Git             |
| `--force`                      | 替换已经存在的非空目标目录 |
| `--help`                       | 查看帮助                   |
| `--version`                    | 查看版本                   |

在非交互环境中必须提供项目名和模板；包管理器默认使用 npm，并默认安装依赖和初始化 Git。

## 目录安全

- 目标目录必须是当前工作目录的直接子目录。
- 根目录、用户目录、当前工作目录和符号链接不能作为覆盖目标。
- 非空目录在交互模式下需要明确确认；非交互模式需要显式传入 `--force`。
- 生成内容先写入同级临时目录，完成校验后再替换目标目录。
- 覆盖现有目录时会先创建同级备份；新项目迁移失败会恢复原目录。

## 包管理器示例

```bash
npx create-nightboy npm-app --template vue --package-manager npm --no-install --no-git
npx create-nightboy pnpm-app --template react-ts --package-manager pnpm --no-install --no-git
npx create-nightboy yarn-app --template node-ts --package-manager yarn --no-install --no-git
```

生成完成后按照终端输出进入目录并启动开发服务。npm 对应 `npm run dev`，pnpm 对应 `pnpm dev`，yarn 对应 `yarn dev`。

## 本地开发

```bash
cd packages/create-nightboy
npm install
npm test
npm run pack:check
```

本地生成项目：

```bash
node ./bin/create-nightboy.js demo-app --template vue-ts --no-install --no-git
```

模板源通过 `listTemplates()` 和 `materializeTemplate()` 统一接口接入。当前默认启用随包发布的本地模板，远程 Git 模板源已实现但保持关闭。

## 切换远程模板

远程模板源框架已经内置，但默认仍使用本地模板。六套模板各自对应一个独立 Git 仓库，仓库地址统一维护在 `src/template-sources/remote.js` 的 `REMOTE_TEMPLATE_REPOSITORIES` 中。

启用远程模板只需两步：

1. 将 `REMOTE_TEMPLATE_REPOSITORIES` 中的六个 `repositoryUrl` 替换为真实仓库地址。
2. 在 `src/template-sources/index.js` 的 `getTemplateSource()` 中注释本地返回语句，并取消远程返回语句的注释。

```js
export function getTemplateSource() {
  // return localTemplateSource;
  return remoteTemplateSource;
}
```

每个远程仓库的根目录就是对应模板根目录，至少需要包含合法的 `package.json` 和普通文件 `README.md`。README 可使用 `{{projectName}}` 占位符；`.gitignore`、`.env.example` 和 `.prettierignore` 可以使用正常文件名，也兼容本地发布模板使用的下划线名称。

远程源使用仓库默认分支执行浅克隆，成功后自动移除 `.git`。Git 不可用、仓库无法访问、模板包含符号链接、必要文件无效或存在 ESLint 残留时会直接停止生成，不会回退到本地模板，也不会留下最终项目半成品。
