import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EXIT_CODE,
  parseCliArguments,
  runCli,
  runPostProcessing,
} from "../src/cli.js";
import { localTemplateSource } from "../src/template-sources/index.js";

/** 创建可收集文本并模拟 TTY 状态的轻量输出流。 */
function createOutputStream(isTTY = false) {
  let output = "";
  return {
    isTTY,
    write(value) {
      output += String(value);
      return true;
    },
    read() {
      return output;
    },
  };
}

test("parseCliArguments preserves unspecified boolean options", () => {
  const output = createOutputStream();
  const options = parseCliArguments(
    ["node", "create-nightboy", "demo", "--template", "vue-ts"],
    { stdout: output, stderr: output },
  );

  assert.equal(options.install, undefined);
  assert.equal(options.git, undefined);
  assert.equal(options.force, false);
});

test("runCli generates a project in fully non-interactive mode", async (context) => {
  const workingDirectory = await mkdtemp(
    path.join(os.tmpdir(), "nightboy-cli-"),
  );
  context.after(() => rm(workingDirectory, { recursive: true, force: true }));
  const stdout = createOutputStream();
  const stderr = createOutputStream();

  const exitCode = await runCli({
    argv: [
      "node",
      "create-nightboy",
      "demo-app",
      "--template",
      "library-ts",
      "--no-install",
      "--no-git",
    ],
    workingDirectory,
    stdin: { isTTY: false },
    stdout,
    stderr,
    templateSource: localTemplateSource,
  });

  assert.equal(exitCode, EXIT_CODE.success);
  assert.match(stdout.read(), /Project created successfully/);
  const packageJson = JSON.parse(
    await readFile(
      path.join(workingDirectory, "demo-app", "package.json"),
      "utf8",
    ),
  );
  assert.equal(packageJson.name, "demo-app");
  assert.equal(stderr.read(), "");
});

test("runCli requires --force for non-empty directories in non-interactive mode", async (context) => {
  const workingDirectory = await mkdtemp(
    path.join(os.tmpdir(), "nightboy-conflict-"),
  );
  context.after(() => rm(workingDirectory, { recursive: true, force: true }));
  const targetPath = path.join(workingDirectory, "demo-app");
  await mkdir(targetPath);
  await writeFile(path.join(targetPath, "keep.txt"), "original");
  const stderr = createOutputStream();

  const exitCode = await runCli({
    argv: [
      "node",
      "create-nightboy",
      "demo-app",
      "--template",
      "library-ts",
      "--no-install",
      "--no-git",
    ],
    workingDirectory,
    stdin: { isTTY: false },
    stdout: createOutputStream(),
    stderr,
    templateSource: localTemplateSource,
  });

  assert.equal(exitCode, EXIT_CODE.failure);
  assert.match(stderr.read(), /Pass --force/);
  assert.equal(
    await readFile(path.join(targetPath, "keep.txt"), "utf8"),
    "original",
  );
});

test("runCli replaces an authorized non-empty directory", async (context) => {
  const workingDirectory = await mkdtemp(
    path.join(os.tmpdir(), "nightboy-force-"),
  );
  context.after(() => rm(workingDirectory, { recursive: true, force: true }));
  const targetPath = path.join(workingDirectory, "demo-app");
  await mkdir(targetPath);
  await writeFile(path.join(targetPath, "old.txt"), "old");

  const exitCode = await runCli({
    argv: [
      "node",
      "create-nightboy",
      "demo-app",
      "--template",
      "library-ts",
      "--no-install",
      "--no-git",
      "--force",
    ],
    workingDirectory,
    stdin: { isTTY: false },
    stdout: createOutputStream(),
    stderr: createOutputStream(),
    templateSource: localTemplateSource,
  });

  assert.equal(exitCode, EXIT_CODE.success);
  await assert.rejects(readFile(path.join(targetPath, "old.txt")), /ENOENT/);
});

test("runPostProcessing skips Git after installation failure", async () => {
  const calls = [];
  const stderr = createOutputStream();
  const result = await runPostProcessing({
    targetPath: "/tmp/generated-project",
    packageManager: "pnpm",
    install: true,
    git: true,
    stderr,
    commandRunner: async (command, args) => {
      calls.push([command, args]);
      return { ok: false, code: 1 };
    },
  });

  assert.deepEqual(result, { ok: false, failedStep: "install" });
  assert.deepEqual(calls, [["pnpm", ["install"]]]);
  assert.match(stderr.read(), /Git initialization was skipped/);
});

test("runCli maps prompt cancellation to exit code 130", async () => {
  const cancellation = new Error("cancelled");
  cancellation.name = "ExitPromptError";
  const exitCode = await runCli({
    argv: ["node", "create-nightboy"],
    workingDirectory: os.tmpdir(),
    stdin: { isTTY: true },
    stdout: createOutputStream(true),
    stderr: createOutputStream(),
    templateSource: localTemplateSource,
    promptAdapter: {
      input: async () => {
        throw cancellation;
      },
    },
  });

  assert.equal(exitCode, EXIT_CODE.cancelled);
});
