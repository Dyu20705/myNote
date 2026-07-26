import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

function readRepositoryFile(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function assertNoPlaceholders(content, path) {
  assert.doesNotMatch(content, /\b(?:TODO|TBD)\b/, `${path} must not contain TODO or TBD`);
}

test("governance defines mandatory milestone and lifecycle gates", () => {
  const governance = readRepositoryFile("docs/GOVERNANCE.md");

  assert.match(governance, /M0 — Governance[\s\S]*M5 — Advanced Platform/);
  assert.match(governance, /status\/blocked/);
  assert.match(governance, /status\/ready/);
  assert.match(governance, /status\/in-progress/);
  assert.match(governance, /status\/review/);
  assert.match(governance, /all dependencies[^\n]*complete/i);
  assert.match(governance, /Sync, AI, and public Plugin API/);
  assert.match(governance, /M1–M4 release gates/);
  assertNoPlaceholders(governance, "docs/GOVERNANCE.md");
});

test("work-package issue form captures readiness and risk evidence", () => {
  const issueTemplate = readRepositoryFile(".github/ISSUE_TEMPLATE/work-package.yml");

  for (const section of [
    "Goal",
    "Scope",
    "Non-goals",
    "Dependencies",
    "Acceptance criteria",
    "Verification plan",
    "Migration and rollback",
    "Security and privacy",
    "Performance",
    "Risk level",
  ]) {
    assert.match(issueTemplate, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(issueTemplate, /status\/ready/);
  assert.match(issueTemplate, /all dependencies/i);
  assert.match(issueTemplate, /independently reviewable/i);
  assertNoPlaceholders(issueTemplate, ".github/ISSUE_TEMPLATE/work-package.yml");
});

test("pull request template requires exact verification and impact reporting", () => {
  const prTemplate = readRepositoryFile(".github/pull_request_template.md");

  for (const section of [
    "Parent and child issues",
    "Problem statement",
    "Scope",
    "Non-goals",
    "Architecture decisions",
    "File-level summary",
    "Test commands and actual results",
    "Migration and rollback",
    "Security and privacy impact",
    "Performance impact",
    "Screenshots",
    "Known limitations",
    "Follow-up issues",
    "Self-review checklist",
  ]) {
    assert.match(prTemplate, new RegExp(`## ${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
  assert.match(prTemplate, /Exit code/);
  assert.match(prTemplate, /Pass\/fail count/);
  assert.match(prTemplate, /Existing failures/);
  assertNoPlaceholders(prTemplate, ".github/pull_request_template.md");
});
