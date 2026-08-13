import { cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { listTemplateMetadata } from "./metadata.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const templatesDirectory = path.resolve(currentDirectory, "../../templates");

/**
 * 返回模板元数据副本，防止调用方意外修改本地模板注册表。
 *
 * @returns {Promise<object[]>} 可供 CLI 展示和生成器转换的模板元数据。
 */
export async function listTemplates() {
  return listTemplateMetadata();
}

/**
 * 将指定本地模板复制到生成器提供的临时目录。
 *
 * @param {string} templateId - 模板唯一标识。
 * @param {string} destination - 已创建的临时目标目录。
 * @returns {Promise<void>}
 */
export async function materializeTemplate(templateId, destination) {
  const template = listTemplateMetadata().find(
    (metadata) => metadata.id === templateId,
  );

  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }

  await cp(path.join(templatesDirectory, templateId), destination, {
    recursive: true,
    force: false,
  });
}
