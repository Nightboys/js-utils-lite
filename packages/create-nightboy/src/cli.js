import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Command, Option } from "commander";
import colors from "picocolors";

import { createProject } from "./create-project.js";
import {
  getInstallCommand,
  getRunScriptCommand,
  isCommandAvailable,
  listPackageManagers,
  runExternalCommand,
} from "./package-manager.js";
import { confirmDirectoryOverwrite, resolveProjectOptions } from "./prompts.js";
import {
  assertSafeTarget,
  getDirectoryState,
  resolveTargetPath,
  validateProjectName,
} from "./safety.js";
import { getTemplateSource } from "./template-sources/index.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(path.resolve(currentDirectory, "../package.json"), "utf8"),
);
const EXIT_CODE = {
  success: 0,
  failure: 1,
  postProcessFailure: 2,
  cancelled: 130,
};

/**
 * 创建带退出码的可预期 CLI 错误，供顶层统一转换为进程状态。
 */
export class CliError extends Error {
  constructor(message, exitCode = EXIT_CODE.failure) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

/**
 * 构建 Commander 命令对象，并保留布尔参数的未指定状态供交互层判断。
 *
 * @param {object} streams - 输出流配置。
 * @returns {Command} 可解析 create-nightboy 参数的命令对象。
 */
export function createProgram({
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const program = new Command();

  program
    .name("create-nightboy")
    .description(packageJson.description)
    .version(packageJson.version)
    .argument("[project-name]", "project name and target directory")
    .addOption(new Option("-t, --template <id>", "template id"))
    .addOption(new Option("-p, --package-manager <name>", "npm, pnpm, or yarn"))
    .addOption(
      new Option("--install", "install dependencies after generation").default(
        undefined,
      ),
    )
    .addOption(new Option("--no-install", "skip dependency installation"))
    .addOption(
      new Option("--git", "initialize a Git repository").default(undefined),
    )
    .addOption(new Option("--no-git", "skip Git initialization"))
    .option("--force", "replace a non-empty target directory", false)
    .allowExcessArguments(false)
    .exitOverride()
    .configureOutput({
      writeOut: (message) => stdout.write(message),
      writeErr: (message) => stderr.write(message),
    });

  return program;
}

/**
 * 将命令行参数解析为不含 Commander 内部结构的简单对象。
 *
 * @param {string[]} argv - 完整 Node.js argv。
 * @param {object} streams - 输出流配置。
 * @returns {object} CLI 原始选项。
 */
export function parseCliArguments(argv, streams) {
  const program = createProgram(streams);
  program.parse(argv);
  const [projectName] = program.args;
  const options = program.opts();

  return {
    projectName,
    template: options.template,
    packageManager: options.packageManager,
    install: options.install,
    git: options.git,
    force: options.force,
  };
}

/**
 * 判断提示库抛出的中断错误，避免把 Ctrl+C 显示成内部故障。
 *
 * @param {unknown} error - 捕获到的任意错误。
 * @returns {boolean} 是否属于用户主动中断。
 */
function isPromptCancellation(error) {
  return (
    error?.name === "ExitPromptError" || error?.code === "ERR_USE_AFTER_CLOSE"
  );
}

/**
 * 输出项目生成成功后的最短可执行下一步，包管理器命令按用户选择展示。
 *
 * @param {object} context - 生成结果和输出上下文。
 * @returns {void}
 */
function printSuccess({ projectName, packageManager, install, stdout }) {
  const startCommand = getRunScriptCommand(packageManager, "dev").display;
  stdout.write(`\n${colors.green("Project created successfully.")}\n\n`);
  stdout.write(`  cd ${projectName}\n`);

  if (!install) {
    stdout.write(`  ${packageManager} install\n`);
  }

  stdout.write(`  ${startCommand}\n\n`);
}

/**
 * 执行依赖安装和 Git 初始化；失败时保留项目并提供恢复命令。
 *
 * @param {object} options - 已解析生成选项和执行依赖。
 * @returns {Promise<{ok: boolean, failedStep?: string}>} 后处理结果。
 */
export async function runPostProcessing({
  targetPath,
  packageManager,
  install,
  git,
  commandRunner = runExternalCommand,
  stderr = process.stderr,
}) {
  if (install) {
    const installCommand = getInstallCommand(packageManager);
    const installResult = await commandRunner(
      installCommand.command,
      installCommand.args,
      { cwd: targetPath },
    );

    if (!installResult.ok) {
      stderr.write(`${colors.red("Dependency installation failed.")}\n`);
      stderr.write(`Retry: cd ${targetPath} && ${packageManager} install\n`);

      if (git) {
        stderr.write(
          `Git initialization was skipped. Retry: cd ${targetPath} && git init\n`,
        );
      }

      return { ok: false, failedStep: "install" };
    }
  }

  if (git) {
    const gitResult = await commandRunner("git", ["init"], { cwd: targetPath });

    if (!gitResult.ok) {
      stderr.write(`${colors.yellow("Git initialization failed.")}\n`);
      stderr.write(`Retry: cd ${targetPath} && git init\n`);
      return { ok: false, failedStep: "git" };
    }
  }

  return { ok: true };
}

/**
 * 编排完整脚手架流程，并将所有终端状态映射为稳定退出码。
 *
 * @param {object} context - 可注入的进程、模板源、提示器和执行器上下文。
 * @returns {Promise<number>} 应设置给 process.exitCode 的数值。
 */
export async function runCli({
  argv = process.argv,
  workingDirectory = process.cwd(),
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  templateSource = getTemplateSource(),
  promptAdapter,
  commandAvailable = isCommandAvailable,
  commandRunner = runExternalCommand,
  projectCreator = createProject,
} = {}) {
  try {
    let parsedOptions;

    try {
      parsedOptions = parseCliArguments(argv, { stdout, stderr });
    } catch (error) {
      // Commander 通过异常承载 --help、--version 和参数错误，需保留其标准输出。
      if (
        error?.code === "commander.helpDisplayed" ||
        error?.code === "commander.version"
      ) {
        return EXIT_CODE.success;
      }

      throw new CliError(error?.message ?? "Invalid command options.");
    }

    const templates = await templateSource.listTemplates();
    const isInteractive = Boolean(stdin.isTTY && stdout.isTTY);
    const options = await resolveProjectOptions(parsedOptions, {
      templates,
      isInteractive,
      promptAdapter,
    });

    options.projectName = validateProjectName(options.projectName);

    if (!templates.some((template) => template.id === options.template)) {
      throw new CliError(
        `Unknown template "${options.template}". Available: ${templates.map((template) => template.id).join(", ")}`,
      );
    }

    if (!listPackageManagers().includes(options.packageManager)) {
      throw new CliError(
        `Unsupported package manager "${options.packageManager}". Available: ${listPackageManagers().join(", ")}`,
      );
    }

    const targetPath = resolveTargetPath(workingDirectory, options.projectName);
    await assertSafeTarget({ workingDirectory, targetPath });
    const directoryState = await getDirectoryState(targetPath);

    if (directoryState === "non-empty" && !options.force) {
      if (!isInteractive) {
        throw new CliError(
          "Target directory is not empty. Pass --force to replace it.",
        );
      }

      const confirmed = await confirmDirectoryOverwrite(targetPath, {
        promptAdapter,
      });
      if (!confirmed) {
        throw new CliError(
          "Operation cancelled. No files were changed.",
          EXIT_CODE.cancelled,
        );
      }
    }

    if (options.install && !commandAvailable(options.packageManager)) {
      throw new CliError(
        `Package manager "${options.packageManager}" is not available. Install it or pass --no-install.`,
      );
    }

    const result = await projectCreator({
      projectName: options.projectName,
      templateId: options.template,
      workingDirectory,
      targetPath,
      templateSource,
    });

    if (result.backupWarning) {
      stderr.write(`${colors.yellow(result.backupWarning)}\n`);
    }

    const postProcessResult = await runPostProcessing({
      targetPath,
      packageManager: options.packageManager,
      install: options.install,
      git: options.git,
      commandRunner,
      stderr,
    });

    if (!postProcessResult.ok) {
      return EXIT_CODE.postProcessFailure;
    }

    printSuccess({
      projectName: options.projectName,
      packageManager: options.packageManager,
      install: options.install,
      stdout,
    });
    return EXIT_CODE.success;
  } catch (error) {
    if (isPromptCancellation(error)) {
      stderr.write("Operation cancelled. No files were changed.\n");
      return EXIT_CODE.cancelled;
    }

    const exitCode =
      error instanceof CliError ? error.exitCode : EXIT_CODE.failure;
    stderr.write(
      `${colors.red(error?.message ?? "Unable to create the project.")}\n`,
    );
    return exitCode;
  }
}

export { EXIT_CODE };
