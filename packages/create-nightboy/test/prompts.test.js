import assert from "node:assert/strict";
import test from "node:test";

import { resolveProjectOptions } from "../src/prompts.js";

const templates = [{ id: "vue-ts", label: "Vue TypeScript" }];

test("non-interactive options apply deterministic defaults", async () => {
  const options = await resolveProjectOptions(
    { projectName: "demo", template: "vue-ts", force: false },
    { templates, isInteractive: false },
  );

  assert.deepEqual(options, {
    projectName: "demo",
    template: "vue-ts",
    force: false,
    packageManager: "npm",
    install: true,
    git: true,
  });
});

test("non-interactive options require project and template", async () => {
  await assert.rejects(
    resolveProjectOptions(
      { projectName: "demo" },
      { templates, isInteractive: false },
    ),
    /requires \[project-name\] and --template/,
  );
});

test("interactive options preserve explicit values and prompt only for missing values", async () => {
  const prompts = [];
  const promptAdapter = {
    input: async () => {
      prompts.push("input");
      return "unused";
    },
    select: async ({ message }) => {
      prompts.push(message);
      return "pnpm";
    },
    confirm: async ({ message }) => {
      prompts.push(message);
      return false;
    },
  };
  const options = await resolveProjectOptions(
    { projectName: "demo", template: "vue-ts", install: true },
    { templates, isInteractive: true, promptAdapter },
  );

  assert.equal(options.projectName, "demo");
  assert.equal(options.template, "vue-ts");
  assert.equal(options.packageManager, "pnpm");
  assert.equal(options.install, true);
  assert.equal(options.git, false);
  assert.deepEqual(prompts, [
    "Choose a package manager:",
    "Initialize a Git repository?",
  ]);
});
