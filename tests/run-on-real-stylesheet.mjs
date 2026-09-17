/**
 * Not a unit test: the acid test. Points the analyser at a real-shaped stylesheet, with a corpus
 * collected from real-shaped markup, so the numbers it prints come from files this package ships
 * rather than from a hand-picked list of combos.
 *
 *   node tests/run-on-real-stylesheet.mjs [projectRoot]
 *
 * With no argument it runs against the bundled fixture (tests/fixtures/). Point it at a project of
 * your own to run the same analysis there: it expects `<projectRoot>/globals.css` and a
 * `<projectRoot>/markup` directory of `.tsx` files using `className`.
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { analyze, collectCombos } from "../src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] ?? join(HERE, "fixtures");
const CSS_FILE = join(ROOT, "globals.css");
const MARKUP_DIR = join(ROOT, "markup");

if (!existsSync(CSS_FILE) || !existsSync(MARKUP_DIR)) {
  console.error(`expected ${CSS_FILE} and ${MARKUP_DIR}/ to exist`);
  console.error(`usage: node tests/run-on-real-stylesheet.mjs [projectRoot]`);
  process.exit(1);
}

// execFileSync with an argument array, never a shell string: ROOT can be anything a caller passes
// on the command line, and building a shell command out of it would be an injection waiting to
// happen. `find` runs directly with its arguments as data.
const files = execFileSync(
  "find",
  [MARKUP_DIR, "-name", "*.tsx", "-not", "-path", "*/node_modules/*"],
  { encoding: "utf8" },
).trim().split("\n").filter(Boolean);

const { combos, scanned, dynamic } = collectCombos(files);
console.log(
  `corpus: ${combos.length} class combinations from ${scanned} files ` +
    `(${dynamic} of them unreadable: class names this tool cannot read statically)`,
);

const out = analyze({
  css: readFileSync(CSS_FILE, "utf8"),
  combos,
  from: "globals.css",
  corpus: { scanned, dynamic },   // so the analyser knows what it could not see
});

if (out.refused) {
  console.log("REFUSED:", out.refused);
  process.exit(0);
}

console.log(
  `skipped ${out.skipped.selectors} selectors needing DOM structure, ${out.skipped.atRules} at-rule blocks`,
);

if (!out.confidence.trusted) {
  console.log(`\ncorpus confidence ${(out.confidence.value * 100).toFixed(0)}% — RANKING WITHHELD`);
  console.log(`  ${out.confidence.reason}\n`);
}

const ranked = out.confidence.trusted
  ? out.findings.filter((f) => f.severity === "high")
  : out.findings;
console.log(
  out.confidence.trusted
    ? `findings: ${ranked.length} high, ${out.findings.length - ranked.length} low\n`
    : `findings: ${out.findings.length} overrides, unranked\n`,
);

for (const f of ranked.slice(0, 15)) {
  const state = f.state.length ? ":" + f.state.join(":") : "";
  console.log(`${f.property}  on .${f.combo.join(".")}${state}`);
  console.log(`   loses  ${f.loser.selector}:${f.loser.line}  ${f.loser.property}: ${f.loser.value}`);
  console.log(
    `   to     ${f.winner.selector}:${f.winner.line}  ${f.winner.property}: ${f.winner.value}` +
      (f.shorthandReset ? "   [shorthand reset]" : ""),
  );
}
