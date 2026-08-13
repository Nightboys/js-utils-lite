import { constants } from "node:fs";
import { access, lstat, readdir, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const MAX_PACKAGE_NAME_LENGTH = 214;

/**
 * 校验项目名既能作为 npm 包名，也不能携带路径跳转语义。
 *
 * @param {string} projectName - 用户输入的项目名称。
 * @returns {string} 去除首尾空白后的项目名。
 */
export function validateProjectName(projectName) {
  const normalizedName = String(projectName ?? "").trim();

  if (!normalizedName) {
    throw new Error("Project name is required.");
  }

  if (normalizedName.length > MAX_PACKAGE_NAME_LENGTH) {
    throw new Error(
      `Project name must not exceed ${MAX_PACKAGE_NAME_LENGTH} characters.`,
    );
  }

  if (!PROJECT_NAME_PATTERN.test(normalizedName)) {
    throw new Error(
      "Project name must use lowercase letters, numbers, dots, hyphens, or underscores.",
    );
  }

  return normalizedName;
}

/**
 * 将项目名解析为当前工作目录下的直接子目录，避免接受任意路径输入。
 *
 * @param {string} workingDirectory - CLI 启动时的工作目录。
 * @param {string} projectName - 已校验或待校验的项目名称。
 * @returns {string} 目标项目的绝对路径。
 */
export function resolveTargetPath(workingDirectory, projectName) {
  const safeProjectName = validateProjectName(projectName);
  return path.resolve(workingDirectory, safeProjectName);
}

/**
 * 判断候选路径是否严格位于指定目录内部，排除目录自身和路径逃逸。
 *
 * @param {string} parentPath - 允许写入的父目录。
 * @param {string} candidatePath - 待判断的候选绝对路径。
 * @returns {boolean} 候选路径是否为父目录内部路径。
 */
export function isPathInside(parentPath, candidatePath) {
  const relativePath = path.relative(parentPath, candidatePath);
  return (
    relativePath !== "" &&
    !relativePath.startsWith(`..${path.sep}`) &&
    relativePath !== ".." &&
    !path.isAbsolute(relativePath)
  );
}

/**
 * 获取路径状态，供覆盖确认和生成事务决定是否需要备份原目录。
 *
 * @param {string} targetPath - 目标项目绝对路径。
 * @returns {Promise<'missing'|'empty'|'non-empty'>} 目标目录状态。
 */
export async function getDirectoryState(targetPath) {
  try {
    const targetStat = await lstat(targetPath);

    if (!targetStat.isDirectory()) {
      throw new Error(
        `Target path already exists and is not a directory: ${targetPath}`,
      );
    }

    const entries = await readdir(targetPath);
    return entries.length === 0 ? "empty" : "non-empty";
  } catch (error) {
    if (error?.code === "ENOENT") {
      return "missing";
    }

    throw error;
  }
}

/**
 * 对最终写入路径执行保护校验，拒绝受保护目录、越界路径和符号链接目标。
 *
 * @param {object} options - 安全校验上下文。
 * @param {string} options.workingDirectory - CLI 启动目录。
 * @param {string} options.targetPath - 最终目标绝对路径。
 * @param {string} [options.homeDirectory] - 测试时可注入的用户目录。
 * @returns {Promise<void>}
 */
export async function assertSafeTarget({
  workingDirectory,
  targetPath,
  homeDirectory = os.homedir(),
}) {
  const absoluteWorkingDirectory = path.resolve(workingDirectory);
  const absoluteTargetPath = path.resolve(targetPath);
  const fileSystemRoot = path.parse(absoluteTargetPath).root;
  const lexicalRelativePath = path.relative(
    absoluteWorkingDirectory,
    absoluteTargetPath,
  );

  if (
    [
      fileSystemRoot,
      path.resolve(homeDirectory),
      absoluteWorkingDirectory,
    ].includes(absoluteTargetPath)
  ) {
    throw new Error(
      `Refusing to use protected directory: ${absoluteTargetPath}`,
    );
  }

  // 先用用户输入的词法路径阻断越界，再映射到真实父目录处理 macOS /var 与 /private/var 差异。
  if (
    lexicalRelativePath === "" ||
    lexicalRelativePath === ".." ||
    lexicalRelativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(lexicalRelativePath)
  ) {
    throw new Error(
      `Target directory must be inside the current working directory: ${absoluteWorkingDirectory}`,
    );
  }

  let realWorkingDirectory;
  try {
    realWorkingDirectory = await realpath(absoluteWorkingDirectory);
  } catch {
    throw new Error(
      `Working directory does not exist: ${absoluteWorkingDirectory}`,
    );
  }

  const expectedRealTargetPath = path.resolve(
    realWorkingDirectory,
    lexicalRelativePath,
  );

  try {
    const targetStat = await lstat(absoluteTargetPath);

    // 符号链接即便当前指向工作区内部，也可能在检查后被切换，因此直接拒绝覆盖。
    if (targetStat.isSymbolicLink()) {
      throw new Error(
        `Refusing to overwrite a symbolic link: ${absoluteTargetPath}`,
      );
    }

    const realTargetPath = await realpath(absoluteTargetPath);
    if (
      !isPathInside(realWorkingDirectory, realTargetPath) ||
      realTargetPath !== expectedRealTargetPath
    ) {
      throw new Error(
        `Target directory resolves outside the current working directory: ${realTargetPath}`,
      );
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * 检查目标父目录是否具备写权限，在生成临时目录前给出明确错误。
 *
 * @param {string} targetPath - 目标项目绝对路径。
 * @returns {Promise<void>}
 */
export async function assertParentWritable(targetPath) {
  await access(path.dirname(targetPath), constants.W_OK);
}
