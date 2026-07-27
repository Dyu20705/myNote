import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = 4173;
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
};

function isWithinRepository(filePath) {
  const relativePath = path.relative(repositoryRoot, filePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== ".." &&
      !path.isAbsolute(relativePath))
  );
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  let requestPath;
  try {
    requestPath = decodeURIComponent(
      new URL(request.url, `http://${host}:${port}`).pathname,
    );
  } catch {
    response.writeHead(400);
    response.end("Bad Request");
    return;
  }

  if (requestPath === "/") {
    requestPath = "/index.html";
  }

  const filePath = path.resolve(repositoryRoot, `.${requestPath}`);
  if (!isWithinRepository(filePath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : file);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR" || error?.code === "EISDIR") {
      response.writeHead(404);
      response.end("Not Found");
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
