#!/usr/bin/env node

import { runCli } from "../src/cli.js";

// CLI 入口只负责传递真实进程上下文，具体流程保留在可测试的 runCli 中。
process.exitCode = await runCli();
