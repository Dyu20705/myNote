import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

const host = "127.0.0.1";
const port = 4173;
const readyMessage = `Static server ready at http://${host}:${port}`;

function request(path, method = "GET") {
  return new Promise((resolve, reject) => {
    const request = http.request({ host, port, path, method }, (response) => {
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
    request.on("error", reject);
    request.end();
  });
}

function startServer() {
  const child = spawn(process.execPath, ["scripts/serve-static.mjs"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

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
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Static server exited before readiness with code ${code}. Output:\n${output}`));
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

test("static server exposes only the application asset allowlist", async (context) => {
  const server = await startServer();
  context.after(() => stopServer(server));

  const root = await request("/");
  assert.equal(root.statusCode, 200);
  assert.match(root.headers["content-type"], /^text\/html/);
  assert.match(root.body, /<title>myNote<\/title>/);

  const moduleAsset = await request("/core/model.js");
  assert.equal(moduleAsset.statusCode, 200);
  assert.match(moduleAsset.headers["content-type"], /^text\/javascript/);

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

  const traversal = await request("/%2e%2e/package.json");
  assert.equal(traversal.statusCode, 403);

  const missingAllowedAsset = await request("/core/missing.js");
  assert.equal(missingAllowedAsset.statusCode, 404);

  const malformed = await request("/%E0%A4%A");
  assert.equal(malformed.statusCode, 400);

  const unsupportedMethod = await request("/index.html", "POST");
  assert.equal(unsupportedMethod.statusCode, 405);
  assert.equal(unsupportedMethod.headers.allow, "GET, HEAD");
});
