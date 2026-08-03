#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT_DIR"

required_node_major=22
required_node_min_minor=13
required_node_range=">=22.13 <23"
required_npm_version="11.7.0"

actual_node_version="$(node --version 2>/dev/null || true)"
actual_npm_version="$(npm --version 2>/dev/null || true)"

if [[ -z "$actual_node_version" ]]; then
  echo "Node.js is required. Install a version satisfying $required_node_range before continuing." >&2
  exit 1
fi

actual_node_semver="${actual_node_version#v}"
IFS=. read -r actual_node_major actual_node_minor _ <<< "$actual_node_semver"

if [[ ! "$actual_node_major" =~ ^[0-9]+$ || ! "$actual_node_minor" =~ ^[0-9]+$ ]]; then
  echo "Unable to parse Node.js version $actual_node_version." >&2
  exit 1
fi

if (( actual_node_major != required_node_major || actual_node_minor < required_node_min_minor )); then
  echo "Expected Node.js $required_node_range, found $actual_node_version." >&2
  exit 1
fi

if [[ "$actual_npm_version" != "$required_npm_version" ]]; then
  echo "Expected npm $required_npm_version, found ${actual_npm_version:-missing}." >&2
  echo "Run: npm install --global npm@$required_npm_version" >&2
  exit 1
fi

printf 'Using Node.js %s and npm %s\n' "$actual_node_version" "$actual_npm_version"

npm ci
npx --no-install playwright install --with-deps chromium

npm run test:content
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check

printf '\nDevelopment environment and complete verification are ready.\n'
