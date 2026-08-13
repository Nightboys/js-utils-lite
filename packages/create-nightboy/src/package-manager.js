import { spawn, spawnSync } from "node:child_process";

const PACKAGE_MANAGER_CONFIG = {
  npm: {
    installArgs: ["install"],
    runArgs: (scriptName) => ["run", scriptName],
  },
  pnpm: {
    installArgs: ["install"],
    runArgs: (scriptName) => [scriptName],
  },
  yarn: {
    installArgs: ["install"],
    runArgs: (scriptName) => [scriptName],
  },
};

/**
 * 返回所有受支持的包管理器名称，供参数校验和交互选择复用。
 *
 * @returns {string[]} 包管理器名称列表。
 */
export function listPackageManagers() {
  return Object.keys(PACKAGE_MANAGER_CONFIG);
}

/**
 * 获取包管理器配置，未知名称会立即报错，避免执行任意程序。
 *
 * @param {string} packageManager - 包管理器名称。
 * @returns {object} 安装和脚本执行配置。
 */
export function getPackageManagerConfig(packageManager) {
  const config = PACKAGE_MANAGER_CONFIG[packageManager];

  if (!config) {
    throw new Error(`Unsupported package manager: ${packageManager}`);
  }

  return config;
}

/**
 * 检测允许列表中的外部命令是否可用，不通过 shell 解释用户输入。
 *
 * @param {string} command - 待检测的程序名。
 * @param {Function} [spawnSyncImplementation] - 测试时注入的同步执行器。
 * @returns {boolean} 命令是否可成功启动。
 */
export function isCommandAvailable(
  command,
  spawnSyncImplementation = spawnSync,
) {
  const result = spawnSyncImplementation(command, ["--version"], {
    stdio: "ignore",
    shell: false,
  });

  return !result.error && result.status === 0;
}

/**
 * 使用参数数组执行外部命令，并将失败转为稳定的结果对象供 CLI 决策。
 *
 * @param {string} command - 受信任的程序名。
 * @param {string[]} args - 传给程序的独立参数。
 * @param {object} options - 子进程运行选项。
 * @param {string} options.cwd - 子进程工作目录。
 * @param {Function} [options.spawnImplementation] - 测试时注入的异步执行器。
 * @returns {Promise<{ok: boolean, code: number|null, error?: Error}>} 执行结果。
 */
export function runExternalCommand(
  command,
  args,
  { cwd, spawnImplementation = spawn } = {},
) {
  return new Promise((resolve) => {
    const childProcess = spawnImplementation(command, args, {
      cwd,
      stdio: "inherit",
      shell: false,
    });

    childProcess.once("error", (error) => {
      resolve({ ok: false, code: null, error });
    });

    childProcess.once("close", (code) => {
      resolve({ ok: code === 0, code });
    });
  });
}

/**
 * 构造依赖安装命令，调用方只需负责执行和错误展示。
 *
 * @param {string} packageManager - npm、pnpm 或 yarn。
 * @returns {{command: string, args: string[]}} 安装命令描述。
 */
export function getInstallCommand(packageManager) {
  const config = getPackageManagerConfig(packageManager);
  return { command: packageManager, args: [...config.installArgs] };
}

/**
 * 构造运行脚本的命令及可复制文本，用于生成完成后的下一步提示。
 *
 * @param {string} packageManager - npm、pnpm 或 yarn。
 * @param {string} scriptName - package.json 中的脚本名。
 * @returns {{command: string, args: string[], display: string}} 脚本命令描述。
 */
export function getRunScriptCommand(packageManager, scriptName) {
  const config = getPackageManagerConfig(packageManager);
  const args = config.runArgs(scriptName);
  return {
    command: packageManager,
    args,
    display: [packageManager, ...args].join(" "),
  };
}
