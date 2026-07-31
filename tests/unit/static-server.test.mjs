import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = 4173;
const maximumAssetBytes = 1024 * 1024;
const readyMessage = `Static server ready at http://${host}:${port}`;
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function request(requestPath, method = "GET") {
  return new Promise((resolve, reject) => {
    const clientRequest = http.request({ host, port, path: requestPath, method }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          body: Buffer.concat(chunks).toString("utf8"),
          headers: response.headers,
          statusCode: response.statusCode,
        });
      });
    });
    clientRequest.on("error", reject);
    clientRequest.end();
  });
}

function spawnServer() {
  return spawn(process.execPath, ["scripts/serve-static.mjs"], {
    cwd: repositoryRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function startServer() {
  const child = spawnServer();

  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Static server did not become ready. Output:\n${output}`));
    }, 5000);

    const onData = (chunk) => {
      output += chunk.toString();
      if (output.includes(readyMessage)) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        resolve(child);
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Static server exited before readiness with code ${code}. Output:\n${output}`));
    });
  });
}

function waitForServerFailure(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Conflicting static server did not fail promptly. Output:\n${output}`));
    }, 5000);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, output, signal });
    });
  });
}

function stopServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Static server did not exit after SIGTERM."));
    }, 5000);

    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0 || signal === "SIGTERM") {
        resolve();
        return;
      }
      reject(new Error(`Static server exited unexpectedly with code ${code} and signal ${signal}.`));
    });
    child.kill("SIGTERM");
  });
}

async function createSecurityFixtures() {
  const suffix = `${process.pid}-${Date.now()}`;
  const oversizedPath = path.join(repositoryRoot, "core", `oversized-${suffix}.js`);
  const symlinkPath = path.join(repositoryRoot, "core", `escape-${suffix}.js`);
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "mynote-static-server-"));
  const outsidePath = path.join(temporaryDirectory, "outside.js");

  await writeFile(oversizedPath, Buffer.alloc(maximumAssetBytes + 1, 0x61));
  await writeFile(outsidePath, "export const secret = true;\n");

  let symlinkCreated = true;
  try {
    await symlink(outsidePath, symlinkPath, "file");
  } catch (error) {
    if (error?.code === "EPERM" || error?.code === "EACCES") {
      symlinkCreated = false;
    } else {
      throw error;
    }
  }

  return {
    oversizedRequestPath: `/core/${path.basename(oversizedPath)}`,
    symlinkCreated,
    symlinkRequestPath: `/core/${path.basename(symlinkPath)}`,
    async cleanup() {
      await Promise.all([
        rm(oversizedPath, { force: true }),
        rm(symlinkPath, { force: true }),
        rm(temporaryDirectory, { force: true, recursive: true }),
      ]);
    },
  };
}

test("static server enforces its application-only security contract", async () => {
  const fixtures = await createSecurityFixtures();
  let server;
  try {
    server = await startServer();

    const root = await request("/");
    assert.equal(root.statusCode, 200);
    assert.match(root.headers["content-type"], /^text\/html/);
    assert.equal(root.headers["x-content-type-options"], "nosniff");
    assert.match(root.body, /<title>myNote<\/title>/);

    const moduleAsset = await request("/core/model.js");
    assert.equal(moduleAsset.statusCode, 200);
    assert.match(moduleAsset.headers["content-type"], /^text\/javascript/);

    const japaneseModule = await request("/japaneseApp.js");
    assert.equal(japaneseModule.statusCode, 200);
    assert.match(japaneseModule.headers["content-type"], /^text\/javascript/);

    const japaneseStyles = await request("/japanese.css");
    assert.equal(japaneseStyles.statusCode, 200);
    assert.match(japaneseStyles.headers["content-type"], /^text\/css/);

    const head = await request("/styles.css", "HEAD");
    assert.equal(head.statusCode, 200);
    assert.equal(head.body, "");

    for (const sensitivePath of [
      "/package.json",
      "/package-lock.json",
      "/.git/config",
      "/tests/governance.contract.test.mjs",
      "/scripts/serve-static.mjs",
    ]) {
      const response = await request(sensitivePath);
      assert.equal(response.statusCode, 403, `${sensitivePath} must be forbidden`);
    }

    for (const traversalPath of [
      "/%2e%2e/package.json",
      "/core/%2e%2e/package.json",
      "/core/%5c..%5cpackage.json",
    ]) {
      const response = await request(traversalPath);
      assert.equal(response.statusCode, 403, `${traversalPath} must be forbidden`);
    }

    if (fixtures.symlinkCreated) {
      const symlinkEscape = await request(fixtures.symlinkRequestPath);
      assert.equal(symlinkEscape.statusCode, 403);
    }

    const oversizedAsset = await request(fixtures.oversizedRequestPath);
    assert.equal(oversizedAsset.statusCode, 413);

    const missingAllowedAsset = await request("/core/missing.js");
    assert.equal(missingAllowedAsset.statusCode, 404);

    const malformed = await request("/%E0%A4%A");
    assert.equal(malformed.statusCode, 400);

    const unsupportedMethod = await request("/index.html", "POST");
    assert.equal(unsupportedMethod.statusCode, 405);
    assert.equal(unsupportedMethod.headers.allow, "GET, HEAD");

    const conflict = await waitForServerFailure(spawnServer());
    assert.equal(conflict.code, 1);
    assert.equal(conflict.signal, null);
    assert.match(conflict.output, /address already in use/i);
  } finally {
    if (server) {
      await stopServer(server);
    }
    await fixtures.cleanup();
  }
});
