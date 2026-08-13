import { spawn } from "node:child_process";
import { lstat, readFile, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";

import { listTemplateMetadata } from "./metadata.js";

const REMOTE_CLONE_TIMEOUT_MS = 120_000;

/**
 * 六套模板各自对应一个独立 Git 仓库。正式启用远程源时只需替换 repositoryUrl。
 */
export const REMOTE_TEMPLATE_REPOSITORIES = [
  {
    id: "vue",
    repositoryUrl: "https://github.com/nightboy-team/nightboy-template-vue.git",
  },
  {
    id: "vue-ts",
    repositoryUrl:
      "https://github.com/nightboy-team/nightboy-template-vue-ts.git",
  },
  {
    id: "react",
    repositoryUrl:
      "https://github.com/nightboy-team/nightboy-template-react.git",
  },
  {
    id: "react-ts",
    repositoryUrl:
      "https://github.com/nightboy-team/nightboy-template-react-ts.git",
  },
  {
    id: "node-ts",
    repositoryUrl:
      "https://github.com/nightboy-team/nightboy-template-node-ts.git",
  },
  {
    id: "library-ts",
    repositoryUrl:
      "https://github.com/nightboy-team/nightboy-template-library-ts.git",
  },
];

/**
 * 执行默认分支浅克隆，不使用 shell，避免仓库地址被解释为命令。
 *
 * @param {string} repositoryUrl - 待克隆的 Git 仓库地址。
 * @param {string} destination - 调用方预先创建的空目录。
 * @param {object} [dependencies] - 测试时可注入的子进程实现。
 * @param {number} [dependencies.timeoutMs] - 克隆超时毫秒数。
 * @returns {Promise<void>}
 */
export function cloneGitRepository(
  repositoryUrl,
  destination,
  { spawnImplementation = spawn, timeoutMs = REMOTE_CLONE_TIMEOUT_MS } = {},
) {
  return new Promise((resolve, reject) => {
    let childProcess;

    try {
      childProcess = spawnImplementation(
        "git",
        ["clone", "--depth", "1", "--quiet", repositoryUrl, destination],
        {
          cwd: path.dirname(destination),
          // Git 原始错误可能回显含凭据的地址，统一由下方安全错误文案承载。
          stdio: "ignore",
          shell: false,
        },
      );
    } catch (error) {
      reject(
        new Error(`Failed to start Git: ${error?.message ?? "unknown error"}`),
      );
      return;
    }

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      childProcess.kill?.("SIGTERM");
      reject(
        new Error(
          `Git clone timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`,
        ),
      );
    }, timeoutMs);

    childProcess.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);

      if (error?.code === "ENOENT") {
        reject(new Error("Git is not available. Install Git and try again."));
        return;
      }

      reject(
        new Error(`Failed to start Git: ${error?.message ?? "unknown error"}`),
      );
    });

    childProcess.once("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);

      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Git clone failed with exit code ${code}. Verify the repository URL and access permissions.`,
        ),
      );
    });
  });
}

/**
 * 确认物化目标由调用方创建且为空，避免克隆覆盖已有内容。
 *
 * @param {string} destination - 物化目标目录。
 * @returns {Promise<void>}
 */
async function assertEmptyDestination(destination) {
  let destinationStats;

  try {
    destinationStats = await lstat(destination);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("Remote template destination must already exist.");
    }
    throw error;
  }

  if (!destinationStats.isDirectory() || destinationStats.isSymbolicLink()) {
    throw new Error("Remote template destination must be a real directory.");
  }

  if ((await readdir(destination)).length > 0) {
    throw new Error("Remote template destination must be empty.");
  }
}

/**
 * 递归检查远程仓库内容，拒绝所有可能把后续读写引向目录外的符号链接。
 *
 * @param {string} directory - 当前扫描目录。
 * @returns {Promise<string[]>} 仓库内全部普通文件的绝对路径。
 */
async function collectRegularFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const collectedFiles = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      throw new Error(
        `Remote template contains a symbolic link: ${entry.name}`,
      );
    }

    if (entry.isDirectory()) {
      collectedFiles.push(...(await collectRegularFiles(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      collectedFiles.push(entryPath);
    }
  }

  return collectedFiles;
}

/**
 * 在处理 Git 元数据前递归拒绝符号链接，避免清理或转换阶段跟随外部路径。
 *
 * @param {string} directory - 当前扫描目录。
 * @returns {Promise<void>}
 */
async function assertNoSymbolicLinks(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Remote template contains a symbolic link: ${entry.name}`,
      );
    }

    if (entry.isDirectory()) {
      await assertNoSymbolicLinks(path.join(directory, entry.name));
    }
  }
}

/**
 * 校验元数据声明路径解析后仍位于模板根目录，防止转换阶段越界读写。
 *
 * @param {string} destination - 模板根目录。
 * @param {object} metadata - 当前模板元数据。
 * @returns {Promise<void>}
 */
async function assertMetadataPathsWithinDestination(destination, metadata) {
  const destinationRealPath = await realpath(destination);
  const declaredPaths = [
    ...Object.keys(metadata.renameFiles),
    ...Object.values(metadata.renameFiles),
    ...metadata.textFiles,
  ];

  for (const relativePath of declaredPaths) {
    const candidatePath = path.resolve(destination, relativePath);
    const relativeCandidate = path.relative(destination, candidatePath);

    if (
      relativeCandidate === ".." ||
      relativeCandidate.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeCandidate)
    ) {
      throw new Error(
        `Remote template metadata escapes its directory: ${relativePath}`,
      );
    }

    let existingPath = candidatePath;
    while (existingPath !== destination) {
      try {
        await lstat(existingPath);
        break;
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
        existingPath = path.dirname(existingPath);
      }
    }

    const existingRealPath = await realpath(existingPath);
    const relativeRealPath = path.relative(
      destinationRealPath,
      existingRealPath,
    );
    if (
      relativeRealPath === ".." ||
      relativeRealPath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeRealPath)
    ) {
      throw new Error(
        `Remote template path resolves outside its directory: ${relativePath}`,
      );
    }
  }
}

/**
 * 校验远程模板不会重新引入项目明确禁用的 ESLint 文件、依赖或脚本。
 *
 * @param {string[]} templateFiles - 模板内全部普通文件路径。
 * @param {object} packageJson - 已解析的 package.json。
 * @returns {void}
 */
function assertNoEslint(templateFiles, packageJson) {
  if (
    templateFiles.some((filePath) => /eslint/i.test(path.basename(filePath)))
  ) {
    throw new Error("Remote template must not include ESLint files.");
  }

  const packageDependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };
  if (Object.keys(packageDependencies).some((name) => /eslint/i.test(name))) {
    throw new Error("Remote template must not include ESLint dependencies.");
  }

  if (
    Object.keys(packageJson).some((fieldName) =>
      /^eslintConfig$/i.test(fieldName),
    )
  ) {
    throw new Error("Remote template must not include eslintConfig.");
  }

  const packageScripts = packageJson.scripts ?? {};
  if (
    Object.entries(packageScripts).some(
      ([name, command]) => /lint/i.test(name) || /lint/i.test(String(command)),
    )
  ) {
    throw new Error("Remote template must not include ESLint scripts.");
  }
}

/**
 * 在生成器修改模板前校验远程仓库结构和安全边界。
 *
 * @param {string} destination - 已克隆的远程模板目录。
 * @param {object} metadata - 当前模板元数据。
 * @returns {Promise<void>}
 */
export async function validateRemoteTemplate(destination, metadata) {
  const templateFiles = await collectRegularFiles(destination);
  await assertMetadataPathsWithinDestination(destination, metadata);

  const packageJsonPath = path.join(destination, "package.json");
  const readmePath = path.join(destination, "README.md");
  const packageJsonStats = await lstat(packageJsonPath).catch(() => null);
  const readmeStats = await lstat(readmePath).catch(() => null);

  if (!packageJsonStats?.isFile() || !readmeStats?.isFile()) {
    throw new Error(
      "Remote template must include package.json and README.md files.",
    );
  }

  let packageJson;
  try {
    packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  } catch {
    throw new Error("Remote template package.json must contain valid JSON.");
  }

  if (
    !packageJson ||
    typeof packageJson !== "object" ||
    Array.isArray(packageJson)
  ) {
    throw new Error("Remote template package.json must contain a JSON object.");
  }

  assertNoEslint(templateFiles, packageJson);
}

/**
 * 返回远程源支持的模板元数据，接口与本地模板源保持一致。
 *
 * @returns {Promise<object[]>} 六套远程模板元数据。
 */
export async function listTemplates() {
  return listTemplateMetadata();
}

/**
 * 将指定独立仓库浅克隆到生成器的空临时目录，并完成远程内容校验。
 *
 * @param {string} templateId - 模板唯一标识。
 * @param {string} destination - 调用方预先创建的空目录。
 * @param {object} [dependencies] - 测试时可注入的克隆实现。
 * @returns {Promise<void>}
 */
export async function materializeTemplate(
  templateId,
  destination,
  { cloneImplementation = cloneGitRepository } = {},
) {
  const repository = REMOTE_TEMPLATE_REPOSITORIES.find(
    (candidate) => candidate.id === templateId,
  );
  const metadata = listTemplateMetadata().find(
    (candidate) => candidate.id === templateId,
  );

  if (!repository || !metadata) {
    throw new Error(`Unknown remote template: ${templateId}`);
  }

  await assertEmptyDestination(destination);
  await cloneImplementation(repository.repositoryUrl, destination);
  await assertNoSymbolicLinks(destination);
  await rm(path.join(destination, ".git"), { recursive: true, force: true });
  await validateRemoteTemplate(destination, metadata);
}
