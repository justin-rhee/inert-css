/**
 * Regression coverage for the bundled acid-test fixture (tests/fixtures/).
 *
 * tests/run-on-real-stylesheet.mjs is a human-readable demonstration and asserts nothing about its
 * own output. An independent review gutted src/corpus.js and the demonstration still printed a
 * plausible "findings: 0 high, 0 low" at exit 0, with the rest of the suite green. This file pins
 * the fixture's headline numbers, and the exact line number README.md quotes as a real finding, so
 * that kind of regression is a red test here rather than a quiet zero in a script nothing checks.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, collectCombos } from "../src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "fixtures");
const CSS_FILE = join(ROOT, "globals.css");
const MARKUP_DIR = join(ROOT, "markup");

function runFixture() {
  const files = execFileSync(
    "find",
    [MARKUP_DIR, "-name", "*.tsx", "-not", "-path", "*/node_modules/*"],
    { encoding: "utf8" },
  ).trim().split("\n").filter(Boolean);
  const { combos, scanned, dynamic } = collectCombos(files);
  const out = analyze({
    css: readFileSync(CSS_FILE, "utf8"),
    combos,
    from: "globals.css",
    corpus: { scanned, dynamic },
  });
  return { combos, scanned, dynamic, out };
}

test("the bundled fixture exists where the README and the acid test both point", () => {
  assert.ok(existsSync(CSS_FILE));
  assert.ok(existsSync(MARKUP_DIR));
});

test("the fixture's corpus matches what the README quotes: 4 combos from 4 files, 1 unreadable", () => {
  const { combos, scanned, dynamic } = runFixture();
  assert.equal(scanned, 4);
  assert.equal(dynamic, 1, "exactly one of the four fixture markup files uses a computed className");
  assert.equal(combos.length, 4);
});

test("the fixture's findings match what the README quotes: 9 high, 1 low, 0 skipped", () => {
  const { out } = runFixture();
  assert.equal(out.skipped.selectors, 0);
  assert.equal(out.skipped.atRules, 0);
  assert.equal(out.confidence.trusted, true, "75% confidence must clear the 60% threshold on this fixture");
  const high = out.findings.filter((f) => f.severity === "high");
  const low = out.findings.filter((f) => f.severity === "low");
  assert.equal(high.length, 9);
  assert.equal(low.length, 1);
});

test("the README's example finding is real: .btn--danger loses color at its actual fixture line", () => {
  const { out } = runFixture();
  const colour = out.findings.find(
    (f) => f.property === "color" && f.loser.selector === ".btn--danger",
  );
  assert.ok(colour, "the .btn--danger vs .btn color finding must be present");
  // This is the exact number README.md's "Each finding" example cites as proof it is real. An
  // earlier draft of that README hand-typed 11 (the border-color line, one above) instead of 12
  // (the color line). Pinning it here means that mismatch fails a test instead of only a review.
  assert.equal(colour.loser.line, 12, "this is the line README.md cites for the loser");
  assert.equal(colour.winner.selector, ".btn");
  assert.equal(colour.winner.line, 28, "this is the line README.md cites for the winner");
});
