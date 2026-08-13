import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createProject } from "../src/create-project.js";
import {
  getTemplateSource,
  localTemplateSource,
  remoteTemplateSource,
} from "../src/template-sources/index.js";
import { listTemplateMetadata } from "../src/template-sources/metadata.js";
import {
  cloneGitRepository,
  listTemplates,
  materializeTemplate,
  REMOTE_TEMPLATE_REPOSITORIES,
  validateRemoteTemplate,
} from "../src/template-sources/remote.js";

/**
 * 在临时目录写入满足远程模板最低契约的文件，可按测试场景覆盖 package.json。
 *
 * @param {string} destination - 模板根目录。
 * @param {object} [packageJsonOverrides] - package.json 字段覆盖。
 * @returns {Promise<void>}
 */
async function writeValidRemoteTemplate(
  destination,
  packageJsonOverrides = {},
) {
  await writeFile(
    path.join(destination, "package.json"),
    `${JSON.stringify(
      {
        name: "remote-template",
        version: "0.1.0",
        scripts: { format: "prettier --write ." },
        devDependencies: { prettier: "3.6.2" },
        ...packageJsonOverrides,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(path.join(destination, "README.md"), "# {{projectName}}\n");
  await writeFile(path.join(destination, "_gitignore"), "node_modules\n");
}

/**
 * 构造可观测的伪子进程，测试 Git 参数、退出码和标准错误映射。
 *
 * @returns {EventEmitter & {stderr: EventEmitter}} 伪子进程。
 */
function createChildProcessDouble() {
  const childProcess = new EventEmitter();
  return childProcess;
}

test("remote and local sources share isolated template metadata", async () => {
  const firstMetadata = listTemplateMetadata();
  const secondMetadata = await listTemplates();

  assert.equal(firstMetadata.length, 6);
  assert.deepEqual(
    REMOTE_TEMPLATE_REPOSITORIES.map(({ id }) => id),
    firstMetadata.map(({ id }) => id),
  );

  firstMetadata[0].renameFiles._gitignore = "changed";
  assert.equal(secondMetadata[0].renameFiles._gitignore, ".gitignore");
});

test("template source entry defaults to local and exposes remote for manual switching", () => {
  assert.equal(getTemplateSource(), localTemplateSource);
  assert.notEqual(getTemplateSource(), remoteTemplateSource);
  assert.equal(typeof remoteTemplateSource.materializeTemplate, "function");
});

test("cloneGitRepository uses a shallow clone without shell interpretation", async () => {
  let receivedCommand;
  let receivedArguments;
  let receivedOptions;
  const childProcess = createChildProcessDouble();
  const clonePromise = cloneGitRepository(
    "https://example.com/template.git",
    "/tmp/remote-template",
    {
      spawnImplementation: (command, args, options) => {
        receivedCommand = command;
        receivedArguments = args;
        receivedOptions = options;
        queueMicrotask(() => childProcess.emit("close", 0));
        return childProcess;
      },
    },
  );

  await clonePromise;
  assert.equal(receivedCommand, "git");
  assert.deepEqual(receivedArguments, [
    "clone",
    "--depth",
    "1",
    "--quiet",
    "https://example.com/template.git",
    "/tmp/remote-template",
  ]);
  assert.equal(receivedOptions.shell, false);
  assert.equal(receivedOptions.cwd, "/tmp");
  assert.equal(receivedOptions.stdio, "ignore");
});

test("cloneGitRepository maps missing Git and clone failures to actionable errors", async () => {
  const missingGitProcess = createChildProcessDouble();
  const missingGitPromise = cloneGitRepository("repository", "/tmp/template", {
    spawnImplementation: () => {
      queueMicrotask(() => {
        const error = new Error("spawn git ENOENT");
        error.code = "ENOENT";
        missingGitProcess.emit("error", error);
      });
      return missingGitProcess;
    },
  });
  await assert.rejects(missingGitPromise, /Git is not available/);

  const failedCloneProcess = createChildProcessDouble();
  const failedClonePromise = cloneGitRepository("repository", "/tmp/template", {
    spawnImplementation: () => {
      queueMicrotask(() => failedCloneProcess.emit("close", 128));
      return failedCloneProcess;
    },
  });
  await assert.rejects(failedClonePromise, /Verify the repository URL/);
});

test("cloneGitRepository terminates a stalled clone after its timeout", async () => {
  const stalledCloneProcess = createChildProcessDouble();
  let receivedSignal;
  stalledCloneProcess.kill = (signal) => {
    receivedSignal = signal;
  };

  await assert.rejects(
    cloneGitRepository("repository", "/tmp/template", {
      spawnImplementation: () => stalledCloneProcess,
      timeoutMs: 1,
    }),
    /timed out after 1 seconds/,
  );
  assert.equal(receivedSignal, "SIGTERM");
});

test("materializeTemplate clones into an existing empty directory and removes Git metadata", async (context) => {
  const destination = await mkdtemp(
    path.join(os.tmpdir(), "nightboy-remote-success-"),
  );
  context.after(() => rm(destination, { recursive: true, force: true }));
  let receivedRepositoryUrl;

  await materializeTemplate("vue", destination, {
    cloneImplementation: async (repositoryUrl, receivedDestination) => {
      receivedRepositoryUrl = repositoryUrl;
      assert.equal(receivedDestination, destination);
      await writeValidRemoteTemplate(destination);
      await mkdir(path.join(destination, ".git"));
      await writeFile(
        path.join(destination, ".git", "HEAD"),
        "ref: refs/heads/main\n",
      );
    },
  });

  assert.equal(
    receivedRepositoryUrl,
    REMOTE_TEMPLATE_REPOSITORIES[0].repositoryUrl,
  );
  await assert.rejects(access(path.join(destination, ".git")), /ENOENT/);
  assert.equal((await readdir(destination)).includes("package.json"), true);
});

test("materializeTemplate rejects unknown templates and unsafe destinations", async (context) => {
  const workingDirectory = await mkdtemp(
    path.join(os.tmpdir(), "nightboy-remote-target-"),
  );
  context.after(() => rm(workingDirectory, { recursive: true, force: true }));
  const nonEmptyDestination = path.join(workingDirectory, "non-empty");
  await mkdir(nonEmptyDestination);
  await writeFile(path.join(nonEmptyDestination, "keep.txt"), "keep");
  let cloneCalled = false;

  await assert.rejects(
    materializeTemplate("missing", workingDirectory),
    /Unknown remote template/,
  );
  await assert.rejects(
    materializeTemplate("vue", nonEmptyDestination, {
      cloneImplementation: async () => {
        cloneCalled = true;
      },
    }),
    /must be empty/,
  );
  await assert.rejects(
    materializeTemplate("vue", path.join(workingDirectory, "missing")),
    /must already exist/,
  );
  assert.equal(cloneCalled, false);
});

test("materializeTemplate rejects symbolic links before removing Git metadata", async (context) => {
  const destination = await mkdtemp(
    path.join(os.tmpdir(), "nightboy-remote-link-"),
  );
  context.after(() => rm(destination, { recursive: true, force: true }));

  await assert.rejects(
    materializeTemplate("react", destination, {
      cloneImplementation: async () => {
        await writeValidRemoteTemplate(destination);
        await mkdir(path.join(destination, ".git"));
        await symlink("README.md", path.join(destination, "linked-readme"));
      },
    }),
    /symbolic link/,
  );
  assert.equal((await readdir(destination)).includes(".git"), true);
});

test("validateRemoteTemplate requires valid package and README files", async (context) => {
  const destination = await mkdtemp(
    path.join(os.tmpdir(), "nightboy-remote-required-"),
  );
  context.after(() => rm(destination, { recursive: true, force: true }));
  const [metadata] = listTemplateMetadata();

  await assert.rejects(
    validateRemoteTemplate(destination, metadata),
    /must include package.json and README.md/,
  );
  await writeFile(path.join(destination, "package.json"), "not json");
  await writeFile(path.join(destination, "README.md"), "# Template\n");
  await assert.rejects(
    validateRemoteTemplate(destination, metadata),
    /must contain valid JSON/,
  );
});

test("validateRemoteTemplate rejects every supported ESLint residue", async (context) => {
  const scenarios = [
    {
      name: "configuration file",
      prepare: (destination) =>
        writeFile(
          path.join(destination, "eslint.config.js"),
          "export default []\n",
        ),
      expected: /ESLint files/,
    },
    {
      name: "dependency",
      packageJson: { devDependencies: { eslint: "9.0.0" } },
      expected: /ESLint dependencies/,
    },
    {
      name: "configuration field",
      packageJson: { eslintConfig: { extends: [] } },
      expected: /eslintConfig/,
    },
    {
      name: "script",
      packageJson: { scripts: { lint: "eslint ." } },
      expected: /ESLint scripts/,
    },
  ];
  const [metadata] = listTemplateMetadata();

  for (const scenario of scenarios) {
    await context.test(scenario.name, async (scenarioContext) => {
      const destination = await mkdtemp(
        path.join(os.tmpdir(), "nightboy-remote-eslint-"),
      );
      scenarioContext.after(() =>
        rm(destination, { recursive: true, force: true }),
      );
      await writeValidRemoteTemplate(destination, scenario.packageJson);
      await scenario.prepare?.(destination);

      await assert.rejects(
        validateRemoteTemplate(destination, metadata),
        scenario.expected,
      );
    });
  }
});

test("createProject removes a partially cloned remote directory after failure", async (context) => {
  const workingDirectory = await mkdtemp(
    path.join(os.tmpdir(), "nightboy-remote-cleanup-"),
  );
  context.after(() => rm(workingDirectory, { recursive: true, force: true }));
  const targetPath = path.join(workingDirectory, "remote-app");
  const remoteTemplateSource = {
    listTemplates,
    materializeTemplate: async (_templateId, destination) => {
      await writeFile(path.join(destination, "partial.txt"), "partial");
      throw new Error("simulated remote clone failure");
    },
  };

  await assert.rejects(
    createProject({
      projectName: "remote-app",
      templateId: "vue",
      workingDirectory,
      targetPath,
      templateSource: remoteTemplateSource,
    }),
    /simulated remote clone failure/,
  );

  await assert.rejects(access(targetPath), /ENOENT/);
  assert.deepEqual(
    (await readdir(workingDirectory)).filter((entry) =>
      entry.startsWith(".remote-app-tmp-"),
    ),
    [],
  );
});
