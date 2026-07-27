import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const playwrightCli = fileURLToPath(import.meta.resolve("@playwright/test/cli"));

const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [playwrightCli, "test"], {
    cwd: repositoryRoot,
    stdio: "inherit",
    windowsHide: true,
  });
  child.once("error", reject);
  child.once("exit", (code) => resolve(code ?? 1));
});

if (exitCode === 0) {
  await Promise.all([
    rm(path.join(repositoryRoot, "playwright-report"), { force: true, recursive: true }),
    rm(path.join(repositoryRoot, "test-results"), { force: true, recursive: true }),
  ]);
}

process.exitCode = exitCode;
