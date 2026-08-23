/**
 * The three defects that produced this package, as fixtures.
 *
 * Every case below shipped to production in a codebase with 4,500 passing tests, a linter, a type
 * checker and a CSS custom-property parity gate. None of them was caught. They are written here
 * with their real shapes rather than minimised, because the minimised version of bug 1 looks
 * obviously wrong and the real one did not.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/index.js";

const hi = (r) => r.findings.filter((f) => f.severity === "high");

test("bug 1: a base rule's SHORTHAND erases a modifier's longhand, 385 lines later", () => {
  // Shipped 2026-08-22. The Danger zone's delete buttons rendered grey. Every value was correct
  // and ported from the design; `.btn` simply sat later at equal specificity, and its `border`
  // shorthand reset `border-color` while its `color` beat `var(--bad)`.
  const css = `
    .btn--danger { border-color: color-mix(in srgb, var(--bad) 55%, transparent); color: var(--bad); }
    .card { padding: 30px 34px; }
    .btn { height: 38px; border: 2px solid var(--line); color: var(--ink); background: transparent; }
  `;
  const { findings } = analyze({ css, combos: [["btn", "btn--danger"]], from: "globals.css" });
  const high = hi({ findings });

  const colour = high.find((f) => f.property === "color");
  assert.ok(colour, "the modifier's colour losing to the base rule was not reported");
  assert.equal(colour.loser.selector, ".btn--danger");
  assert.equal(colour.winner.selector, ".btn");
  assert.equal(colour.reason, "equal-specificity-source-order");

  // The sharper half: nothing in the losing rule mentions `border-color` on the winning side.
  const border = high.find((f) => f.property.startsWith("border") && f.property.endsWith("color"));
  assert.ok(border, "the shorthand reset of border-color was not reported");
  assert.equal(border.winner.property, "border", "the winner should be the shorthand itself");
  assert.equal(border.shorthandReset, true, "this is a reset, not a same-property override");
});

test("bug 2: a duplicated class re-imposes a layout value 450 lines later", () => {
  // Shipped 2026-08-22. Rows on a settings tab wrapped, dropping every toggle below its label.
  // `.panel-item__text` was a parallel copy of the row grammar that nobody had retired.
  const css = `
    .setting-row__text { min-width: 0; flex: 1 1 0%; }
    .panel-item__text { flex: 1 1 auto; }
  `;
  const { findings } = analyze({
    css,
    combos: [["setting-row__text", "panel-item__text"]],
    from: "globals.css",
  });
  const basis = hi({ findings }).find((f) => f.property === "flex-basis");
  assert.ok(basis, "flex-basis being re-imposed by the later duplicate was not reported");
  assert.equal(basis.loser.selector, ".setting-row__text");
  assert.equal(basis.winner.selector, ".panel-item__text");
});

test("bug 3: two utility classes on one element, and the author of neither gets what they wrote", () => {
  // Shipped 2026-08-22. `class="muted micro"` produced text that was simultaneously the wrong
  // size and the wrong shade, because `.muted` is declared later than `.micro`.
  const css = `
    .micro { font-size: 0.578rem; color: var(--ink-soft); }
    .muted { color: var(--ink-2); }
  `;
  const { findings } = analyze({ css, combos: [["muted", "micro"]], from: "globals.css" });
  const colour = hi({ findings }).find((f) => f.property === "color");
  assert.ok(colour, "the utility-class collision was not reported");
  assert.equal(colour.loser.selector, ".micro");
});

/* ── the noise this must NOT produce, which is what decides whether anyone keeps it on ── */

test("a modifier BEATING its base is ordinary cascade, not a finding", () => {
  // THE CORPUS IS THE POINT of this test, not decoration. `.btn` appears on four element shapes
  // and `.btn--danger` on one, which is the only thing that distinguishes a working modifier
  // from the bug in case 1 -- the two are IDENTICAL in the stylesheet and differ only in which
  // rule is the general one. With a one-combo corpus this test cannot pass, and that is a true
  // statement about the tool rather than a defect in the fixture.
  const css = `.btn { color: var(--ink); } .btn--danger { color: var(--bad); }`;
  const combos = [
    ["btn", "btn--danger"],
    ["btn", "btn--accent"],
    ["btn", "btnrow__item"],
    ["btn", "icon-btn"],
  ];
  const { findings } = analyze({ css, combos });
  assert.equal(hi({ findings }).length, 0, "a working modifier must not read as a defect");
  const low = findings.find((f) => f.loser.selector === ".btn");
  assert.equal(low?.reason, "narrower-rule-wins", "and the reason must say WHY it is fine");
});

test("a :hover rule does not compete with the base rule", () => {
  const css = `.btn { background: transparent; } .btn:hover { background: var(--sink); }`;
  const { findings } = analyze({ css, combos: [["btn"]] });
  assert.equal(findings.length, 0, "hover and rest are different moments, not a conflict");
});

test("identical values are duplication, not a defect", () => {
  const css = `.a { color: red; } .b { color: red; }`;
  const { findings } = analyze({ css, combos: [["a", "b"]] });
  assert.equal(findings.length, 0);
});

test("declarations in different media contexts do not compete", () => {
  const css = `.a { display: flex; } @media (max-width: 600px) { .b { display: block; } }`;
  const { findings } = analyze({ css, combos: [["a", "b"]] });
  assert.equal(findings.length, 0, "a narrow-screen rule is not overriding the wide-screen one");
});

test("!important wins regardless of order, and is not reported as inert", () => {
  const css = `.a { color: red !important; } .b { color: blue; }`;
  const { findings } = analyze({ css, combos: [["a", "b"]] });
  const loser = findings.find((f) => f.loser.selector === ".a");
  assert.equal(loser, undefined, "the !important declaration is the winner here");
});

/* ── refusals: the tool must decline rather than answer wrongly ── */

test("@layer is refused by name rather than analysed wrongly", () => {
  const css = `@layer base, ui; @layer ui { .btn { color: red; } } .btn--x { color: blue; }`;
  const out = analyze({ css, combos: [["btn", "btn--x"]] });
  assert.equal(out.findings.length, 0);
  assert.match(out.refused ?? "", /@layer/);
});

test("selectors needing DOM structure are counted, never silently dropped", () => {
  const css = `.a .b { color: red; } .a > .b { color: blue; } .a { color: green; }`;
  const out = analyze({ css, combos: [["a", "b"]] });
  assert.equal(out.skipped.selectors, 2, "descendant and child combinators must be counted");
  assert.ok(out.skipped.examples.length >= 2, "and named, so the gap is visible");
});

/* ── the ledger's own closes: what the tool asserts, and what it refuses to ── */

test("a partial corpus withholds the intent verdict instead of guessing at it", () => {
  // The close for two ledger lines at once. Intent classification is unsolved BECAUSE corpus
  // extraction is partial, so the honest form is not a third heuristic: it is the tool declining
  // to rank findings it cannot rank, naming the number, and naming what would restore it.
  const css = `.micro { color: a; } .muted { color: b; }`;
  const out = analyze({
    css,
    combos: [["muted", "micro"]],
    corpus: { scanned: 215, dynamic: 173 },   // the real numbers from the stylesheet that produced this
  });
  assert.ok(out.findings.length > 0, "detection does NOT depend on corpus completeness");
  assert.ok(out.findings.every((f) => f.severity === "unranked"), "but ranking does, and is withheld");
  assert.equal(out.confidence.trusted, false);
  assert.match(out.confidence.reason, /cannot read statically/);
  assert.match(out.confidence.reason, /To restore it/, "a refusal must name its own remedy");
});

test("a complete corpus gets its ranking back", () => {
  const css = `.micro { color: a; } .muted { color: b; }`;
  const out = analyze({ css, combos: [["muted", "micro"]], corpus: { scanned: 100, dynamic: 2 } });
  assert.equal(out.confidence.trusted, true);
  assert.ok(out.findings.some((f) => f.severity === "high"));
});

test("hand-supplied combos are the caller's claim, and are not second-guessed", () => {
  // Every other test in this file passes combos directly. If that path invented a confidence
  // score, the tool would be asserting something about a set it was handed -- the same overreach
  // the gate above exists to prevent, pointed the other way.
  const out = analyze({ css: `.a { color: x; } .b { color: y; }`, combos: [["a", "b"]] });
  assert.equal(out.confidence.value, null);
  assert.equal(out.confidence.trusted, true);
});
