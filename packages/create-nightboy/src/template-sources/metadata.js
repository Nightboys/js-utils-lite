const COMMON_RENAME_FILES = {
  _gitignore: ".gitignore",
  "_env.example": ".env.example",
  _prettierignore: ".prettierignore",
};

const TEMPLATE_METADATA = [
  {
    id: "vue",
    label: "Vue 3 + Vite + JavaScript",
    category: "frontend",
    language: "javascript",
  },
  {
    id: "vue-ts",
    label: "Vue 3 + Vite + TypeScript",
    category: "frontend",
    language: "typescript",
  },
  {
    id: "react",
    label: "React + Vite + JavaScript",
    category: "frontend",
    language: "javascript",
  },
  {
    id: "react-ts",
    label: "React + Vite + TypeScript",
    category: "frontend",
    language: "typescript",
  },
  {
    id: "node-ts",
    label: "Node.js + Express + TypeScript",
    category: "backend",
    language: "typescript",
  },
  {
    id: "library-ts",
    label: "npm Library + TypeScript",
    category: "library",
    language: "typescript",
  },
].map((metadata) => ({
  ...metadata,
  renameFiles: { ...COMMON_RENAME_FILES },
  textFiles: ["README.md"],
  requiredVariables: ["projectName"],
}));

/**
 * 返回六套模板元数据的深层副本，避免模板源或调用方修改共享注册表。
 *
 * @returns {object[]} 本地和远程模板源共用的模板元数据。
 */
export function listTemplateMetadata() {
  return TEMPLATE_METADATA.map((metadata) => ({
    ...metadata,
    renameFiles: { ...metadata.renameFiles },
    textFiles: [...metadata.textFiles],
    requiredVariables: [...metadata.requiredVariables],
  }));
}
