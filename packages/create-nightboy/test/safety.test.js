import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertSafeTarget,
  getDirectoryState,
  isPathInside,
  resolveTargetPath,
  validateProjectName,
} from "../src/safety.js";

test("validateProjectName accepts npm-safe directory names", () => {
  assert.equal(validateProjectName("nightboy-app"), "nightboy-app");
  assert.equal(validateProjectName("  api_v2  "), "api_v2");
});

test("validateProjectName rejects path syntax and uppercase names", () => {
  assert.throws(() => validateProjectName("../outside"), /lowercase letters/);
  assert.throws(() => validateProjectName("/absolute"), /lowercase letters/);
  assert.throws(() => validateProjectName("Nightboy"), /lowercase letters/);
  assert.throws(() => validateProjectName(""), /required/);
});

test("resolveTargetPath always creates a direct child path", () => {
  assert.equal(
    resolveTargetPath("/tmp/workspace", "demo-app"),
    "/tmp/workspace/demo-app",
  );
  assert.equal(isPathInside("/tmp/workspace", "/tmp/workspace/demo-app"), true);
  assert.equal(isPathInside("/tmp/workspace", "/tmp/other"), false);
  assert.equal(isPathInside("/tmp/workspace", "/tmp/workspace"), false);
});

test("assertSafeTarget rejects protected and symbolic-link targets", async (context) => {
  const workingDirectory = await mkdtemp(
    path.join(os.tmpdir(), "nightboy-safety-"),
  );
  context.after(async () => {
    await import("node:fs/promises").then(({ rm }) =>
      rm(workingDirectory, { recursive: true, force: true }),
    );
  });

  await assert.rejects(
    assertSafeTarget({ workingDirectory, targetPath: workingDirectory }),
    /protected directory/,
  );
  await assert.rejects(
    assertSafeTarget({
      workingDirectory,
      targetPath: path.dirname(workingDirectory),
    }),
    /current working directory/,
  );

  const realTarget = path.join(workingDirectory, "real-target");
  const linkedTarget = path.join(workingDirectory, "linked-target");
  await mkdir(realTarget);
  await symlink(realTarget, linkedTarget);
  await assert.rejects(
    assertSafeTarget({ workingDirectory, targetPath: linkedTarget }),
    /symbolic link/,
  );
});

test("getDirectoryState distinguishes missing, empty, and non-empty directories", async (context) => {
  const workingDirectory = await mkdtemp(
    path.join(os.tmpdir(), "nightboy-state-"),
  );
  context.after(async () => {
    await import("node:fs/promises").then(({ rm }) =>
      rm(workingDirectory, { recursive: true, force: true }),
    );
  });

  const emptyDirectory = path.join(workingDirectory, "empty");
  const populatedDirectory = path.join(workingDirectory, "populated");
  await mkdir(emptyDirectory);
  await mkdir(path.join(populatedDirectory, "child"), { recursive: true });

  assert.equal(
    await getDirectoryState(path.join(workingDirectory, "missing")),
    "missing",
  );
  assert.equal(await getDirectoryState(emptyDirectory), "empty");
  assert.equal(await getDirectoryState(populatedDirectory), "non-empty");
});
