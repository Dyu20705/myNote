import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const FORBIDDEN_PLACEHOLDERS = new RegExp(`\\b(?:${["TO", "DO"].join("")}|${["T", "BD"].join("")})\\b`);

function readRepositoryFile(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function assertNoPlaceholders(content, path) {
  assert.doesNotMatch(content, FORBIDDEN_PLACEHOLDERS, `${path} must not contain unresolved placeholders`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("governance defines internal issue relationships and one active work package", () => {
  const governance = readRepositoryFile("docs/GOVERNANCE.md");

  assert.match(governance, /internal personal-development project/i);
  assert.match(governance, /Unsolicited external issues, pull requests/i);
  assert.match(governance, /Parent:/);
  assert.match(governance, /Depends on:/);
  assert.match(governance, /Blocks:/);
  assert.match(governance, /status\/blocked/);
  assert.match(governance, /status\/ready/);
  assert.match(governance, /status\/in-progress/);
  assert.match(governance, /status\/review/);
  assert.match(governance, /Only one child issue may be `status\/in-progress`/);
  assert.match(governance, /closed and may be locked, not deleted/i);
  assert.match(governance, /M0 — Governance[\s\S]*M5 — Advanced Platform/);
  assertNoPlaceholders(governance, "docs/GOVERNANCE.md");
});

test("issue chooser does not expose an external issue form or blank issue", () => {
  const config = readRepositoryFile(".github/ISSUE_TEMPLATE/config.yml");

  assert.match(config, /^blank_issues_enabled: false$/m);
  assert.match(config, /Internal development repository/);
  assert.match(config, /Unsolicited external issues/);
  assertNoPlaceholders(config, ".github/ISSUE_TEMPLATE/config.yml");
});

test("pull request template is internal and requires relationship and verification evidence", () => {
  const template = readRepositoryFile(".github/pull_request_template.md");

  for (const section of [
    "Issue relationships",
    "Problem and scope",
    "Architecture and file summary",
    "Verification evidence",
    "Migration, recovery, and rollback",
    "Impact review",
    "Screenshots",
    "Completion checklist",
  ]) {
    assert.match(template, new RegExp(`## ${escapeRegExp(section)}`));
  }

  assert.match(template, /Internal development only/);
  assert.match(template, /Parent issue:/);
  assert.match(template, /Depends on:/);
  assert.match(template, /Blocks:/);
  assert.match(template, /npm run test:content/);
  assert.match(template, /Exit code/);
  assert.match(template, /Pass\/fail count/);
  assertNoPlaceholders(template, ".github/pull_request_template.md");
});
