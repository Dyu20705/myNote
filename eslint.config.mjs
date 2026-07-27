import { builtinRules } from "eslint/use-at-your-own-risk";

const readonlyGlobals = (names) => Object.fromEntries(names.map((name) => [name, "readonly"]));
const recommendedRules = Object.fromEntries(
  [...builtinRules]
    .filter(([, rule]) => rule.meta.docs.recommended)
    .map(([name]) => [name, "error"])
);

const browserGlobals = readonlyGlobals([
  "AbortController", "AbortSignal", "addEventListener", "alert", "atob", "Blob", "btoa", "cancelAnimationFrame",
  "clearInterval", "clearTimeout", "confirm", "console", "crypto", "document", "DOMException", "Event",
  "EventTarget", "fetch", "File", "FormData", "Headers", "history", "HTMLElement", "Image", "ImageData", "indexedDB",
  "IntersectionObserver", "KeyboardEvent", "localStorage", "location", "matchMedia", "MutationObserver",
  "navigator", "Node", "NodeList", "Notification", "performance", "queueMicrotask", "ReadableStream",
  "requestAnimationFrame", "screen", "sessionStorage", "setInterval", "setTimeout", "structuredClone", "URL",
  "URLSearchParams", "WebSocket", "window", "Worker",
]);

const workerGlobals = readonlyGlobals([
  "atob", "btoa", "clearInterval", "clearTimeout", "console", "crypto", "fetch", "indexedDB", "location",
  "navigator", "performance", "queueMicrotask", "self", "setInterval", "setTimeout", "structuredClone",
  "TextDecoder", "TextEncoder", "URL", "URLSearchParams", "WebSocket", "WorkerGlobalScope",
]);

const nodeGlobals = readonlyGlobals([
  "AbortController", "AbortSignal", "Buffer", "clearInterval", "clearTimeout", "console", "fetch", "global",
  "process", "queueMicrotask", "setInterval", "setTimeout", "structuredClone", "TextDecoder", "TextEncoder", "URL",
  "URLSearchParams",
]);

export default [
  {
    ignores: ["node_modules/**", "playwright-report/**", "test-results/**"],
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    rules: recommendedRules,
  },
  {
    files: ["app.js", "core/**/*.js", "ui/**/*.js"],
    ignores: ["core/search.worker.js"],
    languageOptions: { globals: browserGlobals },
  },
  {
    files: ["core/search.worker.js"],
    languageOptions: { globals: workerGlobals },
  },
  {
    files: ["tests/**/*", "scripts/**/*", "*.mjs"],
    languageOptions: { globals: nodeGlobals },
  },
  {
    files: ["tests/integration/**/*"],
    languageOptions: { globals: { ...nodeGlobals, indexedDB: "readonly" } },
  },
];
