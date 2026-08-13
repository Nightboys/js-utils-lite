import { confirm, input, select } from "@inquirer/prompts";

/**
 * 创建真实提示器集合，测试可以注入同结构实现而不操作终端。
 *
 * @returns {{input: Function, select: Function, confirm: Function}} 交互提示器。
 */
export function createPromptAdapter() {
  return { input, select, confirm };
}

/**
 * 在交互终端中补齐用户未显式提供的生成选项。
 *
 * @param {object} options - 命令行已解析选项，未指定项保持 undefined。
 * @param {object} context - 模板、交互能力和提示器上下文。
 * @returns {Promise<object>} 完整生成选项。
 */
export async function resolveProjectOptions(
  options,
  { templates, isInteractive, promptAdapter = createPromptAdapter() },
) {
  const resolvedOptions = { ...options };

  if (!isInteractive) {
    if (!resolvedOptions.projectName || !resolvedOptions.template) {
      throw new Error(
        "Non-interactive usage requires [project-name] and --template <id>.",
      );
    }

    return {
      ...resolvedOptions,
      packageManager: resolvedOptions.packageManager ?? "npm",
      install: resolvedOptions.install ?? true,
      git: resolvedOptions.git ?? true,
    };
  }

  if (!resolvedOptions.projectName) {
    resolvedOptions.projectName = await promptAdapter.input({
      message: "Project name:",
      default: "nightboy-app",
    });
  }

  if (!resolvedOptions.template) {
    resolvedOptions.template = await promptAdapter.select({
      message: "Choose a template:",
      choices: templates.map((template) => ({
        name: template.label,
        value: template.id,
      })),
    });
  }

  if (!resolvedOptions.packageManager) {
    resolvedOptions.packageManager = await promptAdapter.select({
      message: "Choose a package manager:",
      choices: [
        { name: "npm", value: "npm" },
        { name: "pnpm", value: "pnpm" },
        { name: "yarn", value: "yarn" },
      ],
    });
  }

  if (resolvedOptions.install === undefined) {
    resolvedOptions.install = await promptAdapter.confirm({
      message: "Install dependencies?",
      default: true,
    });
  }

  if (resolvedOptions.git === undefined) {
    resolvedOptions.git = await promptAdapter.confirm({
      message: "Initialize a Git repository?",
      default: true,
    });
  }

  return resolvedOptions;
}

/**
 * 在非空目录未通过 --force 授权时收集明确覆盖确认。
 *
 * @param {string} targetPath - 即将被替换的目标目录。
 * @param {object} options - 交互上下文。
 * @returns {Promise<boolean>} 用户是否允许覆盖。
 */
export async function confirmDirectoryOverwrite(
  targetPath,
  { promptAdapter = createPromptAdapter() } = {},
) {
  return promptAdapter.confirm({
    message: `Target directory is not empty. Replace it? ${targetPath}`,
    default: false,
  });
}
