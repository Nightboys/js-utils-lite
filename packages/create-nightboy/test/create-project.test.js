import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  commitGeneratedProject,
  createProject,
  validateTemplateMetadata,
  validateTemplateRegistry,
} from "../src/create-project.js";
import { localTemplateSource } from "../src/template-sources/index.js";

/**
 * 递归收集生成项目内的相对文件路径，用于校验模板不会携带禁用的工具配置。
 *
 * @param {string} directory - 当前遍历目录。
 * @param {string} [baseDirectory=directory] - 生成项目根目录。
 * @returns {Promise<string[]>} 相对于生成项目根目录的文件路径列表。
 */
async function listRelativeFiles(directory, baseDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listRelativeFiles(entryPath, baseDirectory);
      }

      return [path.relative(baseDirectory, entryPath)];
    }),
  );

  return nestedFiles.flat();
}

test("template metadata rejects duplicate IDs and unsafe paths", () => {
  const validTemplate = {
    id: "demo",
    label: "Demo",
    category: "test",
    language: "javascript",
    renameFiles: { _gitignore: ".gitignore" },
    textFiles: ["README.md"],
    requiredVariables: ["projectName"],
  };

  assert.equal(validateTemplateMetadata(validTemplate), validTemplate);
  assert.throws(
    () => validateTemplateRegistry([validTemplate, { ...validTemplate }]),
    /Duplicate template id/,
  );
  assert.throws(
    () =>
      validateTemplateMetadata({
        ...validTemplate,
        textFiles: ["../README.md"],
      }),
    /Unsafe template file path/,
  );
});

test("all bundled templates generate with renamed dotfiles and replaced variables", async (context) => {
  const workingDirectory = await mkdtemp(
    path.join(os.tmpdir(), "nightboy-templates-"),
  );
  context.after(() => rm(workingDirectory, { recursive: true, force: true }));
  const templates = await localTemplateSource.listTemplates();

  assert.equal(templates.length, 6);

  for (const template of templates) {
    const projectName = `generated-${template.id}`;
    const targetPath = path.join(workingDirectory, projectName);
    await createProject({
      projectName,
      templateId: template.id,
      workingDirectory,
      targetPath,
      templateSource: localTemplateSource,
    });

    const packageJson = JSON.parse(
      await readFile(path.join(targetPath, "package.json"), "utf8"),
    );
    const readme = await readFile(path.join(targetPath, "README.md"), "utf8");
    const entries = await readdir(targetPath);
    const templateFiles = await listRelativeFiles(targetPath);
    const packageDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    const packageScripts = packageJson.scripts ?? {};

    assert.equal(packageJson.name, projectName);
    assert.match(readme, new RegExp(`# ${projectName}`));
    assert.doesNotMatch(readme, /{{[A-Za-z]/);
    assert.equal(entries.includes(".gitignore"), true);
    assert.equal(entries.includes("_gitignore"), false);
    assert.equal(
      templateFiles.some((file) => /eslint/i.test(file)),
      false,
      `${template.id} must not include ESLint files`,
    );
    assert.equal(
      Object.keys(packageDependencies).some((name) => /eslint/i.test(name)),
      false,
      `${template.id} must not include ESLint dependencies`,
    );
    assert.equal(
      Object.entries(packageScripts).some(
        ([name, command]) =>
          /(^|:)lint($|:)/i.test(name) || /eslint/i.test(command),
      ),
      false,
      `${template.id} must not include ESLint scripts`,
    );
  }
});

test("commitGeneratedProject restores the original directory after migration failure", async (context) => {
  const workingDirectory = await mkdtemp(
    path.join(os.tmpdir(), "nightboy-rollback-"),
  );
  context.after(() => rm(workingDirectory, { recursive: true, force: true }));
  const targetPath = path.join(workingDirectory, "target");
  const temporaryPath = path.join(workingDirectory, "temporary");
  await mkdir(targetPath);
  await mkdir(temporaryPath);
  await writeFile(path.join(targetPath, "original.txt"), "keep me");
  let renameCalls = 0;
  const { rename } = await import("node:fs/promises");

  await assert.rejects(
    commitGeneratedProject({
      temporaryPath,
      targetPath,
      fileSystem: {
        rename: async (...args) => {
          renameCalls += 1;
          if (renameCalls === 2) {
            throw new Error("simulated migration failure");
          }
          return rename(...args);
        },
        rm,
      },
    }),
    /simulated migration failure/,
  );

  assert.equal(
    await readFile(path.join(targetPath, "original.txt"), "utf8"),
    "keep me",
  );
});
