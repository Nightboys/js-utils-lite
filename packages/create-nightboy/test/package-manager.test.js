import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import {
  getInstallCommand,
  getRunScriptCommand,
  isCommandAvailable,
  listPackageManagers,
  runExternalCommand,
} from "../src/package-manager.js";

test("package manager commands use stable argument arrays", () => {
  assert.deepEqual(listPackageManagers(), ["npm", "pnpm", "yarn"]);
  assert.deepEqual(getInstallCommand("pnpm"), {
    command: "pnpm",
    args: ["install"],
  });
  assert.deepEqual(getRunScriptCommand("npm", "dev"), {
    command: "npm",
    args: ["run", "dev"],
    display: "npm run dev",
  });
  assert.equal(getRunScriptCommand("yarn", "dev").display, "yarn dev");
});

test("isCommandAvailable reports spawn success without shell usage", () => {
  let receivedOptions;
  const available = isCommandAvailable("pnpm", (_command, _args, options) => {
    receivedOptions = options;
    return { status: 0 };
  });

  assert.equal(available, true);
  assert.equal(receivedOptions.shell, false);
});

test("runExternalCommand returns a structured failure result", async () => {
  const resultPromise = runExternalCommand("npm", ["install"], {
    cwd: "/tmp/project",
    spawnImplementation: (_command, _args, options) => {
      assert.equal(options.shell, false);
      const childProcess = new EventEmitter();
      queueMicrotask(() => childProcess.emit("close", 7));
      return childProcess;
    },
  });

  assert.deepEqual(await resultPromise, { ok: false, code: 7 });
});
