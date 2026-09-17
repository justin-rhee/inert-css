/**
 * Unit coverage for src/corpus.js.
 *
 * Added after an independent review gutted collectCombos entirely (made it return no combos and
 * zero dynamic files) and the rest of the suite still passed 13/13, because nothing here imported
 * it directly. These tests exist so that removing this file's logic is a red test, not a quiet
 * zero everywhere downstream.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectCombos } from "../src/corpus.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FX = (name) => join(HERE, "fixtures", "corpus", name);

test("a double-quoted static className is read as a combo", () => {
  const { combos } = collectCombos([FX("static-double.tsx")]);
  assert.deepEqual(combos, [["alpha", "beta"]]);
});

test("a single-quoted static className is read as a combo", () => {
  const { combos } = collectCombos([FX("static-single.tsx")]);
  assert.deepEqual(combos, [["delta", "gamma"]]);
});

test('a braced but literal className, e.g. className={"a b"}, counts as static, not dynamic', () => {
  const { combos, dynamic } = collectCombos([FX("static-braced.tsx")]);
  assert.deepEqual(combos, [["epsilon", "zeta"]]);
  assert.equal(dynamic, 0, "a literal string in braces is not a computed expression");
});

test("a single class cannot conflict with itself and is not a combo", () => {
  const { combos } = collectCombos([FX("one-class.tsx")]);
  assert.deepEqual(combos, []);
});

test("a clsx() site is excluded from combos and counts as one dynamic (unreadable) file", () => {
  const { combos, dynamic, scanned } = collectCombos([FX("dynamic-one.tsx")]);
  assert.deepEqual(combos, [], "a computed className contributes no combo");
  assert.equal(dynamic, 1);
  assert.equal(scanned, 1);
});

test("THE REGRESSION: dynamic counts FILES, not call sites — three dynamic sites in one file is one unreadable file, not three", () => {
  // This is the exact shape an independent review used to catch a real bug: the old
  // implementation summed `braced - bracedStatic` (a SITE count) into `dynamic`, then src/index.js
  // compared it against `scanned` (a FILE count). One file with three clsx() calls, alongside three
  // ordinary static files, used to read as "3 of 4 markup files unreadable" (25% confidence,
  // ranking withheld) when the true figure is 1 of 4 (75%, ranking kept). This assertion fails
  // under the old `dynamic += Math.max(0, braced - bracedStatic)`, which returns 3 for this file.
  const { dynamic, scanned } = collectCombos([FX("dynamic-three.tsx")]);
  assert.equal(scanned, 1);
  assert.equal(dynamic, 1, "three dynamic call sites in ONE file must count as one unreadable file");
});

test("combos and dynamic files both accumulate correctly across a mixed set of files", () => {
  const files = [
    FX("static-double.tsx"),
    FX("static-single.tsx"),
    FX("dynamic-one.tsx"),
    FX("dynamic-three.tsx"),
  ];
  const { combos, dynamic, scanned } = collectCombos(files);
  assert.equal(scanned, 4);
  assert.equal(dynamic, 2, "two of the four files contain a computed className");
  assert.deepEqual(
    combos.map((c) => c.join(" ")).sort(),
    ["alpha beta", "delta gamma"],
  );
});

test("an unreadable path is skipped from combos without crashing, and still counts toward scanned", () => {
  const { combos, scanned } = collectCombos([FX("static-double.tsx"), FX("does-not-exist.tsx")]);
  assert.deepEqual(combos, [["alpha", "beta"]], "the missing file contributes nothing, silently");
  assert.equal(scanned, 2, "scanned counts files the caller asked to scan, not files it could read");
});
