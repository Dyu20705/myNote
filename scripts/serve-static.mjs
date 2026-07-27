import { createServer } from "node:http";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = 4173;
const maximumAssetBytes = 1024 * 1024;
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const canonicalRepositoryRoot = await realpath(repositoryRoot);
const rootAssets = new Set(["/app.js", "/index.html", "/styles.css"]);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function isWithinRepository(filePath, root = repositoryRoot) {
  const relativePath = path.relative(root, filePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== ".." &&
      !path.isAbsolute(relativePath))
  );
}

function decodeRequestPath(requestUrl) {
  const pathEnd = requestUrl.search(/[?#]/);
  const rawPath = pathEnd === -1 ? requestUrl : requestUrl.slice(0, pathEnd);
  return decodeURIComponent(rawPath);
}

function isAllowedAsset(requestPath) {
  if (rootAssets.has(requestPath)) {
    return true;
  }

  if (requestPath.includes("\\") || requestPath.includes("\0")) {
    return false;
  }

  const segments = requestPath.split("/").slice(1);
  if (segments.length < 2 || (segments[0] !== "core" && segments[0] !== "ui")) {
    return false;
  }

  return segments.every((segment, index) => {
    if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(segment)) {
      return false;
    }
    return index < segments.length - 1 || segment.endsWith(".js");
  });
}

async function readBoundedAsset(filePath) {
  const canonicalFilePath = await realpath(filePath);
  if (!isWithinRepository(canonicalFilePath, canonicalRepositoryRoot)) {
    const error = new Error("Resolved asset is outside the repository.");
    error.code = "EACCES";
    throw error;
  }

  const handle = await open(canonicalFilePath, "r");
  try {
    const fileStats = await handle.stat();
    if (!fileStats.isFile()) {
      const error = new Error("Asset is not a regular file.");
      error.code = "EISDIR";
      throw error;
    }
    if (fileStats.size > maximumAssetBytes) {
      const error = new Error("Asset exceeds the server size limit.");
      error.code = "EFBIG";
      throw error;
    }

    const buffer = Buffer.allocUnsafe(maximumAssetBytes + 1);
    let totalBytes = 0;
    while (totalBytes < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        totalBytes,
        buffer.length - totalBytes,
        totalBytes,
      );
      if (bytesRead === 0) {
        break;
      }
      totalBytes += bytesRead;
    }
    if (totalBytes > maximumAssetBytes) {
      const error = new Error("Asset exceeds the server size limit.");
      error.code = "EFBIG";
      throw error;
    }
    return buffer.subarray(0, totalBytes);
  } finally {
    await handle.close();
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  let requestPath;
  try {
    requestPath = decodeRequestPath(request.url ?? "/");
  } catch {
    response.writeHead(400);
    response.end("Bad Request");
    return;
  }

  if (requestPath === "/") {
    requestPath = "/index.html";
  }

  if (!isAllowedAsset(requestPath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const filePath = path.resolve(repositoryRoot, `.${requestPath}`);
  if (!isWithinRepository(filePath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readBoundedAsset(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": file.length,
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : file);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR" || error?.code === "EISDIR") {
      response.writeHead(404);
      response.end("Not Found");
      return;
    }

    if (error?.code === "EACCES") {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    if (error?.code === "EFBIG") {
      response.writeHead(413);
      response.end("Content Too Large");
      return;
    }

    response.writeHead(500);
    response.end("Internal Server Error");
  }
});

server.once("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Static server could not listen on http://${host}:${port}: address already in use.`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Static server ready at http://${host}:${port}`);
});

function stopServer() {
  server.close(() => process.exit(0));
}

process.once("SIGINT", stopServer);
process.once("SIGTERM", stopServer);
