import {
  access,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  assertParentWritable,
  assertSafeTarget,
  getDirectoryState,
} from "./safety.js";

const TEMPLATE_VARIABLE_PATTERN = /{{([A-Za-z][A-Za-z0-9]*)}}/g;
const ALLOWED_TEMPLATE_VARIABLES = new Set(["projectName"]);

/**
 * 校验模板元数据的完整性和相对路径安全性，避免模板源影响工作目录外文件。
 *
 * @param {object} metadata - 模板源返回的元数据。
 * @returns {object} 通过校验的原元数据。
 */
export function validateTemplateMetadata(metadata) {
  const requiredStringFields = ["id", "label", "category", "language"];

  requiredStringFields.forEach((fieldName) => {
    if (typeof metadata?.[fieldName] !== "string" || !metadata[fieldName]) {
      throw new Error(`Template metadata is missing a valid ${fieldName}.`);
    }
  });

  if (
    !metadata.renameFiles ||
    typeof metadata.renameFiles !== "object" ||
    Array.isArray(metadata.renameFiles)
  ) {
    throw new Error(`Template ${metadata.id} must define renameFiles.`);
  }

  if (
    !Array.isArray(metadata.textFiles) ||
    !Array.isArray(metadata.requiredVariables)
  ) {
    throw new Error(
      `Template ${metadata.id} must define textFiles and requiredVariables arrays.`,
    );
  }

  const declaredPaths = [
    ...Object.keys(metadata.renameFiles),
    ...Object.values(metadata.renameFiles),
    ...metadata.textFiles,
  ];
  declaredPaths.forEach((relativePath) => assertSafeRelativePath(relativePath));

  metadata.requiredVariables.forEach((variableName) => {
    if (!ALLOWED_TEMPLATE_VARIABLES.has(variableName)) {
      throw new Error(
        `Template ${metadata.id} declares unsupported variable: ${variableName}`,
      );
    }
  });

  return metadata;
}

/**
 * 验证模板注册表不存在重复 ID，避免 CLI 展示和生成时选择到不同模板。
 *
 * @param {object[]} templates - 全部模板元数据。
 * @returns {object[]} 通过校验的模板数组。
 */
export function validateTemplateRegistry(templates) {
  if (!Array.isArray(templates) || templates.length === 0) {
    throw new Error("Template source returned no templates.");
  }

  const templateIds = new Set();
  templates.forEach((metadata) => {
    validateTemplateMetadata(metadata);

    if (templateIds.has(metadata.id)) {
      throw new Error(`Duplicate template id: ${metadata.id}`);
    }

    templateIds.add(metadata.id);
  });

  return templates;
}

/**
 * 拒绝绝对路径和父级跳转，确保模板转换始终局限于临时项目目录。
 *
 * @param {string} relativePath - 模板元数据声明的相对路径。
 * @returns {void}
 */
function assertSafeRelativePath(relativePath) {
  if (typeof relativePath !== "string" || !relativePath) {
    throw new Error("Template metadata contains an empty file path.");
  }

  const normalizedPath = path.normalize(relativePath);
  if (
    path.isAbsolute(relativePath) ||
    normalizedPath === ".." ||
    normalizedPath.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`Unsafe template file path: ${relativePath}`);
  }
}

/**
 * 判断文件是否存在，用于兼容不同模板无需声明全部可选配置文件的情况。
 *
 * @param {string} filePath - 待检查文件绝对路径。
 * @returns {Promise<boolean>} 文件是否存在。
 */
async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

/**
 * 按元数据恢复 npm 打包时需要转义的点文件名称。
 *
 * @param {string} projectDirectory - 临时项目目录。
 * @param {Record<string, string>} renameFiles - 源文件名到目标文件名映射。
 * @returns {Promise<void>}
 */
export async function renameTemplateFiles(projectDirectory, renameFiles) {
  for (const [sourceName, targetName] of Object.entries(renameFiles)) {
    const sourcePath = path.join(projectDirectory, sourceName);

    // 元数据允许声明跨模板通用的可选点文件，不存在时安全跳过。
    if (!(await fileExists(sourcePath))) {
      continue;
    }

    await rename(sourcePath, path.join(projectDirectory, targetName));
  }
}

/**
 * 通过 JSON API 更新生成项目包名，避免对结构化文件进行脆弱字符串替换。
 *
 * @param {string} projectDirectory - 临时项目目录。
 * @param {string} projectName - 已校验的 npm 项目名。
 * @returns {Promise<void>}
 */
export async function updatePackageName(projectDirectory, projectName) {
  const packageJsonPath = path.join(projectDirectory, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  packageJson.name = projectName;
  await writeFile(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`,
    "utf8",
  );
}

/**
 * 替换元数据登记的 UTF-8 文本变量，并拒绝未声明或遗漏的占位符。
 *
 * @param {string} projectDirectory - 临时项目目录。
 * @param {object} metadata - 已校验的模板元数据。
 * @param {Record<string, string>} variables - 可用模板变量。
 * @returns {Promise<void>}
 */
export async function replaceTemplateVariables(
  projectDirectory,
  metadata,
  variables,
) {
  metadata.requiredVariables.forEach((variableName) => {
    if (typeof variables[variableName] !== "string") {
      throw new Error(`Missing required template variable: ${variableName}`);
    }
  });

  for (const relativeFilePath of metadata.textFiles) {
    const filePath = path.join(projectDirectory, relativeFilePath);
    const fileContent = await readFile(filePath, "utf8");
    const replacedContent = fileContent.replace(
      TEMPLATE_VARIABLE_PATTERN,
      (placeholder, variableName) => {
        if (
          !ALLOWED_TEMPLATE_VARIABLES.has(variableName) ||
          typeof variables[variableName] !== "string"
        ) {
          throw new Error(
            `Unsupported or missing template variable ${placeholder} in ${relativeFilePath}.`,
          );
        }

        return variables[variableName];
      },
    );

    if (TEMPLATE_VARIABLE_PATTERN.test(replacedContent)) {
      TEMPLATE_VARIABLE_PATTERN.lastIndex = 0;
      throw new Error(`Unresolved template variable in ${relativeFilePath}.`);
    }

    TEMPLATE_VARIABLE_PATTERN.lastIndex = 0;
    await writeFile(filePath, replacedContent, "utf8");
  }
}

/**
 * 将完整临时项目提交到目标目录，并在迁移失败时恢复原有目录。
 *
 * @param {object} options - 事务提交参数。
 * @param {string} options.temporaryPath - 已完整生成的同级临时目录。
 * @param {string} options.targetPath - 最终目标目录。
 * @param {object} [options.fileSystem] - 测试时可注入的文件系统操作。
 * @returns {Promise<{backupWarning: string|null}>} 非阻断的备份清理告警。
 */
export async function commitGeneratedProject({
  temporaryPath,
  targetPath,
  fileSystem = { rename, rm },
}) {
  const backupPath = `${targetPath}.backup-${process.pid}-${Date.now()}`;
  const targetState = await getDirectoryState(targetPath);
  const hasExistingTarget = targetState !== "missing";

  if (hasExistingTarget) {
    await fileSystem.rename(targetPath, backupPath);
  }

  try {
    await fileSystem.rename(temporaryPath, targetPath);
  } catch (migrationError) {
    // 新目录迁移失败时优先恢复用户原目录，恢复失败需要同时保留两个错误上下文。
    if (hasExistingTarget) {
      try {
        await fileSystem.rename(backupPath, targetPath);
      } catch (restoreError) {
        const error = new Error(
          `Failed to move the generated project and restore the original directory. Backup: ${backupPath}`,
        );
        error.cause = { migrationError, restoreError };
        throw error;
      }
    }

    throw migrationError;
  }

  if (!hasExistingTarget) {
    return { backupWarning: null };
  }

  try {
    await fileSystem.rm(backupPath, { recursive: true, force: true });
    return { backupWarning: null };
  } catch {
    return {
      backupWarning: `The project was created, but the old directory backup could not be removed: ${backupPath}`,
    };
  }
}

/**
 * 通过模板源生成完整项目，最终目录只有在全部转换通过后才会发生变化。
 *
 * @param {object} options - 项目生成参数。
 * @param {string} options.projectName - 生成项目名称。
 * @param {string} options.templateId - 模板标识。
 * @param {string} options.workingDirectory - CLI 启动目录。
 * @param {string} options.targetPath - 最终项目目录。
 * @param {object} options.templateSource - 统一模板源实现。
 * @returns {Promise<{targetPath: string, template: object, backupWarning: string|null}>} 生成结果。
 */
export async function createProject({
  projectName,
  templateId,
  workingDirectory,
  targetPath,
  templateSource,
}) {
  await assertSafeTarget({ workingDirectory, targetPath });
  await assertParentWritable(targetPath);

  const templates = validateTemplateRegistry(
    await templateSource.listTemplates(),
  );
  const template = templates.find((metadata) => metadata.id === templateId);

  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }

  const temporaryPath = await mkdtemp(
    path.join(path.dirname(targetPath), `.${path.basename(targetPath)}-tmp-`),
  );

  try {
    await templateSource.materializeTemplate(templateId, temporaryPath);
    await renameTemplateFiles(temporaryPath, template.renameFiles);
    await updatePackageName(temporaryPath, projectName);
    await replaceTemplateVariables(temporaryPath, template, { projectName });

    // 提交前重新校验真实目标，缩小符号链接替换等检查执行竞态窗口。
    await assertSafeTarget({ workingDirectory, targetPath });
    const { backupWarning } = await commitGeneratedProject({
      temporaryPath,
      targetPath,
    });
    return { targetPath, template, backupWarning };
  } catch (error) {
    await rm(temporaryPath, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
